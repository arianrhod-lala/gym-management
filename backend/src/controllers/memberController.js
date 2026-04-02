import * as memberService from "../services/memberService.js";

export const getAllMembers = async (req, res) => {
  try {
    const { membershipType, searchName } = req.query;
    const filters = {};

    if (membershipType) filters.membershipType = membershipType;
    if (searchName) filters.searchName = searchName;

    const members = await memberService.getAllMembers(filters);
    res.json(members);
  } catch (error) {
    console.error("Fetch members error:", error);
    res.status(500).json({ error: error.message });
  }
};

export const getMemberById = async (req, res) => {
  try {
    const member = await memberService.getMemberById(req.params.id);
    res.json(member);
  } catch (error) {
    console.error("Fetch member error:", error);
    res.status(500).json({ error: error.message });
  }
};

export const createMember = async (req, res) => {
  try {
    const { name, gender, membership_type } = req.body;

    if (!name || !gender || !membership_type) {
      return res
        .status(400)
        .json({ error: "Name, gender, and membership_type are required" });
    }

    const member = await memberService.createMember({
      name,
      gender,
      membership_type,
    });

    res.status(201).json(member);
  } catch (error) {
    console.error("Create member error:", error);
    res.status(400).json({ error: error.message });
  }
};

export const updateMember = async (req, res) => {
  try {
    const member = await memberService.updateMember(req.params.id, req.body);
    res.json(member);
  } catch (error) {
    console.error("Update member error:", error);
    res.status(400).json({ error: error.message });
  }
};

export const deleteMember = async (req, res) => {
  try {
    await memberService.deleteMember(req.params.id);
    res.json({ message: "Member deleted successfully" });
  } catch (error) {
    console.error("Delete member error:", error);
    res.status(400).json({ error: error.message });
  }
};
