import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { assertCsrf } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({ conversationId: z.string() });
export async function PATCH(req: Request) {
  const s = await readSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { await assertCsrf(req); } catch { return NextResponse.json({ error: "CSRF" }, { status: 403 }); }
  const b = schema.parse(await req.json());
  const conversation = await prisma.chatConversation.findFirst({ where: { id: b.conversationId, OR: [{ teacherId: s.id }, { studentId: s.id }] } });
  if (!conversation) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await prisma.chatMessage.updateMany({ where: { conversationId: b.conversationId, senderId: { not: s.id }, readAt: null }, data: { readAt: new Date() } });
  return NextResponse.json({ ok: true });
}
