import { NextResponse } from 'next/server';
import { verifyPassword, attachSessionCookie } from '@/lib/auth';
import pool from '@/lib/db';

interface UserRow {
  id: number;
  password_hash: string;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const email = String(formData.get('email') || '').trim();
    const password = String(formData.get('password') || '');

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const result = await pool.query<UserRow>('SELECT id, password_hash FROM users WHERE email = $1 LIMIT 1', [email]);

    if (result.rowCount === 0 || !result.rows[0]) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const user = result.rows[0];

    if (!verifyPassword(password, user.password_hash)) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const response = NextResponse.json({ ok: true });
    return attachSessionCookie(response, user.id);
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Database is unavailable. Check DATABASE_URL and the PostgreSQL server.' },
      { status: 503 }
    );
  }
}
