import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  clearLocatorState,
  getLocatorState,
  saveLocatorState,
} from '../locatorSession';
import db from '../db';

test('getLocatorState returns null when metadata is missing', async () => {
  let calls: unknown[][] = [];
  (db as any).query = async (sql: string, params: unknown[]) => {
    calls.push([sql, params]);
    return { rows: [{}] };
  };

  const state = await getLocatorState('session-1');
  assert.equal(state, null);
});

test('getLocatorState returns parsed metadata', async () => {
  (db as any).query = async () => ({
    rows: [
      {
        metadata: {
          pending: true,
          collectedPincode: '110060',
          lastResult: {
            city: 'New Delhi',
            pincode: '110060',
            fetchedAt: new Date().toISOString(),
            florists: [
              {
                name: 'Just Flowers',
                distanceKm: 0,
                distanceText: '1 m',
                businessType: 'Retail Florist Shop',
              },
            ],
          },
        },
      },
    ],
  });

  const state = await getLocatorState('session-1');
  assert.equal(state?.pending, true);
  assert.equal(state?.collectedPincode, '110060');
  assert.equal(state?.lastResult?.city, 'New Delhi');
});

test('getLocatorState discards stale lastResult', async () => {
  const staleDate = new Date(Date.now() - 20 * 60 * 1000).toISOString();
  (db as any).query = async () => ({
    rows: [
      {
        metadata: {
          lastResult: {
            city: 'New Delhi',
            pincode: '110060',
            fetchedAt: staleDate,
            florists: [],
          },
        },
      },
    ],
  });

  const state = await getLocatorState('session-1');
  assert.equal(state?.lastResult, undefined);
});

test('saveLocatorState writes metadata JSON', async () => {
  let captured: unknown[] = [];
  (db as any).query = async (sql: string, params: unknown[]) => {
    captured = [sql, params];
    return { rows: [] };
  };

  await saveLocatorState('session-1', { pending: true, collectedPincode: '110060' });

  assert.ok(captured[0] === 'UPDATE chat_sessions SET metadata = $1, updated_at = NOW() WHERE id = $2');
  assert.equal((captured[1] as unknown[])[1], 'session-1');
  const metadata = JSON.parse((captured[1] as unknown[])[0] as string);
  assert.equal(metadata.pending, true);
  assert.equal(metadata.collectedPincode, '110060');
});

test('clearLocatorState sets metadata to NULL', async () => {
  let captured: unknown[] = [];
  (db as any).query = async (sql: string, params: unknown[]) => {
    captured = [sql, params];
    return { rows: [] };
  };

  await clearLocatorState('session-1');

  assert.ok(captured[0] === 'UPDATE chat_sessions SET metadata = NULL, updated_at = NOW() WHERE id = $1');
  assert.deepEqual(captured[1], ['session-1']);
});
