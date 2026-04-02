import { supabase } from "../db/supabaseClient.js";
import bcryptjs from "bcryptjs";
import jwt from "jsonwebtoken";

/**
 * Authenticate owner with email/password
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ user, token }>}
 */
export const loginOwner = async (email, password) => {
  try {
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
      process.env.JWT_SECRET,
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
