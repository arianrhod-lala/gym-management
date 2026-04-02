import * as checkInService from "../services/checkInService.js";

export const logCheckIn = async (req, res) => {
  try {
    const { member_id, payment_amount } = req.body;

    if (!member_id) {
      return res.status(400).json({ error: "member_id is required" });
    }

    const checkIn = await checkInService.logCheckIn({
      member_id,
      payment_amount,
    });

    res.status(201).json(checkIn);
  } catch (error) {
    console.error("Check-in error:", error);
    res.status(500).json({ error: error.message });
  }
};

export const getCheckIns = async (req, res) => {
  try {
    const { startDate, endDate, memberId } = req.query;
    const filters = {};

    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;
    if (memberId) filters.memberId = memberId;

    const checkIns = await checkInService.getCheckIns(filters);
    res.json(checkIns);
  } catch (error) {
    console.error("Fetch check-ins error:", error);
    res.status(500).json({ error: error.message });
  }
};

export const getTodayCheckIns = async (req, res) => {
  try {
    const checkIns = await checkInService.getTodayCheckIns();
    res.json(checkIns);
  } catch (error) {
    console.error("Fetch today's check-ins error:", error);
    res.status(500).json({ error: error.message });
  }
};
