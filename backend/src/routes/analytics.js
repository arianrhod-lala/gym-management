import express from "express";
import * as analyticsController from "../controllers/analyticsController.js";

const router = express.Router();

router.get("/dashboard", analyticsController.getDashboard);
router.get("/revenue", analyticsController.getRevenue);
router.get("/peak-hours", analyticsController.getPeakHours);
router.get("/weekly-attendance", analyticsController.getWeeklyAttendance);

export default router;
