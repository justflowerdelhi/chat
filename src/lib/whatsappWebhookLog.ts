import pool from '@/lib/db';

export interface WhatsAppWebhookLogRow {
  id: string;
  member_id: number | null;
  phone_number_id: string;
  customer_phone: string | null;
  incoming_text: string | null;
  ai_reply: string | null;
  meta_status: number | null;
  error_message: string | null;
  latency_ms: number | null;
  received_at: string;
  replied_at: string | null;
}

export async function createWebhookLog(params: {
  memberId: number | null;
  phoneNumberId: string;
  customerPhone?: string | null;
  incomingText?: string | null;
  aiReply?: string | null;
  metaStatus?: number | null;
  errorMessage?: string | null;
  latencyMs?: number | null;
  repliedAt?: string | null;
}): Promise<void> {
  await pool.query(
    `INSERT INTO whatsapp_webhook_logs (
      member_id, phone_number_id, customer_phone, incoming_text, ai_reply,
      meta_status, error_message, latency_ms, received_at, replied_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9)`,
    [
      params.memberId ?? null,
      params.phoneNumberId,
      params.customerPhone ?? null,
      params.incomingText ?? null,
      params.aiReply ?? null,
      params.metaStatus ?? null,
      params.errorMessage ?? null,
      params.latencyMs ?? null,
      params.repliedAt ?? null,
    ]
  );
}

export async function getRecentWebhookLogs(
  memberId: number,
  limit = 20
): Promise<WhatsAppWebhookLogRow[]> {
  const result = await pool.query<WhatsAppWebhookLogRow>(
    `SELECT * FROM whatsapp_webhook_logs
     WHERE member_id = $1
     ORDER BY received_at DESC
     LIMIT $2`,
    [memberId, limit]
  );
  return result.rows;
}
