import { loginOwner, registerOwner } from "../services/authService.js";

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ error: "Email and password are required" });
    }

    const result = await loginOwner(email, password);
    res.json(result);
  } catch (error) {
    console.error("Login error:", error);
    res.status(401).json({ error: error.message });
  }
};

export const register = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ error: "Email and password are required" });
    }

    const result = await registerOwner(email, password);
    res.status(201).json(result);
  } catch (error) {
    console.error("Register error:", error);
    res.status(400).json({ error: error.message });
  }
};
