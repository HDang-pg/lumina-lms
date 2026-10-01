import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/auth";
import { assertCsrf } from "@/lib/csrf";

const patchSchema = z.object({ id: z.string().optional(), all: z.boolean().optional() });

export async function GET() {
  const s = await readSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({ where: { userId: s.id }, orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.notification.count({ where: { userId: s.id, readAt: null } }),
  ]);
  return NextResponse.json({ notifications, unreadCount });
}

export async function PATCH(req: Request) {
  const s = await readSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { await assertCsrf(req); } catch { return NextResponse.json({ error: "CSRF" }, { status: 403 }); }
  const b = patchSchema.parse(await req.json());
  if (b.all) await prisma.notification.updateMany({ where: { userId: s.id, readAt: null }, data: { readAt: new Date() } });
  else if (b.id) await prisma.notification.updateMany({ where: { id: b.id, userId: s.id }, data: { readAt: new Date() } });
  return NextResponse.json({ ok: true });
}
