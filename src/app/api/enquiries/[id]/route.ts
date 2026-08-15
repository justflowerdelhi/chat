import { NextResponse } from 'next/server';
import type { QueryResultRow } from 'pg';
import { getCurrentUser } from '@/lib/auth';
import db from '@/lib/db';

interface EnquiryDetailRow extends QueryResultRow {
  id: string;
  created_at: string;
  conversation_id: string;
  customer_name: string | null;
  phone: string | null;
  occasion: string | null;
  budget: string | null;
  delivery_date: string | null;
  delivery_city: string | null;
  recipient: string | null;
  recommended_products: string | null;
  special_instructions: string | null;
  summary: Record<string, unknown> | null;
  lead_quality: string | null;
  conversation_confidence: number | null;
  priority: string;
  status: string;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user || !user.member_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const result = await db.query<EnquiryDetailRow>(
      `SELECT e.*
       FROM enquiries e
       JOIN chat_sessions cs ON cs.id = e.conversation_id
       WHERE e.id = $1 AND cs.user_id = $2`,
      [id, user.member_id]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Enquiry not found' }, { status: 404 });
    }

    return NextResponse.json({ enquiry: result.rows[0] });
  } catch (error) {
    console.error('Error loading enquiry:', error);
    return NextResponse.json({ error: 'Failed to load enquiry' }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user || !user.member_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const status = body.status;

    if (status !== 'Pending' && status !== 'Contacted' && status !== 'Closed') {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const result = await db.query<EnquiryDetailRow>(
      `UPDATE enquiries e
       SET status = $1
       FROM chat_sessions cs
       WHERE e.id = $2 AND e.conversation_id = cs.id AND cs.user_id = $3
       RETURNING e.*`,
      [status, id, user.member_id]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Enquiry not found' }, { status: 404 });
    }

    return NextResponse.json({ enquiry: result.rows[0] });
  } catch (error) {
    console.error('Error updating enquiry:', error);
    return NextResponse.json({ error: 'Failed to update enquiry' }, { status: 500 });
  }
}