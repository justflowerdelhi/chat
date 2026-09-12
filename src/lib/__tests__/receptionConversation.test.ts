import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractKnownDetails, type ChatHistoryRow } from '../receptionConversation';
import { FLORIST_MITRA_PROMPT } from '../floristPrompt';

function userMessage(content: string): ChatHistoryRow {
  return { role: 'user', content };
}

test('Hello should not extract any details', () => {
  const details = extractKnownDetails([userMessage('Hello')]);
  assert.equal(details.occasion, '');
  assert.equal(details.budget, '');
  assert.equal(details.deliveryCity, '');
  assert.equal(details.deliveryDate, '');
  assert.equal(details.recipient, '');
  assert.equal(details.preferredFlowers, '');
  assert.equal(details.midnightDelivery, '');
});

test('Hi should not extract any details', () => {
  const details = extractKnownDetails([userMessage('Hi')]);
  assert.equal(details.occasion, '');
  assert.equal(details.budget, '');
  assert.equal(details.deliveryCity, '');
  assert.equal(details.deliveryDate, '');
  assert.equal(details.recipient, '');
  assert.equal(details.preferredFlowers, '');
});

test('Hii should not extract any details', () => {
  const details = extractKnownDetails([userMessage('Hii')]);
  assert.equal(details.occasion, '');
  assert.equal(details.budget, '');
  assert.equal(details.preferredFlowers, '');
});

test('Good morning should not extract any details', () => {
  const details = extractKnownDetails([userMessage('Good morning')]);
  assert.equal(details.occasion, '');
  assert.equal(details.budget, '');
  assert.equal(details.preferredFlowers, '');
});

test('Good evening should not extract any details', () => {
  const details = extractKnownDetails([userMessage('Good evening')]);
  assert.equal(details.occasion, '');
  assert.equal(details.budget, '');
  assert.equal(details.preferredFlowers, '');
});

test('Namaste should not extract any details', () => {
  const details = extractKnownDetails([userMessage('Namaste')]);
  assert.equal(details.occasion, '');
  assert.equal(details.budget, '');
  assert.equal(details.preferredFlowers, '');
});

test('"I want flowers" should not extract specific flower or budget details', () => {
  const details = extractKnownDetails([userMessage('I want flowers')]);
  assert.equal(details.occasion, '');
  assert.equal(details.budget, '');
  assert.equal(details.deliveryCity, '');
  assert.equal(details.deliveryDate, '');
  assert.equal(details.preferredFlowers, '');
});

test('"I need roses" should extract preferredFlowers', () => {
  const details = extractKnownDetails([userMessage('I need roses')]);
  assert.equal(details.preferredFlowers.toLowerCase(), 'roses');
  assert.equal(details.occasion, '');
  assert.equal(details.budget, '');
});

test('"I want to order flowers for a birthday" should extract occasion Birthday', () => {
  const details = extractKnownDetails([userMessage('I want to order flowers for a birthday')]);
  assert.equal(details.occasion, 'Birthday');
  assert.equal(details.preferredFlowers, '');
  assert.equal(details.budget, '');
  assert.equal(details.deliveryCity, '');
});

test('FLORIST_MITRA_PROMPT should contain greeting and no-assumption rules', () => {
  assert.ok(FLORIST_MITRA_PROMPT.includes('Do NOT assume the customer wants roses'));
  assert.ok(FLORIST_MITRA_PROMPT.includes('Do NOT ask for budget, occasion'));
  assert.ok(FLORIST_MITRA_PROMPT.includes('Hello! 😊 How can I help you today?'));
});
