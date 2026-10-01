"use client";

import { usePathname } from "next/navigation";
import { AppShell } from "./AppShell";

export default function StudentShellGate({ children, name }: { children: React.ReactNode; name: string }) {
  const pathname = usePathname();
  const isExamRoom = /^\/student\/exams\/[^/]+$/.test(pathname);
  if (isExamRoom) return <>{children}</>;
  return <AppShell role="STUDENT" name={name}>{children}</AppShell>;
}
