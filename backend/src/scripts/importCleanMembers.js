import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
);

async function importCleanMembers() {
  try {
    console.log('Starting clean members import from members_clean.csv...\n');

    const members = [];
    const csvPath = path.join(__dirname, '../../members_clean.csv');

    // Read and parse CSV
    const parser = fs.createReadStream(csvPath).pipe(csv());

    parser.on('data', (row) => {
      members.push({
        name: row.name || row.Name,
        gender: row.gender || row.Gender,
        membership_type: row.membership_type || row.Membership,
      });
    });

    parser.on('end', async () => {
      console.log(`Read ${members.length} members from members_clean.csv\n`);

      // Insert in batches of 500
      const batchSize = 500;
      let inserted = 0;
      let errors = 0;

      for (let i = 0; i < members.length; i += batchSize) {
        const batch = members.slice(i, i + batchSize);
        const { error: insertError } = await supabase
          .from('members')
          .insert(batch);

        if (insertError) {
          console.error(`Batch ${Math.floor(i / batchSize) + 1} error:`, insertError.message);
          errors += batch.length;
        } else {
          inserted += batch.length;
          console.log(`✓ Inserted batch ${Math.floor(i / batchSize) + 1} (${batch.length} members)`);
        }
      }

      console.log(`\n✅ Import complete!`);
      console.log(`Total inserted: ${inserted}`);
      console.log(`Total errors: ${errors}`);
      console.log(`Success rate: ${((inserted / members.length) * 100).toFixed(1)}%`);

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

importCleanMembers();
