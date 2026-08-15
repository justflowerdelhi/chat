import { NextResponse } from 'next/server';
import type { QueryResultRow } from 'pg';
import { getCurrentUser } from '@/lib/auth';
import db from '@/lib/db';

interface EnquiryListRow extends QueryResultRow {
  id: string;
  created_at: string;
  customer_name: string | null;
  occasion: string | null;
  budget: string | null;
  delivery_date: string | null;
  delivery_city: string | null;
  priority: string;
  status: string;
}

interface CountRow extends QueryResultRow {
  count: string;
}

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user || !user.member_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await db.query<EnquiryListRow>(
      `SELECT e.id, e.created_at, e.customer_name, e.occasion, e.budget, e.delivery_date,
              e.delivery_city, e.priority, e.status
       FROM enquiries e
       JOIN chat_sessions cs ON cs.id = e.conversation_id
       WHERE cs.user_id = $1
       ORDER BY e.created_at DESC`,
      [user.member_id]
    );

    const todayConversations = await db.query<CountRow>(
      `SELECT COUNT(*) as count
       FROM chat_sessions
       WHERE user_id = $1
         AND created_at >= CURRENT_DATE
         AND created_at < CURRENT_DATE + INTERVAL '1 day'`,
      [user.member_id]
    );

    const todayEnquiries = await db.query<CountRow>(
      `SELECT COUNT(*) as count
       FROM enquiries e
       JOIN chat_sessions cs ON cs.id = e.conversation_id
       WHERE cs.user_id = $1
         AND e.created_at >= CURRENT_DATE
         AND e.created_at < CURRENT_DATE + INTERVAL '1 day'`,
      [user.member_id]
    );

    const pendingFollowUps = await db.query<CountRow>(
      `SELECT COUNT(*) as count
       FROM enquiries e
       JOIN chat_sessions cs ON cs.id = e.conversation_id
       WHERE cs.user_id = $1 AND e.status = 'Pending'`,
      [user.member_id]
    );

    const closedToday = await db.query<CountRow>(
      `SELECT COUNT(*) as count
       FROM enquiries e
       JOIN chat_sessions cs ON cs.id = e.conversation_id
       WHERE cs.user_id = $1
         AND e.status = 'Closed'
         AND e.created_at >= CURRENT_DATE
         AND e.created_at < CURRENT_DATE + INTERVAL '1 day'`,
      [user.member_id]
    );

    return NextResponse.json({
      enquiries: result.rows,
      floristName: user.name,
      stats: {
        todayConversations: Number(todayConversations.rows[0]?.count || 0),
        todayEnquiries: Number(todayEnquiries.rows[0]?.count || 0),
        pendingFollowUps: Number(pendingFollowUps.rows[0]?.count || 0),
        closedToday: Number(closedToday.rows[0]?.count || 0),
      },
    });
  } catch (error) {
    console.error('Error fetching enquiries:', error);
    return NextResponse.json({ error: 'Failed to fetch enquiries' }, { status: 500 });
  }
}