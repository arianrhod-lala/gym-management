import { supabase } from "../db/supabaseClient.js";
import { randomUUID } from "crypto";

/**
 * Log a check-in for a member
 * @param {object} checkInData - { member_id, payment_amount }
 * @returns {Promise<object>}
 */
export const logCheckIn = async (checkInData) => {
  try {
    const now = new Date();
    const checkInDate = now.toISOString().split("T")[0]; // YYYY-MM-DD
    const checkInTime = now.toTimeString().split(" ")[0]; // HH:MM:SS

    const { data, error } = await supabase
      .from("check_ins")
      .insert([
        {
          id: randomUUID(),
          member_id: checkInData.member_id,
          check_in_date: checkInDate,
          check_in_time: checkInTime,
          payment_amount: checkInData.payment_amount || 0,
          created_at: now.toISOString(),
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

    const { data, error } = await query.order("check_in_date", {
      ascending: false,
    });

    if (error) throw error;
    return data || [];
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
