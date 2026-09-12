import db from './db';
import type { FloritribeFlorist } from './floritribeLocator';

export interface LocatorResultSnapshot {
  city: string;
  pincode: string;
  fetchedAt: string;
  florists: FloritribeFlorist[];
  prompt?: 'contact-offer' | 'contact-details';
}

export interface LocatorSessionState {
  pending?: boolean;
  collectedCity?: string;
  collectedPincode?: string;
  lastResult?: LocatorResultSnapshot;
}

const RESULT_TTL_MS = 15 * 60 * 1000; // 15 minutes

function isStale(snapshot?: LocatorResultSnapshot): boolean {
  if (!snapshot?.fetchedAt) return true;
  const fetchedAt = new Date(snapshot.fetchedAt).getTime();
  return Number.isNaN(fetchedAt) || Date.now() - fetchedAt > RESULT_TTL_MS;
}

export async function getLocatorState(
  sessionId: string
): Promise<LocatorSessionState | null> {
  try {
    const result = await db.query<{ metadata: unknown }>(
      'SELECT metadata FROM chat_sessions WHERE id = $1',
      [sessionId]
    );

    const metadata = result.rows[0]?.metadata;
    if (!metadata || typeof metadata !== 'object') {
      return null;
    }

    const state = metadata as LocatorSessionState;

    if (state.lastResult && isStale(state.lastResult)) {
      state.lastResult = undefined;
    }

    return state;
  } catch (error) {
    console.error('Failed to get locator state:', error);
    return null;
  }
}

export async function saveLocatorState(
  sessionId: string,
  state: LocatorSessionState | null
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
    console.error('Failed to save locator state:', error);
  }
}

export async function clearLocatorState(sessionId: string): Promise<void> {
  await saveLocatorState(sessionId, null);
}
