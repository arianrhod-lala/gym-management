import express from "express";
import * as memberController from "../controllers/memberController.js";
import { authMiddleware } from "../middleware/auth.js";

const router = express.Router();

router.get("/", authMiddleware, memberController.getAllMembers);
router.get("/:id", authMiddleware, memberController.getMemberById);
router.post("/", authMiddleware, memberController.createMember);
router.put("/:id", authMiddleware, memberController.updateMember);
router.delete("/:id", authMiddleware, memberController.deleteMember);

export default router;
