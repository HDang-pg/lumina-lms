import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { roleHome, setSessionCookie, signSession } from "@/lib/auth";

const schema = z.object({ email: z.string().email().max(120), password: z.string().min(6).max(120) });
export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const user = await prisma.user.findUnique({ where: { email: body.email.toLowerCase().trim() } });
    if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) return NextResponse.json({ error: "Email hoặc mật khẩu không đúng." }, { status: 401 });
    const token = await signSession({ id: user.id, name: user.name, email: user.email, role: user.role });
    const response = NextResponse.json({ ok: true, redirect: roleHome(user.role) });
    setSessionCookie(response, token);
    response.cookies.set("lms_csrf", cryptoToken(), { httpOnly: false, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 60*60*8 });
    return response;
  } catch { return NextResponse.json({ error: "Dữ liệu đăng nhập không hợp lệ." }, { status: 400 }); }
}
function cryptoToken(){ return Array.from(crypto.getRandomValues(new Uint8Array(24))).map(x=>x.toString(16).padStart(2,"0")).join(""); }
