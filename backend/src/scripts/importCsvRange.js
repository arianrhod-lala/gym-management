import fs from "fs";
import path from "path";
import csv from "csv-parser";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, "../../../data");
const MONTHLY_CSV = path.join(DATA_DIR, "monthly (feb-apr).csv");
const SESSION_CSV = path.join(DATA_DIR, "session (feb-apr).csv");
const SESSION_JSON = path.join(DATA_DIR, "session_logs.json");

const PRICE_MONTHLY = 500;
const PRICE_SESSION = 45;
const DATE_START = "2026-02-01";
const DATE_END = "2026-04-23";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in backend/.env");
  process.exit(1);
}

const argMap = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, value] = arg.split("=");
    return [key.replace(/^--/, ""), value ?? "true"];
  })
);

const replaceData = String(argMap.replace || "true").toLowerCase() === "true";

const normalizeHeader = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ");

const toIsoDate = (value) => {
  const text = String(value || "").trim();
  if (!text) return "";

  const slash = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slash) {
    let [, month, day, year] = slash;
    if (year.length === 2) year = `20${year}`;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

const toIsoTime = (value) => {
  const text = String(value || "").trim();
  if (!text) return "08:00:00";

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

const addOneCalendarMonth = (isoDateValue) => {
  const date = new Date(`${isoDateValue}T00:00:00`);
  const day = date.getDate();
  date.setMonth(date.getMonth() + 1);
  if (date.getDate() < day) {
    date.setDate(0);
  }
  return date.toISOString().slice(0, 10);
};

const isWithinRange = (isoDateValue) =>
  Boolean(isoDateValue) && isoDateValue >= DATE_START && isoDateValue <= DATE_END;

const readCsvRows = async (csvPath) => {
  return new Promise((resolve, reject) => {
    const rows = [];

    if (!fs.existsSync(csvPath)) {
      reject(new Error(`CSV file not found: ${csvPath}`));
      return;
    }

    fs.createReadStream(csvPath)
      .pipe(csv())
      .on("data", (raw) => {
        const row = {};
        for (const [key, value] of Object.entries(raw)) {
          row[normalizeHeader(key)] = value;
        }
        rows.push(row);
      })
      .on("end", () => resolve(rows))
      .on("error", reject);
  });
};

const clearExistingData = async () => {
  console.log("Clearing existing check_ins and members...");

  const { error: checkDeleteError } = await supabase
    .from("check_ins")
    .delete()
    .gte("check_in_date", "1900-01-01");
  if (checkDeleteError) throw checkDeleteError;

  const { error: membersDeleteError } = await supabase
    .from("members")
    .delete()
    .gte("created_at", "1900-01-01T00:00:00.000Z");
  if (membersDeleteError) throw membersDeleteError;
};

const batchInsert = async (table, rows, batchSize = 1000) => {
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase.from(table).insert(batch);
    if (error) throw error;
    console.log(
      `  inserted ${Math.min(i + batch.length, rows.length)} / ${rows.length} into ${table}`
    );
  }
};

const buildMonthlyData = (rows) => {
  const normalized = rows
    .map((row) => {
      const name = String(row.name || "").trim();
      const checkInDate = toIsoDate(row.date);
      const checkInTime = toIsoTime(row["time in"]);
      const membershipStart = toIsoDate(row["membership start date"]) || checkInDate;
      const membershipEnd =
        toIsoDate(row["membership end date"]) ||
        (membershipStart ? addOneCalendarMonth(membershipStart) : "");

      return {
        name,
        check_in_date: checkInDate,
        check_in_time: checkInTime,
        membership_start_date: membershipStart,
        membership_end_date: membershipEnd,
      };
    })
    .filter((row) => row.name && row.check_in_date && isWithinRange(row.check_in_date));

  const ordered = [...normalized].sort((a, b) => {
    const left = `${a.check_in_date}T${a.check_in_time}`;
    const right = `${b.check_in_date}T${b.check_in_time}`;
    return left.localeCompare(right);
  });

  const membersByName = new Map();
  const chargedRenewalCycles = new Set();

  for (const row of ordered) {
    const key = row.name.toLowerCase();
    if (!membersByName.has(key)) {
      membersByName.set(key, {
        id: randomUUID(),
        name: row.name,
        gender: "Unknown",
        membership_type: "Monthly",
        created_at: `${row.membership_start_date || row.check_in_date}T00:00:00.000Z`,
        updated_at: `${row.membership_end_date || addOneCalendarMonth(row.check_in_date)}T23:59:59.000Z`,
      });
      continue;
    }

    const existing = membersByName.get(key);
    const nextStart = row.membership_start_date || row.check_in_date;
    const nextEnd = row.membership_end_date || addOneCalendarMonth(row.check_in_date);

    if (nextStart && nextStart < existing.created_at.slice(0, 10)) {
      existing.created_at = `${nextStart}T00:00:00.000Z`;
    }
    if (nextEnd && nextEnd > existing.updated_at.slice(0, 10)) {
      existing.updated_at = `${nextEnd}T23:59:59.000Z`;
    }
  }

  const checkIns = ordered.map((row) => {
    const key = row.name.toLowerCase();
    const member = membersByName.get(key);
    const renewalAnchor = row.membership_start_date || row.check_in_date;
    const renewalCycleKey = `${key}::${renewalAnchor}`;
    const shouldCharge = !chargedRenewalCycles.has(renewalCycleKey);

    if (shouldCharge) chargedRenewalCycles.add(renewalCycleKey);

    return {
      id: randomUUID(),
      member_id: member.id,
      check_in_date: row.check_in_date,
      check_in_time: row.check_in_time,
      payment_amount: shouldCharge ? PRICE_MONTHLY : 0,
      created_at: `${row.check_in_date}T${row.check_in_time}`,
    };
  });

  return {
    members: Array.from(membersByName.values()),
    checkIns,
  };
};

const buildSessionLogs = (rows) => {
  return rows
    .map((row) => {
      const checkInDate = toIsoDate(row.date);
      const checkInTime = toIsoTime(row["time in"]);
      const name = String(row.name || "").trim();
      if (!isWithinRange(checkInDate)) return null;

      return {
        name,
        check_in_date: checkInDate,
        check_in_time: checkInTime,
        payment_amount: PRICE_SESSION,
        created_at: `${checkInDate}T${checkInTime}`,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const left = `${a.check_in_date}T${a.check_in_time}`;
      const right = `${b.check_in_date}T${b.check_in_time}`;
      return left.localeCompare(right);
    });
};

const main = async () => {
  try {
    console.log("Reading monthly and session CSV files...");

    const [monthlyRows, sessionRows] = await Promise.all([
      readCsvRows(MONTHLY_CSV),
      readCsvRows(SESSION_CSV),
    ]);

    const monthlyData = buildMonthlyData(monthlyRows);
    const sessionLogs = buildSessionLogs(sessionRows);

    if (replaceData) {
      await clearExistingData();
    }

    console.log(`Importing ${monthlyData.members.length} monthly members...`);
    await batchInsert("members", monthlyData.members);

    console.log(`Importing ${monthlyData.checkIns.length} monthly check-ins...`);
    await batchInsert("check_ins", monthlyData.checkIns);

    fs.writeFileSync(SESSION_JSON, JSON.stringify(sessionLogs, null, 2));

    const monthlyRevenue = monthlyData.checkIns.reduce(
      (sum, row) => sum + (Number(row.payment_amount) || 0),
      0
    );
    const sessionRevenue = sessionLogs.length * PRICE_SESSION;
    const totalRevenue = monthlyRevenue + sessionRevenue;

    console.log("\nCSV import completed");
    console.log(`  monthly members: ${monthlyData.members.length}`);
    console.log(`  monthly check-ins: ${monthlyData.checkIns.length}`);
    console.log(`  imported date range: ${DATE_START} to ${DATE_END}`);
    console.log(`  session logs cached: ${sessionLogs.length}`);
    console.log(`  session cache file: ${SESSION_JSON}`);
    console.log(`  monthly renewal revenue basis: ${monthlyRevenue}`);
    console.log(`  session revenue basis: ${sessionRevenue}`);
    console.log(`  projected revenue basis: ${totalRevenue}`);

    process.exit(0);
  } catch (error) {
    console.error("CSV import failed:", error.message);
    process.exit(1);
  }
};

main();
