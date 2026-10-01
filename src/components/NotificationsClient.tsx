"use client";

import { useEffect, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { AppShell } from "./AppShell";

type Notice = { id: string; title: string; body: string; href: string | null; readAt: string | null; createdAt: string };
function csrf() { return document.cookie.split(";").map(x => x.trim()).find(x => x.startsWith("lms_csrf="))?.split("=")[1] || ""; }

export default function NotificationsClient({ role, name }: { role: "TEACHER" | "STUDENT"; name: string }) {
  const [items, setItems] = useState<Notice[]>([]);
  async function load() { const r = await fetch("/api/notifications", { cache: "no-store" }); if (r.ok) { const d = await r.json(); setItems(d.notifications); } }
  useEffect(() => { void load(); }, []);
  async function openNotice(n: Notice) {
    await fetch("/api/notifications", { method: "PATCH", headers: { "content-type": "application/json", "x-csrf-token": csrf() }, body: JSON.stringify({ id: n.id }) });
    if (n.href) window.location.href = n.href;
    else await load();
  }
  async function markAll() { await fetch("/api/notifications", { method: "PATCH", headers: { "content-type": "application/json", "x-csrf-token": csrf() }, body: JSON.stringify({ all: true }) }); await load(); }
  return <AppShell role={role} name={name}>
    <div className="container-page fade-in">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div><div className="text-sm text-slate-500">Trung tâm thông báo</div><h1 className="text-3xl font-bold mt-1">Thông báo</h1><p className="text-slate-500 mt-2">Bấm vào từng thông báo để đi thẳng đến phần cần xử lý.</p></div>
        {items.some(x => !x.readAt) && <button onClick={() => void markAll()} className="btn btn-secondary flex items-center gap-2"><CheckCheck size={16}/> Đọc tất cả</button>}
      </div>
      <div className="mt-6 space-y-3">{items.map(n => <button key={n.id} onClick={() => void openNotice(n)} className={`w-full text-left card p-5 hover-lift ${n.readAt ? "" : "border-[#b7cde1] bg-[#f8fbfe]"}`}>
        <div className="flex gap-3"><Bell className="text-[#4f7cac] mt-0.5 shrink-0" size={20}/><div className="min-w-0"><div className="flex items-center gap-2"><div className="font-bold">{n.title}</div>{!n.readAt && <span className="pill pill-blue">Mới</span>}</div><div className="text-slate-600 mt-1">{n.body}</div><div className="text-xs text-slate-400 mt-2">{new Date(n.createdAt).toLocaleString("vi-VN")}</div><div className="text-xs text-[#4f7cac] font-semibold mt-2">{n.href ? "Mở nội dung liên quan →" : "Đã xem"}</div></div></div>
      </button>)}{!items.length && <div className="card p-10 text-center text-slate-400">Chưa có thông báo.</div>}</div>
    </div>
  </AppShell>;
}
