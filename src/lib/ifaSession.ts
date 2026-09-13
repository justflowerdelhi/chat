import db from './db';
import type { IfaMember } from './ifa/types';

export interface IfaMemberResultSnapshot {
  fetchedAt: string;
  members: IfaMember[];
  searchType: 'name' | 'city' | 'pincode' | 'nearest';
  searchQuery: string;
}

export interface IfaSessionState {
  lastMemberResult?: IfaMemberResultSnapshot;
}

const RESULT_TTL_MS = 15 * 60 * 1000; // 15 minutes

function isStale(snapshot?: IfaMemberResultSnapshot): boolean {
  if (!snapshot?.fetchedAt) return true;
  const fetchedAt = new Date(snapshot.fetchedAt).getTime();
  return Number.isNaN(fetchedAt) || Date.now() - fetchedAt > RESULT_TTL_MS;
}

export async function getIfaSessionState(
  sessionId: string
): Promise<IfaSessionState | null> {
  try {
    const result = await db.query<{ metadata: unknown }>(
      'SELECT metadata FROM chat_sessions WHERE id = $1',
      [sessionId]
    );

    const metadata = result.rows[0]?.metadata;
    if (!metadata || typeof metadata !== 'object') {
      return null;
    }

    const state = metadata as IfaSessionState;

    if (state.lastMemberResult && isStale(state.lastMemberResult)) {
      state.lastMemberResult = undefined;
    }

    return state;
  } catch (error) {
    console.error('Failed to get IFA session state:', error);
    return null;
  }
}

export async function saveIfaSessionState(
  sessionId: string,
  state: IfaSessionState | null
): Promise<void> {
  try {
    if (!state || Object.keys(state).length === 0) {
      await db.query(
        'UPDATE chat_sessions SET metadata = NULL, updated_at = NOW() WHERE id = $1',
        [sessionId]
      );
      return;
    }

    await db.query(
      'UPDATE chat_sessions SET metadata = $1, updated_at = NOW() WHERE id = $2',
      [JSON.stringify(state), sessionId]
    );
  } catch (error) {
    console.error('Failed to save IFA session state:', error);
  }
}

export async function clearIfaSessionState(sessionId: string): Promise<void> {
  await saveIfaSessionState(sessionId, null);
}

export async function saveMemberSearchResult(
  sessionId: string,
  members: IfaMember[],
  searchType: IfaMemberResultSnapshot['searchType'],
  searchQuery: string
): Promise<void> {
  const state = await getIfaSessionState(sessionId) || {};
  state.lastMemberResult = {
    fetchedAt: new Date().toISOString(),
    members,
    searchType,
    searchQuery,
  };
  await saveIfaSessionState(sessionId, state);
}

export async function getRecentMemberResult(
  sessionId: string
): Promise<IfaMemberResultSnapshot | null> {
  const state = await getIfaSessionState(sessionId);
  return state?.lastMemberResult || null;
}
