import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getOpenAI } from '@/lib/openaiClient';
import { decryptToken } from '@/lib/encryption';

interface HealthResult {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  checks: {
    database: { ok: boolean; latencyMs: number };
    openai: { ok: boolean; latencyMs: number };
    meta?: { ok: boolean; latencyMs: number };
    webhookLatency?: { p50Ms: number | null; p95Ms: number | null };
    openaiLatency?: { p50Ms: number | null; p95Ms: number | null };
  };
}

export async function GET() {
  const result: HealthResult = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    checks: {
      database: { ok: false, latencyMs: 0 },
      openai: { ok: false, latencyMs: 0 },
    },
  };

  const dbStart = Date.now();
  try {
    await pool.query('SELECT 1');
    result.checks.database = { ok: true, latencyMs: Date.now() - dbStart };
  } catch {
    result.checks.database = { ok: false, latencyMs: Date.now() - dbStart };
    result.status = 'degraded';
  }

  const openaiStart = Date.now();
  try {
    await getOpenAI().models.list();
    result.checks.openai = { ok: true, latencyMs: Date.now() - openaiStart };
  } catch {
    result.checks.openai = { ok: false, latencyMs: Date.now() - openaiStart };
    result.status = 'degraded';
  }

  const connectionResult = await pool.query(
    "SELECT phone_number_id, access_token_encrypted FROM whatsapp_connections WHERE status='active' LIMIT 1"
  );
  const connectionRow = connectionResult.rows[0];

  if (connectionRow) {
    const metaStart = Date.now();
    try {
      const accessToken = decryptToken(connectionRow.access_token_encrypted);
      const response = await fetch(
        `https://graph.facebook.com/v20.0/${connectionRow.phone_number_id}?fields=verified_name&access_token=${encodeURIComponent(accessToken)}`,
        { method: 'GET' }
      );
      result.checks.meta = { ok: response.ok, latencyMs: Date.now() - metaStart };
      if (!response.ok) result.status = 'degraded';
    } catch {
      result.checks.meta = { ok: false, latencyMs: Date.now() - metaStart };
      result.status = 'degraded';
    }
  }

  const latencyResult = await pool.query(
    `SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY latency_ms) AS p50,
            percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms) AS p95
     FROM whatsapp_webhook_logs
     WHERE received_at > NOW() - INTERVAL '24 hours' AND latency_ms IS NOT NULL`
  );
  result.checks.webhookLatency = {
    p50Ms: latencyResult.rows[0]?.p50 ? Math.round(Number(latencyResult.rows[0].p50)) : null,
    p95Ms: latencyResult.rows[0]?.p95 ? Math.round(Number(latencyResult.rows[0].p95)) : null,
  };

  const openaiLatencyResult = await pool.query(
    `SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY latency_ms) AS p50,
            percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms) AS p95
     FROM conversation_logs
     WHERE created_at > NOW() - INTERVAL '24 hours' AND latency_ms IS NOT NULL`
  );
  result.checks.openaiLatency = {
    p50Ms: openaiLatencyResult.rows[0]?.p50 ? Math.round(Number(openaiLatencyResult.rows[0].p50)) : null,
    p95Ms: openaiLatencyResult.rows[0]?.p95 ? Math.round(Number(openaiLatencyResult.rows[0].p95)) : null,
  };

  if (result.status !== 'ok') {
    return NextResponse.json(result, { status: 503 });
  }

  return NextResponse.json(result);
}
