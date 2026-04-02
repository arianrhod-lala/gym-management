import * as analyticsService from "../services/analyticsService.js";

export const getDashboard = async (req, res) => {
  try {
    const metrics = await analyticsService.getDashboardMetrics();
    res.json(metrics);
  } catch (error) {
    console.error("Dashboard error:", error);
    res.status(500).json({ error: error.message });
  }
};

export const getRevenue = async (req, res) => {
  try {
    const revenue = await analyticsService.getMonthlyRevenue();
    res.json(revenue);
  } catch (error) {
    console.error("Revenue error:", error);
    res.status(500).json({ error: error.message });
  }
};

export const getPeakHours = async (req, res) => {
  try {
    const peakHours = await analyticsService.getPeakHours();
    res.json(peakHours);
  } catch (error) {
    console.error("Peak hours error:", error);
    res.status(500).json({ error: error.message });
  }
};

export const getWeeklyAttendance = async (req, res) => {
  try {
    const { weeksBack } = req.query;
    const attendance = await analyticsService.getWeeklyAttendance(
      weeksBack ? parseInt(weeksBack) : 1
    );
    res.json(attendance);
  } catch (error) {
    console.error("Weekly attendance error:", error);
    res.status(500).json({ error: error.message });
  }
};
