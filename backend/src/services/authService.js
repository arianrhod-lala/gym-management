import { supabase } from "../db/supabaseClient.js";
import bcryptjs from "bcryptjs";
import jwt from "jsonwebtoken";

const isSupabaseConfigured = () =>
  Boolean(
    process.env.SUPABASE_URL &&
      (process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY)
  );

const getJwtSecret = () =>
  process.env.JWT_SECRET || "dev-local-jwt-secret-change-me";

const getDevCredentials = () => ({
  email: process.env.DEV_ADMIN_EMAIL || "admin@wynfitness.com",
  password: process.env.DEV_ADMIN_PASSWORD || "admin12345",
});

/**
 * Authenticate owner with email/password
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ user, token }>}
 */
export const loginOwner = async (email, password) => {
  try {
    const dev = getDevCredentials();
    const useDevFallback = (!isSupabaseConfigured() || email === dev.email) && process.env.NODE_ENV !== "production";

    if (useDevFallback) {
      if (email !== dev.email || password !== dev.password) {
        throw new Error("Invalid password");
      }

      const token = jwt.sign(
        { id: "dev-owner", email: dev.email },
        getJwtSecret(),
        { expiresIn: "24h" }
      );

      return {
        user: { id: "dev-owner", email: dev.email },
        token,
      };
    }

    // Get user from database
    const { data: users, error: queryError } = await supabase
      .from("users")
      .select("*")
      .eq("email", email);

    if (queryError) throw queryError;
    if (!users || users.length === 0) {
      throw new Error("User not found");
    }

    const user = users[0];

    // Compare password
    const isPasswordValid = await bcryptjs.compare(password, user.password_hash);
    if (!isPasswordValid) {
      throw new Error("Invalid password");
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email },
      getJwtSecret(),
      { expiresIn: "24h" }
    );

    return {
      user: { id: user.id, email: user.email },
      token,
    };
  } catch (error) {
    throw new Error(`Login failed: ${error.message}`);
  }
};

/**
 * Register a new owner (admin only - for initial setup)
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ user }>}
 */
export const registerOwner = async (email, password) => {
  try {
    if (!isSupabaseConfigured()) {
      throw new Error("Supabase is not configured for registration");
    }

    // Hash password
    const salt = await bcryptjs.genSalt(10);
    const passwordHash = await bcryptjs.hash(password, salt);

    // Insert user
    const { data, error } = await supabase
      .from("users")
      .insert([{ email, password_hash: passwordHash }])
      .select();

    if (error) throw error;

    return { user: { id: data[0].id, email: data[0].email } };
  } catch (error) {
    throw new Error(`Registration failed: ${error.message}`);
  }
};
