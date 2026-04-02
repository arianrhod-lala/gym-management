import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function debug() {
  console.log('\n========== DEBUGGING ANALYTICS ==========\n');

  try {
    // 1. Test Supabase connection
    console.log('1. Testing Supabase Connection...');
    console.log(`   URL: ${process.env.SUPABASE_URL}`);
    console.log(`   Anon Key: ${process.env.SUPABASE_ANON_KEY ? 'SET' : 'NOT SET'}`);

    // 2. Check members table
    console.log('\n2. Checking Members Table...');
    const { data: members, error: membersError } = await supabase
      .from('members')
      .select('id')
      .limit(5);

    if (membersError) {
      console.error('   ❌ Error:', membersError);
    } else {
      console.log(`   ✓ Members count: ${members?.length || 0}`);
      const { count } = await supabase
        .from('members')
        .select('id', { count: 'exact' });
      console.log(`   ✓ Total members (with count): ${count}`);
    }

    // 3. Check check_ins table count
    console.log('\n3. Checking Check-ins Table...');
    const { data: checkIns, count: checkInsCount, error: checkInsError } = await supabase
      .from('check_ins')
      .select('id', { count: 'exact' });

    if (checkInsError) {
      console.error('   ❌ Error:', checkInsError);
    } else {
      console.log(`   ✓ Check-ins count: ${checkInsCount}`);
      console.log(`   ✓ Returned rows: ${checkIns?.length || 0}`);
    }

    // 4. Get first few check-ins
    console.log('\n4. Sample Check-in Records...');
    const { data: samples, error: sampleError } = await supabase
      .from('check_ins')
      .select('*')
      .limit(3);

    if (sampleError) {
      console.error('   ❌ Error:', sampleError);
    } else {
      if (samples && samples.length > 0) {
        console.log(`   ✓ Found ${samples.length} sample records:`);
        samples.forEach((s, i) => {
          console.log(`      Record ${i + 1}: Date=${s.check_in_date}, Time=${s.check_in_time}, Amount=${s.payment_amount}, MemberId=${s.member_id}`);
        });
      } else {
        console.log('   ❌ No check-in records found!');
      }
    }

    // 5. Get all dates in check_ins
    console.log('\n5. Date Range in Check-Ins...');
    const { data: allDates, error: datesError } = await supabase
      .from('check_ins')
      .select('check_in_date')
      .order('check_in_date', { ascending: true });

    if (datesError) {
      console.error('   ❌ Error:', datesError);
    } else if (allDates && allDates.length > 0) {
      const uniqueDates = [...new Set(allDates.map(d => d.check_in_date))];
      console.log(`   ✓ Unique dates: ${uniqueDates.length}`);
      console.log(`   ✓ Date range: ${uniqueDates[0]} to ${uniqueDates[uniqueDates.length - 1]}`);
      console.log(`   ✓ Months present: ${[...new Set(uniqueDates.map(d => d.slice(0, 7)))].join(', ')}`);
    }

    // 6. Test analytics query manually
    console.log('\n6. Testing Manual Analytics Query...');
    const { data: manualData, error: manualError } = await supabase
      .from('check_ins')
      .select('member_id, check_in_date, payment_amount')
      .order('check_in_date', { ascending: false });

    if (manualError) {
      console.error('   ❌ Error:', manualError);
    } else {
      console.log(`   ✓ Retrieved ${manualData?.length || 0} records`);
      if (manualData && manualData.length > 0) {
        const months = [...new Set(manualData.map(c => c.check_in_date.slice(0, 7)))].sort().reverse();
        console.log(`   ✓ Months (newest first): ${months.join(', ')}`);
        
        const currentMonth = months[0];
        const currentMonthData = manualData.filter(c => c.check_in_date.startsWith(currentMonth));
        console.log(`   ✓ Records in ${currentMonth}: ${currentMonthData.length}`);
        
        const revenue = currentMonthData.reduce((sum, c) => sum + (c.payment_amount || 0), 0);
        console.log(`   ✓ Revenue in ${currentMonth}: ${revenue}`);
      }
    }

    console.log('\n✅ Debug complete!\n');

  } catch (error) {
    console.error('Fatal error:', error);
  }

  process.exit(0);
}

debug();
