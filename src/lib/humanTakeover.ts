import pool from '@/lib/db';

interface HumanTakeoverRow {
  id: string;
  member_id: number;
  active: boolean;
  taken_by: string | null;
  started_at: string | null;
}

export async function isHumanTakeoverActive(memberId: number): Promise<boolean> {
  const result = await pool.query<HumanTakeoverRow>(
    'SELECT active FROM human_takeover WHERE member_id = $1 LIMIT 1',
    [memberId]
  );
  return result.rowCount === 1 ? result.rows[0].active : false;
}
