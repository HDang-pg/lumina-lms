import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assertCsrf } from "@/lib/csrf";
import { readSession, setSessionCookie, signSession } from "@/lib/auth";

const schema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  nickname: z.string().trim().max(60).optional().nullable(),
  email: z.string().email().max(120).optional(),
  age: z.union([z.number().int().min(5).max(100), z.null()]).optional(),
  className: z.string().trim().max(80).optional().nullable(),
  password: z.string().min(6).max(120).optional(),
});

function safeProfile(user: any) {
  return { id: user.id, name: user.name, nickname: user.nickname, email: user.email, role: user.role, avatarUrl: user.avatarUrl, age: user.age, className: user.className };
}

export async function GET() {
  const s = await readSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { id: s.id } });
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ profile: safeProfile(user) });
}

export async function PATCH(req: Request) {
  const s = await readSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { await assertCsrf(req); } catch { return NextResponse.json({ error: "CSRF" }, { status: 403 }); }
  try {
    const b = schema.parse(await req.json());
    const data: Record<string, unknown> = {};
    if (b.nickname !== undefined) data.nickname = b.nickname || null;

    if (s.role === "TEACHER") {
      if (b.name !== undefined) data.name = b.name;
      if (b.email !== undefined) data.email = b.email.toLowerCase().trim();
      if (b.age !== undefined) data.age = b.age;
      if (b.className !== undefined) data.className = b.className;
      if (b.password) data.passwordHash = await bcrypt.hash(b.password, 12);
    }

    const updated = await prisma.user.update({ where: { id: s.id }, data });
    const response = NextResponse.json({ ok: true, profile: safeProfile(updated) });
    const token = await signSession({ id: updated.id, name: updated.name, email: updated.email, role: updated.role });
    setSessionCookie(response, token);
    return response;
  } catch (e: any) {
    if (e?.code === "P2002") return NextResponse.json({ error: "Tên đăng nhập/email đã được sử dụng." }, { status: 409 });
    if (e instanceof z.ZodError) return NextResponse.json({ error: "Thông tin hồ sơ không hợp lệ." }, { status: 400 });
    return NextResponse.json({ error: "Không thể cập nhật hồ sơ." }, { status: 500 });
  }
}
