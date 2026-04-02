import { supabase } from "../db/supabaseClient.js";
import { randomUUID } from "crypto";

/**
 * Get all members
 * @param {object} filters - { membershipType, searchName }
 * @returns {Promise<Array>}
 */
export const getAllMembers = async (filters = {}) => {
  try {
    let query = supabase.from("members").select("*");

    if (filters.membershipType) {
      query = query.eq("membership_type", filters.membershipType);
    }

    if (filters.searchName) {
      query = query.ilike("name", `%${filters.searchName}%`);
    }

    const { data, error } = await query.order("created_at", {
      ascending: false,
    });

    if (error) throw error;
    return data || [];
  } catch (error) {
    throw new Error(`Failed to fetch members: ${error.message}`);
  }
};

/**
 * Get member by ID
 * @param {string} memberId
 * @returns {Promise<object>}
 */
export const getMemberById = async (memberId) => {
  try {
    const { data, error } = await supabase
      .from("members")
      .select("*")
      .eq("id", memberId)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    throw new Error(`Failed to fetch member: ${error.message}`);
  }
};

/**
 * Create a new member
 * @param {object} memberData - { name, gender, membership_type }
 * @returns {Promise<object>}
 */
export const createMember = async (memberData) => {
  try {
    const memberId = randomUUID();

    // Insert member
    const { data, error } = await supabase
      .from("members")
      .insert([
        {
          id: memberId,
          name: memberData.name,
          gender: memberData.gender,
          membership_type: memberData.membership_type,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ])
      .select();

    if (error) throw error;

    return data[0];
  } catch (error) {
    throw new Error(`Failed to create member: ${error.message}`);
  }
};

/**
 * Update a member
 * @param {string} memberId
 * @param {object} updates - { name, gender, membership_type }
 * @returns {Promise<object>}
 */
export const updateMember = async (memberId, updates) => {
  try {
    const updateData = {
      ...updates,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("members")
      .update(updateData)
      .eq("id", memberId)
      .select();

    if (error) throw error;
    return data[0];
  } catch (error) {
    throw new Error(`Failed to update member: ${error.message}`);
  }
};

/**
 * Delete a member
 * @param {string} memberId
 * @returns {Promise<boolean>}
 */
export const deleteMember = async (memberId) => {
  try {
    const { error } = await supabase
      .from("members")
      .delete()
      .eq("id", memberId);

    if (error) throw error;
    return true;
  } catch (error) {
    throw new Error(`Failed to delete member: ${error.message}`);
  }
};
