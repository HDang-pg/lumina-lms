import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/guards";
import { Role } from "@prisma/client";
export default async function Layout({children}:{children:React.ReactNode}){ const s=await requireRole(Role.STUDENT); return <AppShell role="STUDENT" name={s.name}>{children}</AppShell>; }
