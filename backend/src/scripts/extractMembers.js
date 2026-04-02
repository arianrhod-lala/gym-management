import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function extractUniqueMembers() {
  try {
    console.log('Extracting unique members from gym_records_orig.csv...\n');

    const members = {};
    const csvPath = path.join(__dirname, '../../gym_records_orig.csv');

    // Read and parse CSV
    fs.createReadStream(csvPath)
      .pipe(csv())
      .on('data', (row) => {
        const name = row.Name;
        const gender = row.Gender;
        const membership = row.Membership;

        // Use name as key to ensure uniqueness
        if (!members[name]) {
          members[name] = {
            name,
            gender,
            membership_type: membership,
          };
        }
      })
      .on('end', () => {
        const uniqueMembers = Object.values(members);
        console.log(`✓ Found ${uniqueMembers.length} unique members\n`);

        // Write to new CSV
        const outputPath = path.join(__dirname, '../../members_clean.csv');
        const csvHeader = 'name,gender,membership_type\n';
        const csvContent = uniqueMembers
          .map(m => `${m.name},${m.gender},${m.membership_type}`)
          .join('\n');

        fs.writeFileSync(outputPath, csvHeader + csvContent);

        console.log(`✅ Created members_clean.csv with ${uniqueMembers.length} unique members`);
        console.log(`📁 File location: ${outputPath}\n`);
        console.log('Sample members:');
        uniqueMembers.slice(0, 5).forEach((m, i) => {
          console.log(`   ${i + 1}. ${m.name} (${m.gender}, ${m.membership_type})`);
        });

        console.log('\n⏸️  STOP HERE - Delete the current data before reimporting!');
        process.exit(0);
      })
      .on('error', (err) => {
        console.error('Error reading CSV:', err);
        process.exit(1);
      });
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

extractUniqueMembers();
