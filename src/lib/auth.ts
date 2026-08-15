import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import pool from '@/lib/db';
import { UserRow } from '@/types/user';

const SESSION_COOKIE_NAME = 'ifa_session';
const SESSION_SECRET = process.env.SESSION_SECRET || 'development-secret';

function createPasswordHash(password: string) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derivedKey}`;
}

function verifyPassword(password: string, storedHash: string) {
  const [salt, key] = storedHash.split(':');
  if (!salt || !key) {
    return false;
  }

  const derivedKey = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(key, 'hex'), Buffer.from(derivedKey, 'hex'));
}

function createSessionToken(userId: number) {
  const payload = JSON.stringify({ userId, iat: Date.now() });
  const encodedPayload = Buffer.from(payload, 'utf8').toString('base64');
  const signature = crypto.createHmac('sha256', SESSION_SECRET).update(encodedPayload).digest('hex');
  return `${encodedPayload}.${signature}`;
}

function verifySessionToken(token: string) {
  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) {
    return null;
  }

  try {
    const expectedSignature = crypto.createHmac('sha256', SESSION_SECRET).update(encodedPayload).digest('hex');
    const signatureBuffer = Buffer.from(signature, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');
    if (signatureBuffer.length !== expectedBuffer.length) {
      return null;
    }
    if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
      return null;
    }

    return JSON.parse(Buffer.from(encodedPayload, 'base64').toString('utf8')) as { userId: number; iat: number };
  } catch {
    return null;
  }
}

export async function getCurrentUser() {
  const cookiesStore = await cookies();
  const sessionCookie = cookiesStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionCookie) {
    return null;
  }

  const session = verifySessionToken(sessionCookie);
  if (!session?.userId) {
    return null;
  }

  const result = await pool.query<UserRow>('SELECT id, name, email, role, created_at, member_id FROM users WHERE id = $1', [session.userId]);
  return result.rowCount === 1 ? result.rows[0] : null;
}

export function attachSessionCookie(response: NextResponse, userId: number) {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: createSessionToken(userId),
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: '',
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    expires: new Date(0),
  });
  return response;
}

export { createPasswordHash, verifyPassword, verifySessionToken };
