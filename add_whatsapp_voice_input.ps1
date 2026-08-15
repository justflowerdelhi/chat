$ErrorActionPreference = "Stop"

$root = "C:\floraprise.com\flora"
$route = Join-Path $root "src\app\api\whatsapp\webhook\route.ts"

if (!(Test-Path $route)) {
    throw "Webhook route not found: $route"
}

$r = Get-Content $route -Raw

# 1. Add OpenAI import.
if ($r -notmatch 'import OpenAI from "openai";') {
    $r = $r.Replace(
        'import { NextResponse } from "next/server";',
        'import { NextResponse } from "next/server";' + [Environment]::NewLine +
        'import OpenAI from "openai";'
    )
}

# 2. Extend WhatsApp message interface with audio.
$oldInterface = @'
interface WhatsAppTextMessage {
  from: string;
  id: string;
  type: string;
  text?: { body?: string };
}
'@

$newInterface = @'
interface WhatsAppTextMessage {
  from: string;
  id: string;
  type: string;
  text?: { body?: string };
  audio?: {
    id?: string;
    mime_type?: string;
    sha256?: string;
    voice?: boolean;
  };
}
'@

if ($r.Contains($oldInterface)) {
    $r = $r.Replace($oldInterface, $newInterface)
}

# 3. Add transcription helper before handleMessage.
if ($r -notmatch 'async function transcribeWhatsAppAudio') {
    $marker = 'async function handleMessage(message: WhatsAppTextMessage, phoneNumberId: string) {'
    $idx = $r.IndexOf($marker)
    if ($idx -lt 0) { throw "Could not find handleMessage." }

    $helper = @'
async function transcribeWhatsAppAudio(
  mediaId: string,
  account: WhatsAppAccount,
  mimeType?: string
): Promise<string> {
  const mediaResponse = await fetch(
    `https://graph.facebook.com/v26.0/${mediaId}`,
    {
      headers: {
        Authorization: `Bearer ${account.accessToken}`,
      },
    }
  );

  if (!mediaResponse.ok) {
    throw new Error(
      `WhatsApp media lookup failed: ${mediaResponse.status} ${await mediaResponse.text()}`
    );
  }

  const media = (await mediaResponse.json()) as { url?: string; mime_type?: string };

  if (!media.url) {
    throw new Error("WhatsApp media lookup returned no media URL.");
  }

  const audioResponse = await fetch(media.url, {
    headers: {
      Authorization: `Bearer ${account.accessToken}`,
    },
  });

  if (!audioResponse.ok) {
    throw new Error(
      `WhatsApp media download failed: ${audioResponse.status} ${await audioResponse.text()}`
    );
  }

  const audioBuffer = await audioResponse.arrayBuffer();
  const detectedMime = media.mime_type || mimeType || "audio/ogg";
  const extension =
    detectedMime.includes("mpeg") || detectedMime.includes("mp3")
      ? "mp3"
      : detectedMime.includes("mp4") || detectedMime.includes("m4a")
        ? "m4a"
        : detectedMime.includes("webm")
          ? "webm"
          : "ogg";

  const form = new FormData();
  form.append(
    "file",
    new Blob([audioBuffer], { type: detectedMime }),
    `whatsapp-audio.${extension}`
  );
  form.append("model", "gpt-4o-mini-transcribe");

  const openaiResponse = await fetch(
    "https://api.openai.com/v1/audio/transcriptions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: form,
    }
  );

  if (!openaiResponse.ok) {
    throw new Error(
      `OpenAI transcription failed: ${openaiResponse.status} ${await openaiResponse.text()}`
    );
  }

  const result = (await openaiResponse.json()) as { text?: string };

  if (!result.text?.trim()) {
    throw new Error("OpenAI returned an empty transcription.");
  }

  return result.text.trim();
}

'@

    $r = $r.Substring(0, $idx) + $helper + $r.Substring($idx)
}

# 4. Replace the text-only early return and incomingText declaration.
$oldStart = @'
async function handleMessage(message: WhatsAppTextMessage, phoneNumberId: string) {
  if (message.type !== "text" || !message.text?.body) return;

  const incomingText = message.text.body.trim();

  console.log("WhatsApp incoming message:", {
'@

$newStart = @'
async function handleMessage(message: WhatsAppTextMessage, phoneNumberId: string) {
  if (
    message.type !== "text" &&
    message.type !== "audio"
  ) {
    console.log("Ignoring unsupported WhatsApp message type:", message.type);
    return;
  }

  const account = await resolveWhatsAppAccount(phoneNumberId);

  if (!account) {
    console.error("Unknown or inactive WhatsApp Phone Number ID:", phoneNumberId);
    return;
  }

  let incomingText = "";

  if (message.type === "text") {
    incomingText = message.text?.body?.trim() || "";
  } else {
    const mediaId = message.audio?.id;

    if (!mediaId) {
      console.error("WhatsApp audio message has no media ID:", message.id);
      await sendWhatsAppText(
        message.from,
        "Sorry, I couldn't read that voice message. Please send it again or type your request.",
        account
      );
      return;
    }

    try {
      incomingText = await transcribeWhatsAppAudio(
        mediaId,
        account,
        message.audio?.mime_type
      );

      console.log("WhatsApp voice transcription:", {
        from: message.from,
        id: message.id,
        transcript: incomingText,
      });
    } catch (error) {
      console.error("WhatsApp voice transcription failed:", error);

      await sendWhatsAppText(
        message.from,
        "Sorry, I couldn't understand that voice message. Please try again or type your request.",
        account
      );
      return;
    }
  }

  if (!incomingText) return;

  console.log("WhatsApp incoming message:", {
'@

if (!$r.Contains($oldStart)) {
    throw "Could not find the current handleMessage start block."
}
$r = $r.Replace($oldStart, $newStart)

# 5. Remove the duplicated account resolution block that followed the old start.
$duplicate = @'
  const account = await resolveWhatsAppAccount(phoneNumberId);

  if (!account) {
    console.error("Unknown or inactive WhatsApp Phone Number ID:", phoneNumberId);
    return;
  }

'@

# There should now be a duplicate occurrence after the new start.
$first = $r.IndexOf($duplicate)
if ($first -ge 0) {
    $second = $r.IndexOf($duplicate, $first + $duplicate.Length)
    if ($second -ge 0) {
        $r = $r.Remove($second, $duplicate.Length)
    }
}

# 6. Add a clear voice marker to the conversation context without changing the
# existing reception architecture. The transcript is what gets processed.
$contextNeedle = @'
  const context: ReceptionContext = {
    memberId: account.memberId,
'@

if ($r.Contains($contextNeedle) -and $r -notmatch 'channel: "whatsapp-voice"') {
    # Keep the existing channel value to avoid changing downstream behavior.
    # No modification required.
}

Set-Content $route $r -Encoding UTF8

Write-Host ""
Write-Host "SUCCESS: WhatsApp voice input support added."
Write-Host "Voice messages will be downloaded from Meta, transcribed with gpt-4o-mini-transcribe,"
Write-Host "then passed into the existing Flora receptionist as normal text."
Write-Host "Flora will continue replying with TEXT only."
Write-Host ""
Write-Host "Next: npm run build"
