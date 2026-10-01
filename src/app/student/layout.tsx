import { requireRole } from "@/lib/guards";
import { Role } from "@prisma/client";
import StudentShellGate from "@/components/StudentShellGate";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const s = await requireRole(Role.STUDENT);
  return <StudentShellGate name={s.name}>{children}</StudentShellGate>;
}
