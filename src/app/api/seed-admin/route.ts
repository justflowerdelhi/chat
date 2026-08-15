import { NextResponse } from 'next/server';
import { createPasswordHash } from '@/lib/auth';
import pool from '@/lib/db';

const SEED_SECRET = 'floraprise-test';

function escapeValue(value: string): string {
  return value.replace(/'/g, "''");
}

async function ensureTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS members (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      external_company_id UUID UNIQUE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255),
      email VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL DEFAULT 'admin',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      member_id INTEGER REFERENCES members(id) ON DELETE SET NULL,
      password_hash TEXT NOT NULL
    )
  `);
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  if (searchParams.get('secret') !== SEED_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    await ensureTables();
    const existing = await pool.query('SELECT COUNT(*)::int as c FROM users');
    if (existing.rows[0].c > 0) {
      const first = await pool.query('SELECT email FROM users LIMIT 1');
      return NextResponse.json({ message: 'A user already exists', email: first.rows[0].email });
    }

    const memberColumns = await pool.query(
      `SELECT column_name, data_type, is_nullable, column_default
       FROM information_schema.columns
       WHERE table_name = 'members' AND table_schema = 'public'
       ORDER BY ordinal_position`
    );

    if (memberColumns.rowCount === 0) {
      return NextResponse.json({ error: 'members table not found' }, { status: 500 });
    }

    const requiredMember = memberColumns.rows.filter(
      (c: Record<string, unknown>) => c.is_nullable === 'NO' && !c.column_default && c.column_name !== 'id'
    );

    const memberColNames: string[] = [];
    const memberValues: string[] = [];
    for (const c of requiredMember) {
      memberColNames.push(c.column_name as string);
      if (c.data_type === 'timestamp without time zone' || c.data_type === 'timestamp with time zone') {
        memberValues.push('NOW()');
      } else if (c.data_type === 'integer' || c.data_type === 'numeric' || c.data_type === 'bigint' || c.data_type === 'smallint') {
        memberValues.push('0');
      } else {
        memberValues.push("'Floraprise'");
      }
    }

    const memberResult = await pool.query(
      `INSERT INTO members (${memberColNames.join(', ')}) VALUES (${memberValues.join(', ')}) RETURNING id`
    );
    const memberId = memberResult.rows[0].id;

    const userColumns = await pool.query(
      `SELECT column_name, data_type, is_nullable, column_default
       FROM information_schema.columns
       WHERE table_name = 'users' AND table_schema = 'public'
       ORDER BY ordinal_position`
    );

    const requiredUser = userColumns.rows.filter(
      (c: Record<string, unknown>) =>
        ['member_id', 'email', 'password_hash', 'role'].includes(c.column_name as string) ||
        (c.is_nullable === 'NO' && !c.column_default && c.column_name !== 'id')
    );

    const email = 'admin@floraprise.com';
    const password = 'floraadmin';
    const hash = createPasswordHash(password);

    const userColNames: string[] = [];
    const userValues: string[] = [];
    for (const c of requiredUser) {
      userColNames.push(c.column_name as string);
      if (c.column_name === 'member_id') {
        userValues.push(String(memberId));
      } else if (c.column_name === 'password_hash') {
        userValues.push(`'${escapeValue(hash)}'`);
      } else if (c.column_name === 'email') {
        userValues.push(`'${escapeValue(email)}'`);
      } else if (c.column_name === 'role') {
        userValues.push("'admin'");
      } else if (c.data_type === 'timestamp without time zone' || c.data_type === 'timestamp with time zone') {
        userValues.push('NOW()');
      } else if (c.data_type === 'integer' || c.data_type === 'numeric' || c.data_type === 'bigint' || c.data_type === 'smallint') {
        userValues.push('0');
      } else {
        userValues.push("'Floraprise Admin'");
      }
    }

    await pool.query(
      `INSERT INTO users (${userColNames.join(', ')}) VALUES (${userValues.join(', ')})`
    );

    return NextResponse.json({ email, password });
  } catch (error) {
    console.error('Seed admin error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
