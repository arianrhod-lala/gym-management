import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Supabase client with SERVICE_KEY for admin operations
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
);

async function importCheckIns() {
  try {
    console.log('Starting check-in import from gym_records_orig.csv...\n');

    const records = [];
    const csvPath = path.join(__dirname, '../../gym_records_orig.csv');

    // Read and parse CSV
    const parser = fs.createReadStream(csvPath).pipe(csv());

    parser.on('data', (row) => {
      records.push({
        date: row['Date'],
        name: row['Name'],
        timeIn: row['Time In'],
        payment: parseInt(row['Payment (PHP)']) || 0,
      });
    });

    parser.on('end', async () => {
      console.log(`Read ${records.length} records from CSV\n`);

      // Get all members with lowercase names for matching
      const { data: members, error: membersError } = await supabase
        .from('members')
        .select('id, name');

      if (membersError) {
        console.error('Error fetching members:', membersError);
        process.exit(1);
      }

      // Create a map of lowercase name -> id for fast lookup
      const memberMap = {};
      members.forEach(m => {
        memberMap[m.name.toLowerCase()] = m.id;
      });

      console.log(`Found ${members.length} members in database\n`);

      // Prepare check-in records
      const checkIns = [];
      let notFound = 0;

      for (const record of records) {
        const memberId = memberMap[record.name.toLowerCase()];
        
        if (!memberId) {
          notFound++;
          continue;
        }

        // Parse date (M/D/YYYY format)
        const [month, day, year] = record.date.split('/');
        const checkInDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

        // Convert time to 24-hour format
        const timeMatch = record.timeIn.match(/(\d{1,2}):(\d{2})\s(AM|PM)/i);
        if (!timeMatch) {
          console.warn(`Invalid time format: ${record.timeIn}`);
          continue;
        }

        let hour = parseInt(timeMatch[1]);
        const minute = timeMatch[2];
        const period = timeMatch[3].toUpperCase();

        if (period === 'PM' && hour !== 12) hour += 12;
        if (period === 'AM' && hour === 12) hour = 0;

        const checkInTime = `${hour.toString().padStart(2, '0')}:${minute}:00`;

        checkIns.push({
          member_id: memberId,
          check_in_date: checkInDate,
          check_in_time: checkInTime,
          payment_amount: record.payment,
        });
      }

      console.log(`Prepared ${checkIns.length} records for import`);
      console.log(`Members not found: ${notFound}\n`);

      // Insert in batches of 500
      const batchSize = 500;
      let inserted = 0;
      let errors = 0;

      for (let i = 0; i < checkIns.length; i += batchSize) {
        const batch = checkIns.slice(i, i + batchSize);
        const { error: insertError } = await supabase
          .from('check_ins')
          .insert(batch);

        if (insertError) {
          console.error(`Batch ${Math.floor(i / batchSize) + 1} error:`, insertError);
          errors += batch.length;
        } else {
          inserted += batch.length;
          console.log(`✓ Inserted batch ${Math.floor(i / batchSize) + 1} (${batch.length} records)`);
        }
      }

      console.log(`\n✅ Import complete!`);
      console.log(`Total inserted: ${inserted}`);
      console.log(`Total errors: ${errors}`);
      console.log(`Success rate: ${((inserted / checkIns.length) * 100).toFixed(1)}%`);

      process.exit(0);
    });

    parser.on('error', (err) => {
      console.error('CSV parsing error:', err);
      process.exit(1);
    });
  } catch (error) {
    console.error('Import failed:', error);
    process.exit(1);
  }
}

// Run import
importCheckIns();
