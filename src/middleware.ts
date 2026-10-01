import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { SESSION_COOKIE } from "@/lib/auth";
import { Role } from "@prisma/client";
import crypto from "crypto";

const secret = new TextEncoder().encode(process.env.AUTH_SECRET || "dev-secret-change-me");

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/_next") || pathname === "/favicon.ico" || pathname.startsWith("/login")) return NextResponse.next();
  if (pathname === "/api/auth/login" || pathname === "/api/auth/logout") return NextResponse.next();
  const needsAuth = pathname.startsWith("/dashboard") || pathname.startsWith("/student") || pathname.startsWith("/teacher") || pathname.startsWith("/api/") || pathname.startsWith("/chat") || pathname.startsWith("/notifications");
  if (!needsAuth) return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const url = new URL("/login", req.url); url.searchParams.set("next", pathname); return NextResponse.redirect(url);
  }
  try {
    const { payload } = await jwtVerify(token, secret);
    const role = payload.role as Role;
    if ((pathname.startsWith("/teacher") || pathname.startsWith("/api/teacher")) && role !== Role.TEACHER) return NextResponse.redirect(new URL("/dashboard", req.url));
    if ((pathname.startsWith("/student") || pathname.startsWith("/dashboard")) && role !== Role.STUDENT) return NextResponse.redirect(new URL("/teacher", req.url));
    const res = NextResponse.next();
    if (!req.cookies.get("lms_csrf")?.value) res.cookies.set("lms_csrf", crypto.randomBytes(24).toString("hex"), { httpOnly: false, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 60*60*8 });
    return res;
  } catch {
    return pathname.startsWith("/api/") ? NextResponse.json({ error: "Unauthorized" }, { status: 401 }) : NextResponse.redirect(new URL("/login", req.url));
  }
}

export const config = { matcher: ["/dashboard/:path*", "/student/:path*", "/teacher/:path*", "/api/:path*", "/chat/:path*", "/notifications/:path*"] };
