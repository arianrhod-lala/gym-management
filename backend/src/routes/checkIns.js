import express from "express";
import * as checkInController from "../controllers/checkInController.js";
import { authMiddleware } from "../middleware/auth.js";

const router = express.Router();

router.post("/", authMiddleware, checkInController.logCheckIn);
router.get("/", authMiddleware, checkInController.getCheckIns);
router.get("/today", authMiddleware, checkInController.getTodayCheckIns);

export default router;
