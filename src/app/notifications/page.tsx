import { readSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import NotificationsClient from "@/components/NotificationsClient";

export default async function NotificationsPage() {
  const s = await readSession();
  if (!s) redirect("/login?next=/notifications");
  return <NotificationsClient role={s.role} name={s.name} />;
}
