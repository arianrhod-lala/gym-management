import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const CHECK_INS_PAGE_SIZE = 1000;

const fetchAllCheckIns = async () => {
  const rows = [];
  let from = 0;

  while (true) {
    const to = from + CHECK_INS_PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("check_ins")
      .select("member_id,payment_amount,check_in_date,check_in_time")
      .order("check_in_date", { ascending: false })
      .order("check_in_time", { ascending: false })
      .range(from, to);

    if (error) throw error;
    if (!data || data.length === 0) break;

    rows.push(...data);

    if (data.length < CHECK_INS_PAGE_SIZE) break;
    from += CHECK_INS_PAGE_SIZE;
  }

  return rows;
};

const run = async () => {
  const { data: members, error: membersError } = await supabase
    .from("members")
    .select("id,name,membership_type");
  if (membersError) throw membersError;

  const checkIns = await fetchAllCheckIns();

  const paidByMember = new Map();
  const revenueByDate = new Map();

  for (const row of checkIns || []) {
    const amount = Number(row.payment_amount) || 0;
    paidByMember.set(row.member_id, (paidByMember.get(row.member_id) || 0) + amount);
    revenueByDate.set(
      row.check_in_date,
      (revenueByDate.get(row.check_in_date) || 0) + amount
    );
  }

  const memberList = members || [];
  const missing = memberList.filter((m) => (paidByMember.get(m.id) || 0) <= 0);
  const charged = memberList.filter((m) => (paidByMember.get(m.id) || 0) > 0);
  const totalRevenue = Array.from(revenueByDate.values()).reduce((a, b) => a + b, 0);
  const topDay = Array.from(revenueByDate.entries()).sort((a, b) => b[1] - a[1])[0] || [null, 0];

  console.log(JSON.stringify({
    members: memberList.length,
    chargedMembers: charged.length,
    missingMembers: missing.length,
    totalCheckIns: (checkIns || []).length,
    totalRevenue,
    expectedRevenue: memberList.length * 500,
    highestRevenueDate: topDay[0],
    highestRevenue: topDay[1],
    missingSample: missing.slice(0, 20).map((m) => m.name)
  }, null, 2));
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
