import { NextResponse } from "next/server";
import { runReceptionConversation } from "@/lib/receptionConversation";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = await runReceptionConversation({
      messages: body.messages,
      sessionId: body.sessionId,
    });

    if ('error' in result) {
      return NextResponse.json({ error: result.error, remaining: result.remaining }, { status: result.status });
    }

    return NextResponse.json({
      reply: result.reply,
      sessionId: result.sessionId,
      remaining: result.remaining,
    });
  } catch (error) {
    console.error('Public chat error:', error);
    return NextResponse.json({ error: 'Failed to process chat request' }, { status: 500 });
  }
}