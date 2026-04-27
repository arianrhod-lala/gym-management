import fs from "fs";
import path from "path";
import csv from "csv-parser";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, "../../../data");
const SESSION_JSON_PATH = path.join(DATA_DIR, "session_logs.json");
const SESSION_CSV_PATH = path.join(DATA_DIR, "session (feb-apr).csv");

const PRICE_SESSION = 45;

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

const normalizeHeader = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ");

const readCsvRows = async (csvPath) => {
  return new Promise((resolve, reject) => {
    const rows = [];

    if (!fs.existsSync(csvPath)) {
      resolve(rows);
      return;
    }

    fs.createReadStream(csvPath)
      .pipe(csv())
      .on("data", (raw) => {
        const row = {};
        for (const [key, value] of Object.entries(raw)) {
          row[normalizeHeader(key)] = value;
        }

        const checkInDate = toIsoDate(row.date);
        const checkInTime = toIsoTime(row["time in"]);
        const name = String(row.name || "").trim();
        if (!checkInDate) return;

        rows.push({
          name,
          check_in_date: checkInDate,
          check_in_time: checkInTime,
          payment_amount: PRICE_SESSION,
          created_at: `${checkInDate}T${checkInTime}`,
        });
      })
      .on("end", () => resolve(rows))
      .on("error", reject);
  });
};

const readJsonRows = () => {
  if (!fs.existsSync(SESSION_JSON_PATH)) return [];

  const raw = fs.readFileSync(SESSION_JSON_PATH, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) return [];

  return parsed
    .map((row) => {
      const checkInDate = toIsoDate(row.check_in_date || row.date);
      const checkInTime = toIsoTime(row.check_in_time || row["time in"]);
      const name = String(row.name || row.member_name || "").trim();
      if (!checkInDate) return null;

      return {
        name,
        check_in_date: checkInDate,
        check_in_time: checkInTime,
        payment_amount:
          Number.isFinite(Number(row.payment_amount)) && Number(row.payment_amount) > 0
            ? Number(row.payment_amount)
            : PRICE_SESSION,
        created_at: `${checkInDate}T${checkInTime}`,
      };
    })
    .filter(Boolean);
};

export const loadSessionLogs = async () => {
  const jsonRows = readJsonRows();
  const hasNames = jsonRows.some((row) => String(row.name || "").trim().length > 0);
  if (jsonRows.length > 0 && hasNames) return jsonRows;

  return await readCsvRows(SESSION_CSV_PATH);
};
