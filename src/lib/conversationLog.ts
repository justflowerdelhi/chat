import pool from '@/lib/db';

interface CreateConversationLogParams {
  memberId: number;
  sessionId: string;
  customerPhone?: string;
  promptText?: string;
  openaiResponse?: string | null;
  outgoingReply?: string | null;
  model?: string;
  latencyMs?: number;
  errorMessage?: string;
  promptTokens?: number | null;
  completionTokens?: number | null;
}

export async function createConversationLog(params: CreateConversationLogParams): Promise<void> {
  await pool.query(
    `INSERT INTO conversation_logs (
      member_id, session_id, customer_phone, prompt_text, openai_response,
      outgoing_reply, model, latency_ms, error_message, prompt_tokens, completion_tokens
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      params.memberId,
      params.sessionId,
      params.customerPhone ?? null,
      params.promptText ?? null,
      params.openaiResponse ?? null,
      params.outgoingReply ?? null,
      params.model ?? null,
      params.latencyMs ?? null,
      params.errorMessage ?? null,
      params.promptTokens ?? null,
      params.completionTokens ?? null,
    ]
  );
}
