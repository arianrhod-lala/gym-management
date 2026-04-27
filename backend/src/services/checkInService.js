import { supabase } from "../db/supabaseClient.js";
import { randomUUID } from "crypto";
import { loadSessionLogs } from "../utils/sessionLogs.js";

const CHECK_INS_PAGE_SIZE = 1000;
const GYM_OPEN_HOUR = 6;
const GYM_CLOSE_HOUR = 22;

const getHourFromTimeString = (timeValue) => {
  const hour = Number(String(timeValue || "00:00:00").split(":")[0]);
  return Number.isFinite(hour) ? hour : 0;
};

const isWithinGymHours = (hour) => Number.isFinite(hour) && hour >= GYM_OPEN_HOUR && hour <= GYM_CLOSE_HOUR;

/**
 * Log a check-in for a member
 * @param {object} checkInData - { member_id, payment_amount }
 * @returns {Promise<object>}
 */
export const logCheckIn = async (checkInData) => {
  try {
    const now = new Date();
    const hasCustomDate = Boolean(checkInData.check_in_date);
    const customDateTime = hasCustomDate
      ? new Date(`${checkInData.check_in_date}T${checkInData.check_in_time || "08:00:00"}`)
      : null;

    const effectiveDate =
      customDateTime && !Number.isNaN(customDateTime.getTime())
        ? customDateTime
        : now;

    if (!isWithinGymHours(effectiveDate.getHours())) {
      throw new Error("Check-ins are only allowed during gym hours (6:00 AM to 10:00 PM).");
    }

    const checkInDate = effectiveDate.toISOString().split("T")[0]; // YYYY-MM-DD
    const checkInTime = effectiveDate.toTimeString().split(" ")[0]; // HH:MM:SS

    const { data, error } = await supabase
      .from("check_ins")
      .insert([
        {
          id: randomUUID(),
          member_id: checkInData.member_id,
          check_in_date: checkInDate,
          check_in_time: checkInTime,
          payment_amount: checkInData.payment_amount || 0,
          created_at: effectiveDate.toISOString(),
        },
      ])
      .select();

    if (error) throw error;
    return data[0];
  } catch (error) {
    throw new Error(`Failed to log check-in: ${error.message}`);
  }
};

/**
 * Get check-ins with optional filters
 * @param {object} filters - { startDate, endDate, memberId }
 * @returns {Promise<Array>}
 */
export const getCheckIns = async (filters = {}) => {
  try {
    const dbRows = [];
    let from = 0;

    while (true) {
      const to = from + CHECK_INS_PAGE_SIZE - 1;

      let query = supabase
        .from("check_ins")
        .select(
          `
          *,
          members:member_id(name, membership_type)
        `
        );

      if (filters.startDate) {
        query = query.gte("check_in_date", filters.startDate);
      }

      if (filters.endDate) {
        query = query.lte("check_in_date", filters.endDate);
      }

      if (filters.memberId) {
        query = query.eq("member_id", filters.memberId);
      }

      const { data, error } = await query
        .order("check_in_date", { ascending: false })
        .order("check_in_time", { ascending: false })
        .range(from, to);

      if (error) throw error;
      if (!data || data.length === 0) break;

      const inHoursRows = data.filter((row) =>
        isWithinGymHours(getHourFromTimeString(row.check_in_time))
      );

      dbRows.push(...inHoursRows);

      if (data.length < CHECK_INS_PAGE_SIZE) break;
      from += CHECK_INS_PAGE_SIZE;
    }

    const sessionRowsRaw = await loadSessionLogs();

    const sessionRows = sessionRowsRaw
      .filter((row, index) => {
        if (filters.startDate && row.check_in_date < filters.startDate) return false;
        if (filters.endDate && row.check_in_date > filters.endDate) return false;
        if (filters.memberId) return false;
        if (!isWithinGymHours(getHourFromTimeString(row.check_in_time))) return false;
        return true;
      })
      .map((row, index) => ({
        id: `session-${index + 1}`,
        member_id: `session-${index + 1}`,
        check_in_date: row.check_in_date,
        check_in_time: row.check_in_time,
        payment_amount: Number(row.payment_amount) || 45,
        created_at: row.created_at || `${row.check_in_date}T${row.check_in_time}`,
        members: {
          name: String(row.name || "Walk-in Customer").trim() || "Walk-in Customer",
          membership_type: "Session",
        },
      }));

    return [...dbRows, ...sessionRows].sort((a, b) => {
      const left = `${a.check_in_date || ""}T${a.check_in_time || "00:00:00"}`;
      const right = `${b.check_in_date || ""}T${b.check_in_time || "00:00:00"}`;
      return right.localeCompare(left);
    });
  } catch (error) {
    throw new Error(`Failed to fetch check-ins: ${error.message}`);
  }
};

/**
 * Get today's check-ins
 * @returns {Promise<Array>}
 */
export const getTodayCheckIns = async () => {
  try {
    const today = new Date().toISOString().split("T")[0];
    return await getCheckIns({ startDate: today, endDate: today });
  } catch (error) {
    throw new Error(`Failed to fetch today's check-ins: ${error.message}`);
  }
};
