import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import db from '@/lib/db';

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

    // Verify session belongs to user
    const sessionCheck = await db.query(
      'SELECT id FROM chat_sessions WHERE id = $1 AND user_id = $2',
      [id, user.member_id]
    );

    if (sessionCheck.rowCount === 0) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const result = await db.query(
      `SELECT role, content 
       FROM chat_messages 
       WHERE session_id = $1 
       ORDER BY created_at ASC`,
      [id]
    );

    return NextResponse.json({ messages: result.rows });
  } catch (error) {
    console.error('Error loading session:', error);
    return NextResponse.json({ error: 'Failed to load session' }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user || !user.member_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Verify session belongs to user and delete
    const result = await db.query(
      'DELETE FROM chat_sessions WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, user.member_id]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting session:', error);
    return NextResponse.json({ error: 'Failed to delete session' }, { status: 500 });
  }
}
