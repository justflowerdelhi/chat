import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  findFloristByNameOrNearest,
  formatFloristContact,
  formatFloristList,
  getNearestFlorists,
} from '../floritribeLocator';

const originalFetch = globalThis.fetch;

test('getNearestFlorists returns parsed florists', async () => {
  globalThis.fetch = async () =>
    ({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        origin: 'Test',
        count: 2,
        florists: [
          {
            florist: 'Just Flowers',
            distanceKm: 0.8,
            distanceText: '0.8 km',
            businessType: 'Retail',
            address: '123 Market Road',
            phone: '+91-9876543210',
            slug: 'just-flowers',
          },
          {
            name: 'Rose n petals',
            distanceKm: 2.5,
            distanceText: '2.5 km',
            businessType: 'Retail',
          },
        ],
      }),
    }) as Response;

  process.env.FLORITRIBE_NEAREST_FLORIST_API_URL = 'https://floritribe.test/nearest';
  process.env.FLORITRIBE_NEAREST_FLORIST_API_KEY = 'test-key';

  const florists = await getNearestFlorists({
    city: 'New Delhi',
    pincode: '110060',
    limit: 3,
  });

  assert.equal(florists.length, 2);
  assert.equal(florists[0].name, 'Just Flowers');
  assert.equal(florists[0].distanceText, '0.8 km');
  assert.equal(florists[0].address, '123 Market Road');
  assert.equal(florists[0].phone, '+91-9876543210');
  assert.equal(florists[1].name, 'Rose n petals');
  assert.equal(florists[1].distanceText, '2.5 km');
});

test('getNearestFlorists throws when success is false', async () => {
  globalThis.fetch = async () =>
    ({
      ok: true,
      status: 200,
      json: async () => ({ success: false }),
    }) as Response;

  process.env.FLORITRIBE_NEAREST_FLORIST_API_URL = 'https://floritribe.test/nearest';
  process.env.FLORITRIBE_NEAREST_FLORIST_API_KEY = 'test-key';

  await assert.rejects(
    getNearestFlorists({ city: 'New Delhi', pincode: '110060' }),
    /Floritribe API returned no results/
  );
});

test('getNearestFlorists throws when API is unavailable', async () => {
  globalThis.fetch = async () => {
    throw new Error('network error');
  };

  process.env.FLORITRIBE_NEAREST_FLORIST_API_URL = 'https://floritribe.test/nearest';
  process.env.FLORITRIBE_NEAREST_FLORIST_API_KEY = 'test-key';

  await assert.rejects(
    getNearestFlorists({ city: 'New Delhi', pincode: '110060' }),
    /Floritribe API request failed/
  );
});

test('getNearestFlorists throws request failed for HTTP error with JSON body', async () => {
  // A Cloudflare 502 page is valid JSON; without a response.ok check it used
  // to surface as the misleading "returned no results".
  globalThis.fetch = async () =>
    ({
      ok: false,
      status: 502,
      json: async () => ({
        title: 'Error 502: Bad gateway',
        status: 502,
      }),
    }) as Response;

  process.env.FLORITRIBE_NEAREST_FLORIST_API_URL = 'https://floritribe.test/nearest';
  process.env.FLORITRIBE_NEAREST_FLORIST_API_KEY = 'test-key';

  await assert.rejects(
    getNearestFlorists({ city: 'Mumbai', pincode: '400001' }),
    /Floritribe API request failed: 502/
  );
});

test('getNearestFlorists returns empty array when florists is empty', async () => {
  globalThis.fetch = async () =>
    ({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        count: 0,
        florists: [],
        message: 'No registered florist found for this location.',
      }),
    }) as Response;

  process.env.FLORITRIBE_NEAREST_FLORIST_API_URL = 'https://floritribe.test/nearest';
  process.env.FLORITRIBE_NEAREST_FLORIST_API_KEY = 'test-key';

  const florists = await getNearestFlorists({
    city: 'Bombay',
    pincode: '400001',
  });

  assert.deepEqual(florists, []);
});

test('getNearestFlorists includes API error detail when success is false', async () => {
  globalThis.fetch = async () =>
    ({
      ok: true,
      status: 200,
      json: async () => ({ success: false, error: 'Invalid city.' }),
    }) as Response;

  process.env.FLORITRIBE_NEAREST_FLORIST_API_URL = 'https://floritribe.test/nearest';
  process.env.FLORITRIBE_NEAREST_FLORIST_API_KEY = 'test-key';

  await assert.rejects(
    getNearestFlorists({ city: 'New Delhi', pincode: '110060' }),
    /Floritribe API error: Invalid city\./
  );
});

test('getNearestFlorists throws for invalid pincode', async () => {
  process.env.FLORITRIBE_NEAREST_FLORIST_API_URL = 'https://floritribe.test/nearest';
  process.env.FLORITRIBE_NEAREST_FLORIST_API_KEY = 'test-key';

  await assert.rejects(
    getNearestFlorists({ city: 'New Delhi', pincode: '11006' }),
    /valid 6-digit PIN code/
  );
});

test('formatFloristList includes up to 3 florists', () => {
  const florists = [
    { name: 'A', distanceKm: 1, distanceText: '1 km', businessType: 'Retail' },
    { name: 'B', distanceKm: 2, distanceText: '2 km', businessType: 'Retail' },
    { name: 'C', distanceKm: 3, distanceText: '3 km', businessType: 'Retail' },
    { name: 'D', distanceKm: 4, distanceText: '4 km', businessType: 'Retail' },
  ] as const;

  const output = formatFloristList(florists as any, 'New Delhi', '110060');

  assert.ok(output.includes('110060, New Delhi'));
  assert.ok(output.includes('1. A'));
  assert.ok(output.includes('2. B'));
  assert.ok(output.includes('3. C'));
  assert.ok(!output.includes('4. D'));
});

test('formatFloristList shows no results message for empty list', () => {
  const output = formatFloristList([], 'New Delhi', '110060');
  assert.ok(output.includes("couldn't find an IFA florist"));
});

test('formatFloristList can include address details', () => {
  const florists = [
    {
      name: 'Just Flowers',
      distanceKm: 0.8,
      distanceText: '0.8 km',
      businessType: 'Retail',
      address: '123 Market Road',
      phone: '+91-9876543210',
    },
  ];

  const output = formatFloristList(florists as any, 'New Delhi', '110060');
  assert.ok(output.includes('Just Flowers — 0.8 km'));
  assert.ok(output.includes('123 Market Road'));
  assert.ok(!output.includes('Phone:'));
});

test('findFloristByNameOrNearest returns exact name match', () => {
  const florists = [
    { name: 'Just Flowers', distanceKm: 1, distanceText: '1 km', businessType: 'Retail' },
    { name: 'Rose n petals', distanceKm: 2, distanceText: '2 km', businessType: 'Retail' },
  ] as any;

  const match = findFloristByNameOrNearest(florists, 'Rose n petals');
  assert.equal(match?.name, 'Rose n petals');
});

test('findFloristByNameOrNearest falls back to nearest when no name given', () => {
  const florists = [
    { name: 'Just Flowers', distanceKm: 1, distanceText: '1 km', businessType: 'Retail' },
    { name: 'Rose n petals', distanceKm: 2, distanceText: '2 km', businessType: 'Retail' },
  ] as any;

  const match = findFloristByNameOrNearest(florists);
  assert.equal(match?.name, 'Just Flowers');
});

test('formatFloristContact includes phone and address', () => {
  const florist = {
    name: 'Just Flowers',
    distanceKm: 1,
    distanceText: '1 km',
    businessType: 'Retail',
    phone: '+91-9876543210',
    address: '123 Market Road',
  } as any;

  const output = formatFloristContact(florist);
  assert.ok(output.startsWith('Just Flowers'));
  assert.ok(output.includes('📍 123 Market Road'));
  assert.ok(output.includes('📞 +91-9876543210'));
});

test('formatFloristContact handles missing phone and address', () => {
  const florist = {
    name: 'Rose n petals',
    distanceKm: 2,
    distanceText: '2 km',
    businessType: 'Retail',
  } as any;

  const output = formatFloristContact(florist);
  assert.ok(output.startsWith('Rose n petals'));
  assert.ok(output.includes('📞 Phone number not available'));
  assert.ok(output.includes('📍 Address not available'));
});

test('formatFloristContact returns name, address and phone for a named florist', () => {
  const florists = [
    {
      name: 'Rami Flowers',
      distanceKm: 0,
      distanceText: 'Same PIN code',
      businessType: 'Retail',
      phone: '1111111111',
      address: '123 Market Road',
    },
    {
      name: 'Rami Brothers',
      distanceKm: 3.9,
      distanceText: '3.9 km',
      businessType: 'Retail',
      phone: '2222222222',
      address: '456 Garden Lane',
    },
  ] as any;

  const match = findFloristByNameOrNearest(florists, 'Need contact no. of Rami Brothers');
  assert.equal(match?.name, 'Rami Brothers');
  const output = formatFloristContact(match!);
  assert.ok(output.includes('Rami Brothers'));
  assert.ok(output.includes('📍 456 Garden Lane'));
  assert.ok(output.includes('📞 2222222222'));
});

test('getNearestFlorists shows Same PIN code when distance is zero without coordinates', async () => {
  globalThis.fetch = async () =>
    ({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        origin: { pincode: '110060', city: 'New Delhi' },
        count: 1,
        florists: [
          {
            name: 'Same PIN Florist',
            distanceKm: 0,
            distanceText: '1 m',
            businessType: 'Retail',
            address: 'Same PIN Road',
            phone: '9999999999',
          },
        ],
      }),
    }) as Response;

  process.env.FLORITRIBE_NEAREST_FLORIST_API_URL = 'https://floritribe.test/nearest';
  process.env.FLORITRIBE_NEAREST_FLORIST_API_KEY = 'test-key';

  const florists = await getNearestFlorists({
    city: 'New Delhi',
    pincode: '110060',
    limit: 3,
  });

  assert.equal(florists.length, 1);
  assert.equal(florists[0].distanceText, 'Same PIN code');
  assert.equal(florists[0].address, 'Same PIN Road');
});

test('getNearestFlorists calculates real distance when coordinates are provided', async () => {
  globalThis.fetch = async () =>
    ({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        origin: { pincode: '110060', city: 'New Delhi' },
        count: 2,
        florists: [
          {
            name: 'Nearby Florist',
            distanceKm: 0,
            distanceText: '1 m',
            businessType: 'Retail',
            latitude: 28.62,
            longitude: 77.215,
          },
          {
            name: 'Far Florist',
            distanceKm: 0,
            distanceText: '1 m',
            businessType: 'Retail',
            latitude: 28.63,
            longitude: 77.23,
          },
        ],
      }),
    }) as Response;

  process.env.FLORITRIBE_NEAREST_FLORIST_API_URL = 'https://floritribe.test/nearest';
  process.env.FLORITRIBE_NEAREST_FLORIST_API_KEY = 'test-key';

  const florists = await getNearestFlorists({
    city: 'New Delhi',
    pincode: '110060',
    limit: 3,
    searchLatitude: 28.6139,
    searchLongitude: 77.209,
  });

  assert.equal(florists[0].name, 'Nearby Florist');
  assert.equal(florists[0].distanceText, '896 m');
  assert.equal(florists[1].name, 'Far Florist');
  assert.equal(florists[1].distanceText, '2.7 km');
});
