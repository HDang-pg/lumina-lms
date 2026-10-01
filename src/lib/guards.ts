import { redirect } from "next/navigation";
import { readSession } from "./auth";
import { Role } from "@prisma/client";

export async function requireRole(role: Role) {
  const session = await readSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(role === Role.TEACHER ? "/teacher" : "/dashboard")}`);
  if (session.role !== role) redirect(role === Role.TEACHER ? "/dashboard" : "/teacher");
  return session;
}
