# Flora Receptionist

Standalone Next.js shell for the extracted Project Flora modules.

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000` for the home page and `http://localhost:3000/dashboard/florist-mitra` for chat.

## Environment Variables

```env
DATABASE_URL=
OPENAI_API_KEY=
SESSION_SECRET=
NEXT_PUBLIC_APP_NAME=Flora Receptionist
WHATSAPP_BUSINESS_PHONE_NUMBER=
WHATSAPP_WEBHOOK_VERIFY_TOKEN=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
```

## WhatsApp Demo Webhook

Configure one WhatsApp Business number with:

```text
GET /api/whatsapp/webhook
POST /api/whatsapp/webhook
```

The webhook is demo-only. It receives text messages, runs the same Flora receptionist conversation used by the public widget, sends the reply through WhatsApp Cloud API, and lets the existing enquiry flow update the Reception Desk.

## Notes

- Existing API routes, database table names, authentication cookie names, prompt text and chat/session logic are unchanged.
- Existing migrations are retained for reference only; this bootstrap does not add or modify migrations.