import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY // Same key the app is using
);

async function verify() {
  console.log('\n========== COMPLETE DATABASE VERIFICATION ==========\n');

  try {
    // 1. Verify Supabase connection
    console.log('1️⃣ Supabase Credentials:');
    console.log(`   URL: ${process.env.SUPABASE_URL}`);
    console.log(`   Anon Key: ${process.env.SUPABASE_ANON_KEY ? '✓ SET' : '✗ NOT SET'}`);
    console.log(`   Service Key: ${process.env.SUPABASE_SERVICE_KEY ? '✓ SET' : '✗ NOT SET'}\n`);

    // 2. Query members table - RAW COUNT
    console.log('2️⃣ Members Table:');
    const membersQuery = await supabase.from('members').select('*', { count: 'exact' });
    console.log(`   ✓ Total members in DB: ${membersQuery.count}`);
    console.log(`   ✓ Query error: ${membersQuery.error ? membersQuery.error.message : 'none'}`);
    
    if (membersQuery.data && membersQuery.data.length > 0) {
      console.log(`   ✓ Sample members:`);
      membersQuery.data.slice(0, 3).forEach((m, i) => {
        console.log(`      ${i+1}. ID: ${m.id}, Name: ${m.name}, Gender: ${m.gender}`);
      });
    }

    // 3. Query check_ins table - RAW COUNT
    console.log('\n3️⃣ Check-ins Table:');
    const checkInsQuery = await supabase.from('check_ins').select('*', { count: 'exact' });
    console.log(`   ✓ Total check-ins in DB: ${checkInsQuery.count}`);
    console.log(`   ✓ Query error: ${checkInsQuery.error ? checkInsQuery.error.message : 'none'}`);
    
    if (checkInsQuery.data && checkInsQuery.data.length > 0) {
      console.log(`   ✓ Sample check-ins:`);
      checkInsQuery.data.slice(0, 3).forEach((c, i) => {
        console.log(`      ${i+1}. Date: ${c.check_in_date}, Time: ${c.check_in_time}, Amount: ${c.payment_amount}`);
      });
    }

    // 4. If both tables have data, manually run the dashboard query
    if (membersQuery.count > 0 && checkInsQuery.count > 0) {
      console.log('\n4️⃣ Manual Dashboard Calculation:');
      
      const { data: allCheckIns } = await supabase
        .from('check_ins')
        .select('member_id, check_in_date, payment_amount')
        .order('check_in_date', { ascending: false });

      if (allCheckIns && allCheckIns.length > 0) {
        console.log(`   ✓ Retrieved ${allCheckIns.length} check-ins from API`);
        
        const monthsWithData = [...new Set(
          allCheckIns.map(c => c.check_in_date.slice(0, 7))
        )].sort().reverse();
        
        console.log(`   ✓ Months with data: ${monthsWithData.join(', ')}`);
        
        const currentMonth = monthsWithData[0];
        const activeMembers = new Set(
          allCheckIns
            .filter(c => c.check_in_date.startsWith(currentMonth))
            .map(c => c.member_id)
        ).size;
        
        const revenue = allCheckIns
          .filter(c => c.check_in_date.startsWith(currentMonth))
          .reduce((sum, c) => sum + (c.payment_amount || 0), 0);
        
        console.log(`   ✓ Current month: ${currentMonth}`);
        console.log(`   ✓ Active members in ${currentMonth}: ${activeMembers}`);
        console.log(`   ✓ Revenue in ${currentMonth}: ${revenue}`);
      }
    }

    console.log('\n✅ Verification complete!\n');

  } catch (error) {
    console.error('❌ Fatal error:', error.message);
  }

  process.exit(0);
}

verify();
