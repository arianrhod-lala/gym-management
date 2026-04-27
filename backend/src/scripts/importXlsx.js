import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import dotenv from "dotenv";
import xlsx from "xlsx";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PRICE_MONTHLY = 500;
const PRICE_SESSION = 45;

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in backend/.env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const argMap = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, value] = arg.split("=");
    return [key.replace(/^--/, ""), value ?? "true"];
  })
);

const mode = String(argMap.mode || "monthly").toLowerCase();
const workbookPath = path.resolve(
  __dirname,
  argMap.file || "../../../data/monthly.xlsx"
);
const sheetName = argMap.sheet || null;
const replaceData = String(argMap.replace || "true").toLowerCase() === "true";

const normalizeHeader = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ");

const toIsoDate = (value) => {
  if (value === null || value === undefined || value === "") return "";

  if (typeof value === "number") {
    const parsed = xlsx.SSF.parse_date_code(value);
    if (!parsed || !parsed.y || !parsed.m || !parsed.d) return "";
    return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
  }

  const text = String(value).trim();
  if (!text) return "";

  const parsedDate = new Date(text);
  if (!Number.isNaN(parsedDate.getTime())) {
    return parsedDate.toISOString().slice(0, 10);
  }

  const slashMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slashMatch) {
    let [, m, d, y] = slashMatch;
    if (y.length === 2) y = `20${y}`;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  return "";
};

const toIsoTime = (value) => {
  if (value === null || value === undefined || value === "") return "08:00:00";

  if (typeof value === "number") {
    const dayFraction = value % 1;
    const totalSeconds = Math.round(dayFraction * 86400) % 86400;
    const hh = Math.floor(totalSeconds / 3600);
    const mm = Math.floor((totalSeconds % 3600) / 60);
    const ss = totalSeconds % 60;
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  }

  const text = String(value).trim();
  const ampm = text.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (ampm) {
    let hh = Number(ampm[1]);
    const mm = Number(ampm[2]);
    const ss = Number(ampm[3] || 0);
    const period = ampm[4].toUpperCase();

    if (period === "PM" && hh !== 12) hh += 12;
    if (period === "AM" && hh === 12) hh = 0;

    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  }

  const hms = text.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (hms) {
    const hh = Number(hms[1]);
    const mm = Number(hms[2]);
    const ss = Number(hms[3] || 0);
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  }

  return "08:00:00";
};

const readRows = () => {
  if (!fs.existsSync(workbookPath)) {
    throw new Error(`XLSX file not found: ${workbookPath}`);
  }

  const workbook = xlsx.readFile(workbookPath);
  const targetSheet = sheetName || workbook.SheetNames[0];
  const worksheet = workbook.Sheets[targetSheet];

  if (!worksheet) {
    throw new Error(`Sheet not found: ${targetSheet}`);
  }

  const rawRows = xlsx.utils.sheet_to_json(worksheet, { defval: "" });

  return rawRows.map((raw) => {
    const normalizedRow = {};
    for (const [key, value] of Object.entries(raw)) {
      normalizedRow[normalizeHeader(key)] = value;
    }

    const name = String(normalizedRow.name || "").trim();
    const date = toIsoDate(normalizedRow.date);
    const timeIn = toIsoTime(normalizedRow["time in"]);

    return { name, check_in_date: date, check_in_time: timeIn };
  }).filter((row) => row.name && row.check_in_date);
};

const batchInsert = async (table, rows, batchSize = 1000) => {
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase.from(table).insert(batch);
    if (error) throw error;
    console.log(`  inserted ${Math.min(i + batch.length, rows.length)} / ${rows.length} into ${table}`);
  }
};

const clearExistingData = async () => {
  console.log("Clearing existing data from check_ins and members...");

  const { error: checkInsDeleteError } = await supabase
    .from("check_ins")
    .delete()
    .gte("check_in_date", "1900-01-01");
  if (checkInsDeleteError) throw checkInsDeleteError;

  const { error: membersDeleteError } = await supabase
    .from("members")
    .delete()
    .gte("created_at", "1900-01-01T00:00:00.000Z");
  if (membersDeleteError) throw membersDeleteError;
};

const importMonthlyData = async (rows) => {
  const orderedRows = [...rows].sort((a, b) => {
    const left = `${a.check_in_date}T${a.check_in_time}`;
    const right = `${b.check_in_date}T${b.check_in_time}`;
    return left.localeCompare(right);
  });

  const membersByName = new Map();
  const chargedMemberKeys = new Set();

  for (const row of orderedRows) {
    const key = row.name.toLowerCase();
    if (!membersByName.has(key)) {
      membersByName.set(key, {
        id: randomUUID(),
        name: row.name,
        gender: "Unknown",
        membership_type: "Monthly",
        created_at: `${row.check_in_date}T00:00:00.000Z`,
        updated_at: new Date().toISOString(),
      });
    }
  }

  const checkIns = orderedRows.map((row) => {
    const key = row.name.toLowerCase();
    const member = membersByName.get(key);
    const shouldChargeMember = !chargedMemberKeys.has(key);

    if (shouldChargeMember) {
      chargedMemberKeys.add(key);
    }

    return {
      id: randomUUID(),
      member_id: member.id,
      check_in_date: row.check_in_date,
      check_in_time: row.check_in_time,
      payment_amount: shouldChargeMember ? PRICE_MONTHLY : 0,
      created_at: `${row.check_in_date}T${row.check_in_time}`,
    };
  });

  const members = Array.from(membersByName.values());

  if (replaceData) {
    await clearExistingData();
  }

  console.log(`Importing ${members.length} monthly members...`);
  await batchInsert("members", members);

  console.log(`Importing ${checkIns.length} monthly check-ins...`);
  await batchInsert("check_ins", checkIns);

  const revenue = members.length * PRICE_MONTHLY;

  console.log("\nMonthly import completed");
  console.log(`  members: ${members.length}`);
  console.log(`  check-ins: ${checkIns.length}`);
  console.log(`  revenue basis: ${members.length} * ${PRICE_MONTHLY} = ${revenue}`);
};

const prepareSessionData = async (rows) => {
  const prepared = rows.map((row) => ({
    name: row.name,
    check_in_date: row.check_in_date,
    check_in_time: row.check_in_time,
    payment_amount: PRICE_SESSION,
  }));

  const outputPath = path.resolve(__dirname, "../../../data/session_prepared.json");
  fs.writeFileSync(outputPath, JSON.stringify(prepared, null, 2));

  console.log("Session data prepared");
  console.log(`  rows: ${prepared.length}`);
  console.log(`  output: ${outputPath}`);
  console.log("  note: session rows are prepared for insertion logic without creating member records.");
};

const main = async () => {
  try {
    console.log(`Reading workbook: ${workbookPath}`);
    const rows = readRows();
    console.log(`Parsed rows: ${rows.length}`);

    if (!rows.length) {
      throw new Error("No valid rows found in workbook.");
    }

    if (mode === "monthly") {
      await importMonthlyData(rows);
    } else if (mode === "session") {
      await prepareSessionData(rows);
    } else {
      throw new Error(`Unsupported mode: ${mode}. Use --mode=monthly or --mode=session`);
    }

    process.exit(0);
  } catch (error) {
    console.error("Import failed:", error.message);
    process.exit(1);
  }
};

main();
