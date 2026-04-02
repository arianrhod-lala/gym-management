import fs from "fs";
import path from "path";
import csv from "csv-parser";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use SERVICE_KEY for admin operations
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Parse CSV and import to Supabase
const importCSV = async () => {
  try {
    const csvPath = path.join(__dirname, "../../gym_records.csv");

    if (!fs.existsSync(csvPath)) {
      console.error(`CSV file not found at ${csvPath}`);
      process.exit(1);
    }

    const members = {};
    const checkIns = [];

    console.log("Reading CSV file...");

    // Read and parse CSV
    fs.createReadStream(csvPath)
      .pipe(csv())
      .on("data", (row) => {
        const memberName = row.Name;
        const date = row.Date;
        const timeIn = row["Time In"];
        const payment = parseFloat(row["Payment (PHP)"]) || 0;
        const gender = row.Gender;
        const membership = row.Membership;

        // Track unique members
        if (!members[memberName]) {
          members[memberName] = {
            id: randomUUID(),
            name: memberName,
            gender: gender,
            membership_type: membership,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
        }

        // Create check-in record
        checkIns.push({
          id: randomUUID(),
          member_id: members[memberName].id,
          check_in_date: date,
          check_in_time: timeIn,
          payment_amount: payment,
          created_at: new Date().toISOString(),
        });
      })
      .on("end", async () => {
        console.log(`Found ${Object.keys(members).length} unique members`);
        console.log(`Found ${checkIns.length} check-in records`);

        try {
          const membersList = Object.values(members);

          // Insert members
          console.log("Inserting members...");
          const { data: insertedMembers, error: membersError } = await supabase
            .from("members")
            .insert(membersList);

          if (membersError) {
            console.error("Error inserting members:", membersError);
            throw membersError;
          }

          console.log(`✓ Inserted ${membersList.length} members`);

          // Insert check-ins in batches (Supabase has limits)
          console.log("Inserting check-ins...");
          const batchSize = 1000;
          for (let i = 0; i < checkIns.length; i += batchSize) {
            const batch = checkIns.slice(i, i + batchSize);
            const { error: checkInError } = await supabase
              .from("check_ins")
              .insert(batch);

            if (checkInError) {
              console.error("Error inserting check-ins:", checkInError);
              throw checkInError;
            }

            console.log(
              `✓ Inserted ${Math.min(batchSize, checkIns.length - i)} check-ins...`
            );
          }

          console.log(`\n✓ CSV import completed successfully!`);
          console.log(`  - Members: ${membersList.length}`);
          console.log(`  - Check-ins: ${checkIns.length}`);
          process.exit(0);
        } catch (error) {
          console.error("Error during import:", error);
          process.exit(1);
        }
      })
      .on("error", (error) => {
        console.error("Error reading CSV:", error);
        process.exit(1);
      });
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
};

console.log("Starting CSV import from gym_records.csv...\n");
importCSV();
