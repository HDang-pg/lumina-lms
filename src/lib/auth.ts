import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const SESSION_COOKIE = "lms_session";

const secret = new TextEncoder().encode(
  process.env.AUTH_SECRET || "dev-secret-change-me"
);

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  sessionVersion: number;
};

export async function signSession(user: SessionUser) {
  return new SignJWT({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    sessionVersion: user.sessionVersion,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(secret);
}

export async function readSession(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;

  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret);

    if (
      !payload.id ||
      !payload.role ||
      !payload.email ||
      !payload.name ||
      typeof payload.sessionVersion !== "number"
    ) {
      return null;
    }

    const user = await prisma.user.findUnique({
      where: {
        id: String(payload.id),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        sessionVersion: true,
      },
    });

    if (!user) return null;

    if (user.sessionVersion !== payload.sessionVersion) {
      return null;
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      sessionVersion: user.sessionVersion,
    };
  } catch {
    return null;
  }
}

export function setSessionCookie(
  response: NextResponse,
  token: string
) {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
}

export function clearSessionCookie(
  response: NextResponse
) {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export function roleHome(role: Role) {
  return role === Role.TEACHER
    ? "/teacher"
    : "/dashboard";
}