import { readSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import ChatClient from "@/components/ChatClient";

export default async function ChatPage() {
  const s = await readSession();
  if (!s) redirect("/login?next=/chat");
  return <ChatClient role={s.role} name={s.name} />;
}
