import { supabase } from "../db/supabaseClient.js";

/**
 * Create database tables
 * Run this script to set up the database schema
 */
const setupDatabase = async () => {
  try {
    console.log("Setting up database schema...\n");

    // Create users table
    console.log("Creating users table...");
    const { error: usersError } = await supabase.rpc("execute_sql", {
      sql: `
        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `,
    });

    if (usersError && !usersError.message.includes("already exists")) {
      console.error("Error creating users table:", usersError);
    } else {
      console.log("✓ Users table ready");
    }

    // Create members table
    console.log("Creating members table...");
    const { error: membersError } = await supabase.rpc("execute_sql", {
      sql: `
        CREATE TABLE IF NOT EXISTS members (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(255) NOT NULL,
          gender VARCHAR(50),
          membership_type VARCHAR(50) NOT NULL,
          qr_code VARCHAR(255) UNIQUE,
          qr_code_image TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `,
    });

    if (membersError && !membersError.message.includes("already exists")) {
      console.error("Error creating members table:", membersError);
    } else {
      console.log("✓ Members table ready");
    }

    // Create check_ins table
    console.log("Creating check_ins table...");
    const { error: checkInsError } = await supabase.rpc("execute_sql", {
      sql: `
        CREATE TABLE IF NOT EXISTS check_ins (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
          check_in_date DATE NOT NULL,
          check_in_time TIME NOT NULL,
          payment_amount DECIMAL(10, 2) DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `,
    });

    if (
      checkInsError &&
      !checkInsError.message.includes("already exists")
    ) {
      console.error("Error creating check_ins table:", checkInsError);
    } else {
      console.log("✓ Check-ins table ready");
    }

    console.log("\n✓ Database setup completed!");
    console.log("\nNext steps:");
    console.log(
      "1. Create an owner account: POST /api/auth/register with email/password"
    );
    console.log("2. Import CSV data: npm run import:csv");
    console.log("3. Start the server: npm run dev");

    process.exit(0);
  } catch (error) {
    console.error("Database setup error:", error);
    console.log(
      "\nNote: If RPC execute_sql is not available, use Supabase dashboard to run the SQL migrations."
    );
    process.exit(1);
  }
};

console.log("Database Setup Script\n");
setupDatabase();
