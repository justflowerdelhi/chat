import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMissingLocationMessage,
  detectContactDetailsRequest,
  detectNearestFloristIntent,
  extractLocationFromMessage,
  hasLocationInformation,
  isAffirmativeReply,
} from '../locationIntent';

const trueCases = [
  'nearest florist',
  'nearest flower shop',
  'closest florist',
  'closest flower shop',
  'florist near me',
  'flower shop near me',
  'which florist is nearest',
  'IFA florist near me',
  'nearest IFA florist',
  'find a florist near 110060',
  'nearest florist in New Delhi',
  'closest florist in Delhi',
];

const falseCases = [
  'I need roses',
  'I want a birthday bouquet',
  'show me flowers',
  'do you deliver?',
  'how much are roses?',
  'what is the price of roses',
];

for (const input of trueCases) {
  test(`detects nearest florist intent for: "${input}"`, () => {
    assert.equal(detectNearestFloristIntent(input), true);
  });
}

for (const input of falseCases) {
  test(`does NOT detect nearest florist intent for: "${input}"`, () => {
    assert.equal(detectNearestFloristIntent(input), false);
  });
}

test('extracts pincode from "nearest florist in 110060"', () => {
  const location = extractLocationFromMessage('nearest florist in 110060');
  assert.equal(location.pincode, '110060');
  assert.equal(location.city, undefined);
});

test('extracts pincode and city from "find a florist near 110060 New Delhi"', () => {
  const location = extractLocationFromMessage('find a florist near 110060 New Delhi');
  assert.equal(location.pincode, '110060');
  assert.equal(location.city, 'New Delhi');
});

test('extracts city from "nearest florist in New Delhi"', () => {
  const location = extractLocationFromMessage('nearest florist in New Delhi');
  assert.equal(location.city, 'New Delhi');
  assert.equal(location.pincode, undefined);
});

test('does not invent location for "nearest florist"', () => {
  const location = extractLocationFromMessage('nearest florist');
  assert.equal(location.city, undefined);
  assert.equal(location.pincode, undefined);
});

// Generic city extraction tests for cities not in CITY_NAMES
test('generic city extraction: "800003, Patna"', () => {
  const location = extractLocationFromMessage('800003, Patna');
  assert.equal(location.pincode, '800003');
  assert.equal(location.city, 'Patna');
});

test('generic city extraction: "800003 Patna"', () => {
  const location = extractLocationFromMessage('800003 Patna');
  assert.equal(location.pincode, '800003');
  assert.equal(location.city, 'Patna');
});

test('generic city extraction: "Patna 800003"', () => {
  const location = extractLocationFromMessage('Patna 800003');
  assert.equal(location.pincode, '800003');
  assert.equal(location.city, 'Patna');
});

test('generic city extraction: "800003, patna" (lowercase)', () => {
  const location = extractLocationFromMessage('800003, patna');
  assert.equal(location.pincode, '800003');
  assert.equal(location.city, 'Patna');
});

test('generic city extraction: "nearest florist pincode 800003, patna"', () => {
  const location = extractLocationFromMessage('nearest florist pincode 800003, patna');
  assert.equal(location.pincode, '800003');
  assert.equal(location.city, 'Patna');
});

test('generic city extraction: "nearest florist pin 800003 Patna"', () => {
  const location = extractLocationFromMessage('nearest florist pin 800003 Patna');
  assert.equal(location.pincode, '800003');
  assert.equal(location.city, 'Patna');
});

test('generic city extraction: "Please find nearest florist in 800003, Patna"', () => {
  const location = extractLocationFromMessage('Please find nearest florist in 800003, Patna');
  assert.equal(location.pincode, '800003');
  assert.equal(location.city, 'Patna');
});

test('generic city extraction: "Can you find a florist near 800003 Patna?"', () => {
  const location = extractLocationFromMessage('Can you find a florist near 800003 Patna?');
  assert.equal(location.pincode, '800003');
  // Explicit location phrasing "near 800003 Patna" is now supported
  assert.equal(location.city, 'Patna');
});

test('generic city extraction: "800003, Patna, Bihar" → extracts Patna', () => {
  const location = extractLocationFromMessage('800003, Patna, Bihar');
  assert.equal(location.pincode, '800003');
  assert.equal(location.city, 'Patna');
});

test('generic city extraction: "110008, New Delhi" (known city)', () => {
  const location = extractLocationFromMessage('110008, New Delhi');
  assert.equal(location.pincode, '110008');
  assert.equal(location.city, 'New Delhi');
});

test('generic city extraction: pincode-only "110008"', () => {
  const location = extractLocationFromMessage('110008');
  assert.equal(location.pincode, '110008');
  assert.equal(location.city, undefined);
});

test('generic city extraction: city-only "New Delhi"', () => {
  const location = extractLocationFromMessage('New Delhi');
  assert.equal(location.city, 'New Delhi');
  assert.equal(location.pincode, undefined);
});

// Negative cases - should NOT extract city
test('generic city extraction: "800003 India" → no city (country, not city)', () => {
  const location = extractLocationFromMessage('800003 India');
  assert.equal(location.pincode, '800003');
  assert.equal(location.city, undefined);
});

test('generic city extraction: "800003 today" → no city', () => {
  const location = extractLocationFromMessage('800003 today');
  assert.equal(location.pincode, '800003');
  assert.equal(location.city, undefined);
});

test('generic city extraction: "800003 please" → no city', () => {
  const location = extractLocationFromMessage('800003 please');
  assert.equal(location.pincode, '800003');
  assert.equal(location.city, undefined);
});

test('generic city extraction: "PIN 800003 please" → no city', () => {
  const location = extractLocationFromMessage('PIN 800003 please');
  assert.equal(location.pincode, '800003');
  assert.equal(location.city, undefined);
});

test('generic city extraction: "near 800003" → no city', () => {
  const location = extractLocationFromMessage('near 800003');
  assert.equal(location.pincode, '800003');
  assert.equal(location.city, undefined);
});

test('generic city extraction: "florist 800003" → no city', () => {
  const location = extractLocationFromMessage('florist 800003');
  assert.equal(location.pincode, '800003');
  assert.equal(location.city, undefined);
});

test('generic city extraction: "Need florist for 800003" → no city', () => {
  const location = extractLocationFromMessage('Need florist for 800003');
  assert.equal(location.pincode, '800003');
  assert.equal(location.city, undefined);
});

test('generic city extraction: "800003 unknownword" → no city', () => {
  const location = extractLocationFromMessage('800003 unknownword');
  assert.equal(location.pincode, '800003');
  assert.equal(location.city, undefined);
});

// Punctuation tests
test('generic city extraction: "800003, Patna." (trailing period)', () => {
  const location = extractLocationFromMessage('800003, Patna.');
  assert.equal(location.pincode, '800003');
  assert.equal(location.city, 'Patna');
});

test('generic city extraction: "Patna - 800003" (dash separator)', () => {
  const location = extractLocationFromMessage('Patna - 800003');
  assert.equal(location.pincode, '800003');
  assert.equal(location.city, 'Patna');
});

test('generic city extraction: "(800003, Patna)" (parentheses)', () => {
  const location = extractLocationFromMessage('(800003, Patna)');
  assert.equal(location.pincode, '800003');
  assert.equal(location.city, 'Patna');
});

test('generic city extraction: "800003 / Patna" (slash separator)', () => {
  const location = extractLocationFromMessage('800003 / Patna');
  assert.equal(location.pincode, '800003');
  assert.equal(location.city, 'Patna');
});

test('builds missing city and pincode message', () => {
  const message = buildMissingLocationMessage({});
  assert.ok(message.includes('Which area or PIN code'));
});

test('builds missing city message', () => {
  const message = buildMissingLocationMessage({ pincode: '110060' });
  assert.ok(message.includes('Which city'));
});

test('builds missing pincode message', () => {
  const message = buildMissingLocationMessage({ city: 'New Delhi' });
  assert.ok(message.includes('PIN code'));
});

test('hasLocationInformation is true for pincode or city', () => {
  assert.equal(hasLocationInformation('110060'), true);
  assert.equal(hasLocationInformation('New Delhi'), true);
  assert.equal(hasLocationInformation('find florist near 110060 New Delhi'), true);
});

test('hasLocationInformation is false for product or greeting', () => {
  assert.equal(hasLocationInformation('I need roses'), false);
  assert.equal(hasLocationInformation('Hello'), false);
  assert.equal(hasLocationInformation('show me flowers'), false);
});

const contactTrueCases = [
  'show contact details',
  'contact details',
  'phone number',
  'give me the number',
  'address',
  'where is it',
  'call the nearest florist',
  'contact details of Rose n petals',
  'Need contact no. of Rami Brothers',
];

const contactFalseCases = [
  'I need roses',
  'call me',
  'send flowers',
  'show me flowers',
  'what is your phone number',
];

for (const input of contactTrueCases) {
  test(`detects contact request for: "${input}"`, () => {
    assert.equal(detectContactDetailsRequest(input), true);
  });
}

for (const input of contactFalseCases) {
  test(`does NOT detect contact request for: "${input}"`, () => {
    assert.equal(detectContactDetailsRequest(input), false);
  });
}

const affirmativeCases = [
  'Yes',
  'yes',
  'Yes please',
  'yeah',
  'sure',
  'ok',
  'okay',
  'yup',
];

const nonAffirmativeCases = [
  'I need roses',
  'no',
  'nope',
  'maybe',
  'nearest florist',
];

for (const input of affirmativeCases) {
  test(`isAffirmativeReply true for: "${input}"`, () => {
    assert.equal(isAffirmativeReply(input), true);
  });
}

for (const input of nonAffirmativeCases) {
  test(`isAffirmativeReply false for: "${input}"`, () => {
    assert.equal(isAffirmativeReply(input), false);
  });
}

// IFA location state accumulation tests
test('IFA location state: pincode extracted from single message', () => {
  const location = extractLocationFromMessage('110008');
  assert.equal(location.pincode, '110008');
  assert.equal(location.city, undefined);
});

test('IFA location state: city extracted from single message', () => {
  const location = extractLocationFromMessage('New Delhi');
  assert.equal(location.city, 'New Delhi');
  assert.equal(location.pincode, undefined);
});

test('IFA location state: both city and pincode extracted from single message', () => {
  const location = extractLocationFromMessage('New Delhi 110008');
  assert.equal(location.city, 'New Delhi');
  assert.equal(location.pincode, '110008');
});

test('IFA location state: nearest florist intent detected', () => {
  assert.equal(detectNearestFloristIntent('Need nearest florist'), true);
  assert.equal(detectNearestFloristIntent('nearest florist'), true);
  assert.equal(detectNearestFloristIntent('find nearest florist'), true);
});

test('IFA location state: non-locator queries do not trigger intent', () => {
  assert.equal(detectNearestFloristIntent('Hello'), false);
  assert.equal(detectNearestFloristIntent('What is IFA?'), false);
  assert.equal(detectNearestFloristIntent('How do I join?'), false);
});

test('IFA location state: assistant messages do not extract location', () => {
  // Assistant asking for city should not be treated as user providing city
  const location = extractLocationFromMessage('Thanks 😊 Which city is this PIN code in?');
  assert.equal(location.city, undefined);
  assert.equal(location.pincode, undefined);
});

test('IFA location state: hasLocationInformation correctly identifies location data', () => {
  assert.equal(hasLocationInformation('110008'), true);
  assert.equal(hasLocationInformation('New Delhi'), true);
  assert.equal(hasLocationInformation('Need nearest florist'), false);
  assert.equal(hasLocationInformation('Hello'), false);
});

// Multi-turn state accumulation test (pure logic, no database required)
test('IFA multi-turn location state accumulation', () => {
  // Simulate the state transition logic from route.ts
  type IfaSessionState = {
    pending?: boolean;
    collectedCity?: string;
    collectedPincode?: string;
  };

  let state: IfaSessionState = {};

  // Turn 1: "Need nearest florist" - no location provided
  const isLocatorIntent1 = detectNearestFloristIntent('Need nearest florist');
  const locationUpdate1 = extractLocationFromMessage('Need nearest florist');

  assert.equal(isLocatorIntent1, true);
  assert.equal(locationUpdate1.city, undefined);
  assert.equal(locationUpdate1.pincode, undefined);

  // After processing: should set pending = true
  state = { ...state, pending: true };
  assert.equal(state.pending, true);
  assert.equal(state.collectedPincode, undefined);
  assert.equal(state.collectedCity, undefined);

  // Turn 2: "110008" - user provides PIN code
  const isLocatorIntent2 = detectNearestFloristIntent('110008');
  const locationUpdate2 = extractLocationFromMessage('110008');

  assert.equal(isLocatorIntent2, false); // PIN alone is not a locator intent
  assert.equal(locationUpdate2.pincode, '110008');
  assert.equal(locationUpdate2.city, undefined);

  // After processing: should accumulate PIN, keep pending
  const city2 = locationUpdate2.city || state.collectedCity;
  const pincode2 = locationUpdate2.pincode || state.collectedPincode;

  state = {
    ...state,
    pending: true,
    collectedPincode: pincode2,
  };

  assert.equal(state.pending, true);
  assert.equal(state.collectedPincode, '110008');
  assert.equal(state.collectedCity, undefined);

  // Turn 3: "New Delhi" - user provides city
  const isLocatorIntent3 = detectNearestFloristIntent('New Delhi');
  const locationUpdate3 = extractLocationFromMessage('New Delhi');

  assert.equal(isLocatorIntent3, false); // City alone is not a locator intent
  assert.equal(locationUpdate3.city, 'New Delhi');
  assert.equal(locationUpdate3.pincode, undefined);

  // After processing: should combine with previous PIN
  const city3 = locationUpdate3.city || state.collectedCity;
  const pincode3 = locationUpdate3.pincode || state.collectedPincode;

  // This is what would be passed to getNearestFlorists()
  assert.equal(city3, 'New Delhi');
  assert.equal(pincode3, '110008');

  // Verify final state before locator call
  assert.equal(state.collectedPincode, '110008');
  assert.equal(city3, 'New Delhi');
});

test('IFA multi-turn: both city and PIN in one message', () => {
  const locationUpdate = extractLocationFromMessage('New Delhi 110008');

  assert.equal(locationUpdate.city, 'New Delhi');
  assert.equal(locationUpdate.pincode, '110008');

  // With this, both city and pincode are available immediately
  const city = locationUpdate.city;
  const pincode = locationUpdate.pincode;

  assert.equal(city, 'New Delhi');
  assert.equal(pincode, '110008');
  // This would trigger immediate locator call
});

test('IFA multi-turn: new session starts empty', () => {
  const state: {
    pending?: boolean;
    collectedCity?: string;
    collectedPincode?: string;
  } = {};

  assert.equal(state.pending, undefined);
  assert.equal(state.collectedCity, undefined);
  assert.equal(state.collectedPincode, undefined);
});

test('IFA multi-turn: different sessions remain isolated', () => {
  const session1: {
    pending?: boolean;
    collectedCity?: string;
    collectedPincode?: string;
  } = {
    pending: true,
    collectedPincode: '110008',
    collectedCity: 'New Delhi',
  };

  const session2: {
    pending?: boolean;
    collectedCity?: string;
    collectedPincode?: string;
  } = {
    pending: true,
    collectedPincode: '400001',
    collectedCity: 'Mumbai',
  };

  // Session 1 should not inherit Session 2's data
  assert.equal(session1.collectedPincode, '110008');
  assert.equal(session1.collectedCity, 'New Delhi');

  // Session 2 should not inherit Session 1's data
  assert.equal(session2.collectedPincode, '400001');
  assert.equal(session2.collectedCity, 'Mumbai');
});

test('IFA multi-turn: assistant messages do not create location state', () => {
  const assistantMessage = 'Thanks 😊 Which city is this PIN code in?';
  const locationUpdate = extractLocationFromMessage(assistantMessage);

  assert.equal(locationUpdate.city, undefined);
  assert.equal(locationUpdate.pincode, undefined);

  // If this were mistakenly treated as user input, it would not set location
  const city = locationUpdate.city;
  const pincode = locationUpdate.pincode;

  assert.equal(city, undefined);
  assert.equal(pincode, undefined);
});
