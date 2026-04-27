import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

const missingConfigMessage =
  "Supabase is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_KEY (or SUPABASE_ANON_KEY) in backend/.env.";

const createMissingClient = () => ({
  from: () => {
    throw new Error(missingConfigMessage);
  },
});

if (!supabaseUrl || !supabaseKey) {
  console.warn(missingConfigMessage);
}

export const supabase =
  supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey)
    : createMissingClient();
