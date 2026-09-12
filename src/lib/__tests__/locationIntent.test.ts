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
