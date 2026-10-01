import { redirect } from "next/navigation";
import { readSession, roleHome } from "@/lib/auth";

export default async function Home() {
  const session = await readSession();
  redirect(session ? roleHome(session.role) : "/login");
}
