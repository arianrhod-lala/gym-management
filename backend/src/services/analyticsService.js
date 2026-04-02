import { supabase } from "../db/supabaseClient.js";

/**
 * Get dashboard metrics
 * @returns {Promise<object>}
 */
export const getDashboardMetrics = async () => {
  try {
    // Get total members
    const { data: members, error: membersError } = await supabase
      .from("members")
      .select("id");

    if (membersError) throw membersError;

    const totalMembers = members?.length || 0;

    // Get all check-in data
    const { data: allCheckIns, error: checkInsError } = await supabase
      .from("check_ins")
      .select("member_id, check_in_date, payment_amount")
      .order("check_in_date", { ascending: false });

    if (checkInsError) throw checkInsError;

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
      allCheckIns.map(c => c.check_in_date.slice(0, 7))
    )].sort().reverse();

    const currentMonth = monthsWithData[0] || "2026-03";
    const previousMonth = monthsWithData[1] || monthsWithData[0] || "2026-02";

    console.log(`Available months: ${monthsWithData.join(", ")}`);
    console.log(`Using current month: ${currentMonth}, previous month: ${previousMonth}`);

    // Active members in current month
    const activeInCurrent = new Set(
      allCheckIns
        .filter(c => c.check_in_date.startsWith(currentMonth))
        .map(c => c.member_id)
    ).size;

    // Current month revenue
    const currentMonthTotal = allCheckIns
      .filter(c => c.check_in_date.startsWith(currentMonth))
      .reduce((sum, c) => sum + (c.payment_amount || 0), 0);

    // Previous month revenue
    const previousMonthTotal = allCheckIns
      .filter(c => c.check_in_date.startsWith(previousMonth))
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
    // Get all check-in data
    const { data, error } = await supabase
      .from("check_ins")
      .select("check_in_date")
      .order("check_in_date", { ascending: false })
      .limit(1000);

    if (error) throw error;

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
    const { data, error } = await supabase
      .from("check_ins")
      .select("check_in_time");

    if (error) throw error;

    // Extract hour from time and aggregate
    const hourlyData = Array.from({ length: 24 }, (_, i) => ({
      hour: `${String(i).padStart(2, "0")}:00`,
      count: 0,
    }));

    data?.forEach((check) => {
      const hour = parseInt(check.check_in_time.split(":")[0]);
      if (hour >= 0 && hour < 24) {
        hourlyData[hour].count++;
      }
    });

    // Filter out hours with zero activity
    return hourlyData.filter((h) => h.count > 0);
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
    // Get data for last 12 months
    const { data, error } = await supabase
      .from("check_ins")
      .select("check_in_date, payment_amount");

    if (error) throw error;

    // Aggregate by month
    const monthlyRevenue = {};
    data?.forEach((check) => {
      const month = check.check_in_date.slice(0, 7); // YYYY-MM
      if (!monthlyRevenue[month]) {
        monthlyRevenue[month] = 0;
      }
      monthlyRevenue[month] += check.payment_amount || 0;
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
