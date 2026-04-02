import express from "express";
import cors from "cors";
import dotenv from "dotenv";

// Import routes
import authRoutes from "./routes/auth.js";
import memberRoutes from "./routes/members.js";
import checkInRoutes from "./routes/checkIns.js";
import analyticsRoutes from "./routes/analytics.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/members", memberRoutes);
app.use("/api/check-ins", checkInRoutes);
app.use("/api/analytics", analyticsRoutes);

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// Welcome route
app.get("/", (req, res) => {
  res.json({
    message: "Gym Management System API",
    status: "running",
    version: "1.0.0",
    endpoints: {
      auth: "/api/auth/login, /api/auth/register",
      members: "/api/members",
      checkIns: "/api/check-ins",
      analytics: "/api/analytics/dashboard",
    },
    docs: "See README.md for full API documentation",
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
