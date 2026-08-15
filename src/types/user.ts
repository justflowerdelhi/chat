export interface UserRow {
  id: number;
  name: string | null;
  email: string;
  role: string;
  created_at: string;
  member_id?: number | null;
}
