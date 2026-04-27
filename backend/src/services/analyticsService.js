import { supabase } from "../db/supabaseClient.js";
import { getCheckIns } from "./checkInService.js";

const CHECK_INS_PAGE_SIZE = 1000;
const GYM_OPEN_HOUR = 6;
const GYM_CLOSE_HOUR = 22;

const formatHourAmPm = (hour) => {
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:00 ${period}`;
};

const fetchAllCheckIns = async (columns) => {
  const rows = await getCheckIns({});
  return rows;
};

/**
 * Get dashboard metrics
 * @returns {Promise<object>}
 */
export const getDashboardMetrics = async () => {
  try {
    // Get total members
    const { data: members, error: membersError } = await supabase
      .from("members")
      .select("id, membership_type");

    if (membersError) throw membersError;

    const totalMembers = (members || []).filter((member) =>
      String(member.membership_type || "").toLowerCase().includes("monthly")
    ).length;

    // Get all check-in data
    const allCheckIns = await fetchAllCheckIns(
      "member_id, check_in_date, payment_amount, created_at"
    );

    if (!allCheckIns || allCheckIns.length === 0) {
      return {
        totalMembers,
        activeMembers: 0,
        currentMonthRevenue: 0,
        revenueChangePercent: 0,
        checkInsToday: 0,
        currentMonth: "2026-03",
        dataAvailable: false,
      };
    }

    // Find the two most recent months with data
    const monthsWithData = [...new Set(
      allCheckIns
        .map((c) => String(c.check_in_date || "").slice(0, 7))
        .filter(Boolean)
    )].sort().reverse();

    const currentMonth = monthsWithData[0] || "2026-03";
    const previousMonth = monthsWithData[1] || monthsWithData[0] || "2026-02";

    console.log(`Available months: ${monthsWithData.join(", ")}`);
    console.log(`Using current month: ${currentMonth}, previous month: ${previousMonth}`);

    // Active members in current month
    const activeInCurrent = new Set(
      allCheckIns
        .filter(c => String(c.check_in_date || "").startsWith(currentMonth))
        .filter(c => String(c.member_id || "").startsWith("session-") === false)
        .map(c => c.member_id)
    ).size;

    // Current month revenue
    const currentMonthTotal = allCheckIns
      .filter(c => String(c.check_in_date || "").startsWith(currentMonth))
      .reduce((sum, c) => sum + (c.payment_amount || 0), 0);

    // Previous month revenue
    const previousMonthTotal = allCheckIns
      .filter(c => String(c.check_in_date || "").startsWith(previousMonth))
      .reduce((sum, c) => sum + (c.payment_amount || 0), 0);

    // Revenue percentage change
    const revenueChange =
      previousMonthTotal > 0
        ? ((currentMonthTotal - previousMonthTotal) / previousMonthTotal) * 100
        : 0;

    // Check-ins on the most recent date with data
    const mostRecentDate = allCheckIns[0]?.check_in_date || null;
    const checkInsOnMostRecentDate = mostRecentDate
      ? allCheckIns.filter(c => c.check_in_date === mostRecentDate).length
      : 0;

    return {
      totalMembers,
      activeMembers: activeInCurrent,
      currentMonthRevenue: parseFloat(currentMonthTotal.toFixed(2)),
      revenueChangePercent: parseFloat(revenueChange.toFixed(2)),
      checkInsToday: checkInsOnMostRecentDate,
      currentMonth: currentMonth,
      dataAvailable: true,
      mostRecentDate,
    };
  } catch (error) {
    console.error("Dashboard metrics error:", error);
    throw new Error(`Failed to fetch dashboard metrics: ${error.message}`);
  }
};

/**
 * Get weekly attendance data
 * @param {number} weeksBack - Number of weeks to go back (default: 1)
 * @returns {Promise<Array>}
 */
export const getWeeklyAttendance = async (weeksBack = 1) => {
  try {
    const data = await fetchAllCheckIns("check_in_date");

    if (!data || data.length === 0) {
      return [
        { day: "Sun", count: 0 },
        { day: "Mon", count: 0 },
        { day: "Tue", count: 0 },
        { day: "Wed", count: 0 },
        { day: "Thu", count: 0 },
        { day: "Fri", count: 0 },
        { day: "Sat", count: 0 },
      ];
    }

    // Find the most recent date in the data
    const mostRecentDate = new Date(data[0].check_in_date);
    
    // Go back 7 days from the most recent date
    const startDate = new Date(mostRecentDate.getTime() - 7 * 24 * 60 * 60 * 1000);
    const startDateStr = startDate.toISOString().split("T")[0];

    // Filter data for the past week from most recent date
    const weekData = data.filter(c => c.check_in_date >= startDateStr);

    // Aggregate by day of week
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const weeklyData = {
      Sun: 0,
      Mon: 0,
      Tue: 0,
      Wed: 0,
      Thu: 0,
      Fri: 0,
      Sat: 0,
    };

    weekData.forEach((check) => {
      const date = new Date(check.check_in_date);
      const dayName = dayNames[date.getDay()];
      weeklyData[dayName]++;
    });

    return Object.entries(weeklyData).map(([day, count]) => ({
      day,
      count,
    }));
  } catch (error) {
    throw new Error(`Failed to fetch weekly attendance: ${error.message}`);
  }
};

/**
 * Get peak hours data
 * @returns {Promise<Array>}
 */
export const getPeakHours = async () => {
  try {
    const data = await fetchAllCheckIns("check_in_time");

    // Extract hour from time and aggregate
    const hourlyData = Array.from({ length: GYM_CLOSE_HOUR - GYM_OPEN_HOUR + 1 }, (_, index) => ({
      hourNumber: GYM_OPEN_HOUR + index,
      hour: formatHourAmPm(GYM_OPEN_HOUR + index),
      count: 0,
    }));

    const hourlyMap = new Map(hourlyData.map((item) => [item.hourNumber, item]));

    data?.forEach((check) => {
      const hour = parseInt(String(check.check_in_time || "00:00:00").split(":")[0], 10);
      if (hour >= GYM_OPEN_HOUR && hour <= GYM_CLOSE_HOUR) {
        const slot = hourlyMap.get(hour);
        if (slot) slot.count++;
      }
    });

    // Filter out hours with zero activity
    return hourlyData
      .filter((h) => h.count > 0)
      .map(({ hour, count }) => ({ hour, count }));
  } catch (error) {
    throw new Error(`Failed to fetch peak hours: ${error.message}`);
  }
};

/**
 * Get revenue breakdown by month
 * @returns {Promise<Array>}
 */
export const getMonthlyRevenue = async () => {
  try {
    const data = await fetchAllCheckIns(
      "check_in_date, payment_amount, created_at"
    );

    // Aggregate by month
    const monthlyRevenue = {};
    data?.forEach((check) => {
      const monthSource = check.check_in_date || check.created_at?.slice(0, 10);
      if (!monthSource) return;

      const month = monthSource.slice(0, 7); // YYYY-MM
      const payment = Number(check.payment_amount || 0);

      if (!monthlyRevenue[month]) {
        monthlyRevenue[month] = 0;
      }

      monthlyRevenue[month] += Number.isFinite(payment) ? payment : 0;
    });

    return Object.entries(monthlyRevenue)
      .map(([month, revenue]) => ({
        month,
        revenue: parseFloat(revenue.toFixed(2)),
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
  } catch (error) {
    throw new Error(`Failed to fetch monthly revenue: ${error.message}`);
  }
};
