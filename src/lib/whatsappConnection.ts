import pool from '@/lib/db';

export interface WhatsAppConnectionRow {
  id: string;
  member_id: number;
  business_id: string | null;
  waba_id: string;
  phone_number_id: string;
  display_phone: string | null;
  access_token_encrypted: string;
  status: 'pending' | 'active' | 'disconnected' | 'error';
  created_at: string;
  updated_at: string;
}

export type WhatsAppConnectionPublic = Omit<WhatsAppConnectionRow, 'access_token_encrypted'>;

export function toPublicConnection(connection: WhatsAppConnectionRow): WhatsAppConnectionPublic {
  const { access_token_encrypted: _, ...publicConnection } = connection;
  return publicConnection;
}

export async function getWhatsAppConnectionByPhoneNumberId(
  phoneNumberId: string
): Promise<WhatsAppConnectionRow | null> {
  const result = await pool.query<WhatsAppConnectionRow>(
    'SELECT * FROM whatsapp_connections WHERE phone_number_id = $1 AND status = $2 LIMIT 1',
    [phoneNumberId, 'active']
  );
  return result.rowCount === 1 ? result.rows[0] : null;
}

export async function getWhatsAppConnectionByMemberId(
  memberId: number
): Promise<WhatsAppConnectionRow | null> {
  const result = await pool.query<WhatsAppConnectionRow>(
    'SELECT * FROM whatsapp_connections WHERE member_id = $1 ORDER BY created_at DESC LIMIT 1',
    [memberId]
  );
  return result.rowCount === 1 ? result.rows[0] : null;
}

export async function createWhatsAppConnection(
  memberId: number,
  businessId: string | null,
  wabaId: string,
  phoneNumberId: string,
  displayPhone: string | null,
  encryptedToken: string,
  status: 'pending' | 'active' | 'disconnected' | 'error' = 'active'
): Promise<WhatsAppConnectionRow> {
  const result = await pool.query<WhatsAppConnectionRow>(
    `INSERT INTO whatsapp_connections (
      member_id, business_id, waba_id, phone_number_id, display_phone, access_token_encrypted, status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (phone_number_id) DO UPDATE SET
      business_id = EXCLUDED.business_id,
      waba_id = EXCLUDED.waba_id,
      display_phone = EXCLUDED.display_phone,
      access_token_encrypted = EXCLUDED.access_token_encrypted,
      status = EXCLUDED.status,
      member_id = EXCLUDED.member_id,
      updated_at = NOW()
    RETURNING *`,
    [memberId, businessId, wabaId, phoneNumberId, displayPhone, encryptedToken, status]
  );
  return result.rows[0];
}

export async function updateWhatsAppConnectionStatus(
  id: string,
  status: 'pending' | 'active' | 'disconnected' | 'error'
): Promise<void> {
  await pool.query(
    'UPDATE whatsapp_connections SET status = $1, updated_at = NOW() WHERE id = $2',
    [status, id]
  );
}

export async function deleteWhatsAppConnectionByMemberId(memberId: number): Promise<void> {
  await pool.query('DELETE FROM whatsapp_connections WHERE member_id = $1', [memberId]);
}
