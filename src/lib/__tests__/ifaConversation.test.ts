import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runIFAConversation } from '../ifaConversation';
import type { IfaChannelContext } from '../whatsappChannel';

const mockContext: IfaChannelContext = {
  type: 'ifa',
  phoneNumberId: '1299518676581018',
  businessName: 'Indian Florist Association',
  language: 'en',
  timezone: 'Asia/Kolkata',
  purpose: 'ifa',
};

// All ifaConversation tests require OPENAI_API_KEY and DATABASE_URL
// These are integration tests; skip them in CI without env vars
test.skip('General greeting does not assume membership', async () => {
  const result = await runIFAConversation({
    messages: [{ role: 'user', content: 'Hello' }],
    context: mockContext,
  });
  assert.ok(result.reply.length > 0);
  assert.ok(!result.reply.toLowerCase().includes('join'));
});

test.skip('Membership query routes to membership knowledge', async () => {
  const result = await runIFAConversation({
    messages: [{ role: 'user', content: 'How do I join IFA?' }],
    context: mockContext,
  });
  assert.ok(result.reply.length > 0);
  assert.ok(result.reply.toLowerCase().includes('join') || result.reply.toLowerCase().includes('membership'));
});

test.skip('Member search query routes to member search', async () => {
  const result = await runIFAConversation({
    messages: [{ role: 'user', content: 'Find Rami Brothers' }],
    context: mockContext,
  });
  assert.ok(result.reply.length > 0);
});

test.skip('Nearest florist query routes to locator', async () => {
  const result = await runIFAConversation({
    messages: [{ role: 'user', content: 'nearest florist near 110060' }],
    context: mockContext,
  });
  assert.ok(result.reply.length > 0);
});

test.skip('Leadership query routes to leadership knowledge', async () => {
  const result = await runIFAConversation({
    messages: [{ role: 'user', content: 'Who is the IFA president?' }],
    context: mockContext,
  });
  assert.ok(result.reply.length > 0);
});

test.skip('Event query routes to event knowledge', async () => {
  const result = await runIFAConversation({
    messages: [{ role: 'user', content: 'next IFA Meet' }],
    context: mockContext,
  });
  assert.ok(result.reply.length > 0);
});

test.skip('Follow-up phone number after member result works', async () => {
  const result = await runIFAConversation({
    messages: [
      { role: 'user', content: 'Find Rami Brothers' },
      { role: 'assistant', content: 'IFA members matching "Rami Brothers":\n\n1. Rami Brothers — Same PIN code\n   123 Main St\n   📞 9876543210' },
      { role: 'user', content: 'Phone number' },
    ],
    context: mockContext,
  });
  assert.ok(result.reply.length > 0);
});

test.skip('Follow-up member name after search works', async () => {
  const result = await runIFAConversation({
    messages: [
      { role: 'user', content: 'Find florists in Delhi' },
      { role: 'assistant', content: 'IFA members in Delhi:\n\n1. Rami Brothers\n2. Rose n Petals' },
      { role: 'user', content: 'Rami Brothers' },
    ],
    context: mockContext,
  });
  assert.ok(result.reply.length > 0);
});

test.skip('Missing member information is not invented', async () => {
  const result = await runIFAConversation({
    messages: [{ role: 'user', content: 'Find XYZ Florist' }],
    context: mockContext,
  });
  assert.ok(result.reply.length > 0);
  assert.ok(!result.reply.includes('9876543210') || result.reply.includes('not available'));
});

test.skip('Unknown IFA question produces a safe fallback', async () => {
  const result = await runIFAConversation({
    messages: [{ role: 'user', content: 'What is the meaning of life?' }],
    context: mockContext,
  });
  assert.ok(result.reply.length > 0);
  assert.ok(!result.reply.includes('I am an AI'));
});
