import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  dispatchWhatsAppChannel,
  isIfaPhoneNumberId,
  resolveIfaSender,
  resolveWhatsAppChannel,
  type FloristChannelContext,
  type IfaChannelContext,
  type UnknownChannelContext,
  type WhatsAppAccount,
} from '../whatsappChannel';

const IFA_ID = '1331287183397011';
const FLORIST_ID = '1237582446108448';
const UNKNOWN_ID = '9999999999999999';

const floristAccount: WhatsAppAccount = {
  memberId: 42,
  businessName: 'Just Flowers',
  phoneNumberId: FLORIST_ID,
  accessToken: 'florist-token',
  verifyToken: 'verify',
  notificationPhoneNumber: null,
  isActive: true,
};

function setEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

function clearChannelEnv() {
  setEnv('IFA_WHATSAPP_PHONE_NUMBER_ID', undefined);
  setEnv('IFA_WHATSAPP_ACCESS_TOKEN', undefined);
  setEnv('WHATSAPP_ACCESS_TOKEN', undefined);
}

test('isIfaPhoneNumberId matches the configured IFA id only', () => {
  setEnv('IFA_WHATSAPP_PHONE_NUMBER_ID', IFA_ID);
  assert.equal(isIfaPhoneNumberId(IFA_ID), true);
  assert.equal(isIfaPhoneNumberId(FLORIST_ID), false);
  clearChannelEnv();
});

test('florist phone number id resolves to florist context', async () => {
  setEnv('IFA_WHATSAPP_PHONE_NUMBER_ID', IFA_ID);
  const channel = await resolveWhatsAppChannel(FLORIST_ID, async () => floristAccount);
  assert.equal(channel.type, 'florist');
  assert.equal((channel as FloristChannelContext).account.businessName, 'Just Flowers');
  clearChannelEnv();
});

test('IFA phone number id resolves to ifa context', async () => {
  setEnv('IFA_WHATSAPP_PHONE_NUMBER_ID', IFA_ID);
  const channel = await resolveWhatsAppChannel(IFA_ID, async () => undefined);
  assert.equal(channel.type, 'ifa');
  const ifa = channel as IfaChannelContext;
  assert.equal(ifa.businessName, 'Indian Florist Association');
  assert.equal(ifa.language, 'en');
  assert.equal(ifa.timezone, 'Asia/Kolkata');
  assert.equal(ifa.purpose, 'ifa');
  clearChannelEnv();
});

test('unknown phone number id resolves to safe unknown result', async () => {
  setEnv('IFA_WHATSAPP_PHONE_NUMBER_ID', IFA_ID);
  const channel = await resolveWhatsAppChannel(UNKNOWN_ID, async () => undefined);
  assert.equal(channel.type, 'unknown');
  assert.equal((channel as UnknownChannelContext).phoneNumberId, UNKNOWN_ID);
  clearChannelEnv();
});

test('florist channel dispatches to the reception handler', async () => {
  const channel: FloristChannelContext = {
    type: 'florist',
    phoneNumberId: FLORIST_ID,
    account: floristAccount,
  };

  let floristCalled = false;
  let ifaCalled = false;

  await dispatchWhatsAppChannel(channel, {
    florist: () => {
      floristCalled = true; // -> runReceptionConversation()
    },
    ifa: () => {
      ifaCalled = true; // -> runIFAConversation()
    },
  });

  assert.equal(floristCalled, true);
  assert.equal(ifaCalled, false);
});

test('ifa channel dispatches to the IFA handler', async () => {
  const channel: IfaChannelContext = {
    type: 'ifa',
    phoneNumberId: IFA_ID,
    businessName: 'Indian Florist Association',
    language: 'en',
    timezone: 'Asia/Kolkata',
    purpose: 'ifa',
  };

  let floristCalled = false;
  let ifaCalled = false;

  await dispatchWhatsAppChannel(channel, {
    florist: () => {
      floristCalled = true; // -> runReceptionConversation()
    },
    ifa: () => {
      ifaCalled = true; // -> runIFAConversation()
    },
  });

  assert.equal(ifaCalled, true);
  assert.equal(floristCalled, false);
});

test('unknown channel only runs the unknown handler', async () => {
  const channel: UnknownChannelContext = {
    type: 'unknown',
    phoneNumberId: UNKNOWN_ID,
  };

  let floristCalled = false;
  let ifaCalled = false;
  let unknownCalled = false;

  await dispatchWhatsAppChannel(channel, {
    florist: () => {
      floristCalled = true;
    },
    ifa: () => {
      ifaCalled = true;
    },
    unknown: () => {
      unknownCalled = true;
    },
  });

  assert.equal(floristCalled, false);
  assert.equal(ifaCalled, false);
  assert.equal(unknownCalled, true);
});

test('resolveIfaSender uses the shared WABA access token', async () => {
  setEnv('IFA_WHATSAPP_PHONE_NUMBER_ID', IFA_ID);
  setEnv('WHATSAPP_ACCESS_TOKEN', 'waba-token');
  const sender = await resolveIfaSender(async () => undefined);
  assert.deepEqual(sender, { phoneNumberId: IFA_ID, accessToken: 'waba-token' });
  clearChannelEnv();
});

test('resolveIfaSender prefers a dedicated IFA token over the shared one', async () => {
  setEnv('IFA_WHATSAPP_PHONE_NUMBER_ID', IFA_ID);
  setEnv('IFA_WHATSAPP_ACCESS_TOKEN', 'ifa-token');
  setEnv('WHATSAPP_ACCESS_TOKEN', 'waba-token');
  const sender = await resolveIfaSender(async () => undefined);
  assert.deepEqual(sender, { phoneNumberId: IFA_ID, accessToken: 'ifa-token' });
  clearChannelEnv();
});

test('resolveIfaSender falls back to a whatsapp_accounts row', async () => {
  setEnv('IFA_WHATSAPP_PHONE_NUMBER_ID', IFA_ID);
  const ifaAccount: WhatsAppAccount = {
    ...floristAccount,
    phoneNumberId: IFA_ID,
    accessToken: 'db-ifa-token',
  };
  const sender = await resolveIfaSender(async () => ifaAccount);
  assert.deepEqual(sender, { phoneNumberId: IFA_ID, accessToken: 'db-ifa-token' });
  clearChannelEnv();
});

test('resolveIfaSender returns null when nothing is configured', async () => {
  setEnv('IFA_WHATSAPP_PHONE_NUMBER_ID', IFA_ID);
  const sender = await resolveIfaSender(async () => undefined);
  assert.equal(sender, null);
  clearChannelEnv();
});
