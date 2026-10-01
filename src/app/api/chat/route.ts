import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/auth";
import { assertCsrf } from "@/lib/csrf";

const sendSchema = z.object({ recipientId: z.string(), body: z.string().trim().min(1).max(2000) });

async function canChat(sender: { id: string; role: string }, recipientId: string) {
  const recipient = await prisma.user.findUnique({ where: { id: recipientId }, select: { id: true, role: true, name: true, nickname: true, avatarUrl: true } });
  if (!recipient) return null;
  if (sender.role === "TEACHER") {
    if (recipient.role !== "STUDENT") return null;
    const relation = await prisma.user.findFirst({ where: { id: recipientId, role: "STUDENT", OR: [{ createdByTeacherId: sender.id }, { enrollments: { some: { course: { teacherId: sender.id } } } }] } });
    return relation ? recipient : null;
  }
  if (recipient.role !== "TEACHER") return null;
  const relation = await prisma.enrollment.findFirst({ where: { studentId: sender.id, course: { teacherId: recipientId } } });
  return relation ? recipient : null;
}

function publicUser(u: any) { return { id: u.id, name: u.name, nickname: u.nickname, avatarUrl: u.avatarUrl, role: u.role }; }

export async function GET(req: Request) {
  const s = await readSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const summary = url.searchParams.get("summary") === "1";
  const conversationId = url.searchParams.get("conversationId");

  if (summary) {
    const conversations = await prisma.chatConversation.findMany({ where: s.role === "TEACHER" ? { teacherId: s.id } : { studentId: s.id }, select: { id: true } });
    const ids = conversations.map(c => c.id);
    const unreadTotal = ids.length ? await prisma.chatMessage.count({ where: { conversationId: { in: ids }, senderId: { not: s.id }, readAt: null } }) : 0;
    return NextResponse.json({ unreadTotal });
  }

  if (conversationId) {
    const conv = await prisma.chatConversation.findFirst({ where: { id: conversationId, OR: [{ teacherId: s.id }, { studentId: s.id }] }, include: { teacher: true, student: true } });
    if (!conv) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const messages = await prisma.chatMessage.findMany({ where: { conversationId }, orderBy: { createdAt: "asc" }, take: 300 });
    await prisma.chatMessage.updateMany({ where: { conversationId, senderId: { not: s.id }, readAt: null }, data: { readAt: new Date() } });
    return NextResponse.json({ conversation: { id: conv.id, other: publicUser(conv.teacherId === s.id ? conv.student : conv.teacher) }, messages });
  }

  const where = s.role === "TEACHER" ? { teacherId: s.id } : { studentId: s.id };
  const conversations = await prisma.chatConversation.findMany({ where, include: { teacher: true, student: true, messages: { orderBy: { createdAt: "desc" }, take: 1 } }, orderBy: { updatedAt: "desc" } });
  const ids = conversations.map(c => c.id);
  const unread = ids.length ? await prisma.chatMessage.groupBy({ by: ["conversationId"], where: { conversationId: { in: ids }, senderId: { not: s.id }, readAt: null }, _count: { _all: true } }) : [];
  const countMap = new Map(unread.map(x => [x.conversationId, x._count._all]));

  const contactsRaw = s.role === "TEACHER"
    ? await prisma.user.findMany({ where: { role: "STUDENT", OR: [{ createdByTeacherId: s.id }, { enrollments: { some: { course: { teacherId: s.id } } } }] }, select: { id: true, name: true, nickname: true, avatarUrl: true, role: true }, orderBy: { name: "asc" } })
    : await prisma.user.findMany({ where: { role: "TEACHER", courses: { some: { enrollments: { some: { studentId: s.id } } } } }, select: { id: true, name: true, nickname: true, avatarUrl: true, role: true }, orderBy: { name: "asc" } });

  const convs = conversations.map(c => ({ id: c.id, other: publicUser(s.role === "TEACHER" ? c.student : c.teacher), lastMessage: c.messages[0] || null, unreadCount: countMap.get(c.id) || 0 }));
  const unreadTotal = convs.reduce((sum, c) => sum + c.unreadCount, 0);
  return NextResponse.json({ conversations: convs, contacts: contactsRaw.map(publicUser), unreadTotal });
}

export async function POST(req: Request) {
  const s = await readSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { await assertCsrf(req); } catch { return NextResponse.json({ error: "CSRF" }, { status: 403 }); }
  const b = sendSchema.parse(await req.json());
  const recipient = await canChat(s, b.recipientId);
  if (!recipient) return NextResponse.json({ error: "Bạn không có quyền nhắn tin với tài khoản này." }, { status: 403 });
  const teacherId = s.role === "TEACHER" ? s.id : recipient.id;
  const studentId = s.role === "STUDENT" ? s.id : recipient.id;
  const conversation = await prisma.chatConversation.upsert({ where: { teacherId_studentId: { teacherId, studentId } }, update: {}, create: { teacherId, studentId } });
  const message = await prisma.chatMessage.create({ data: { conversationId: conversation.id, senderId: s.id, body: b.body } });
  await prisma.chatConversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } });
  await prisma.notification.create({ data: { userId: recipient.id, title: `Tin nhắn mới từ ${s.name}`, body: b.body.slice(0, 180), href: `/chat?conversationId=${conversation.id}` } });
  return NextResponse.json({ ok: true, conversationId: conversation.id, message });
}
