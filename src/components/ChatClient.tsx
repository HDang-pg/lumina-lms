"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, MessageCircle, Send, UserRound } from "lucide-react";
import { AppShell } from "./AppShell";

type Person = { id: string; name: string; nickname: string | null; avatarUrl: string | null; role: "TEACHER" | "STUDENT" };
type Conv = { id: string; other: Person; lastMessage: { body: string; createdAt: string; senderId: string } | null; unreadCount: number };
type Message = { id: string; senderId: string; body: string; createdAt: string; readAt: string | null };
function csrf() { return document.cookie.split(";").map(x => x.trim()).find(x => x.startsWith("lms_csrf="))?.split("=")[1] || ""; }
function initials(p: Person) { return (p.nickname || p.name).split(" ").filter(Boolean).map(x => x[0]).slice(-2).join("").toUpperCase(); }

export default function ChatClient({ role, name }: { role: "TEACHER" | "STUDENT"; name: string }) {
  const search = useSearchParams();
  const queryConversationId = search.get("conversationId");
  const openedFromQuery = useRef<string | null>(null);
  const [conversations, setConversations] = useState<Conv[]>([]);
  const [contacts, setContacts] = useState<Person[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [currentOther, setCurrentOther] = useState<Person | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [showContacts, setShowContacts] = useState(false);
  const [mobileChat, setMobileChat] = useState(false);

  async function refreshList() {
    const r = await fetch("/api/chat", { cache: "no-store" });
    if (!r.ok) return null;
    const d = await r.json();
    setConversations(d.conversations || []);
    setContacts(d.contacts || []);
    return d;
  }

  async function openConversation(id: string, other?: Person) {
    setCurrentId(id);
    if (other) setCurrentOther(other);
    setShowContacts(false);
    setMobileChat(true);
    const r = await fetch(`/api/chat?conversationId=${encodeURIComponent(id)}`, { cache: "no-store" });
    if (!r.ok) return;
    const d = await r.json();
    setCurrentOther(d.conversation.other);
    setMessages(d.messages || []);
    await fetch("/api/chat/read", { method: "PATCH", headers: { "content-type": "application/json", "x-csrf-token": csrf() }, body: JSON.stringify({ conversationId: id }) });
    await refreshList();
  }

  useEffect(() => {
    let mounted = true;
    (async () => { const d = await refreshList(); if (!mounted || !queryConversationId || openedFromQuery.current === queryConversationId) return; const c = d?.conversations?.find((x: Conv) => x.id === queryConversationId); if (c) { openedFromQuery.current = queryConversationId; await openConversation(c.id, c.other); } })();
    return () => { mounted = false; };
  }, [queryConversationId]);

  useEffect(() => {
    const timer = setInterval(() => {
      void refreshList();
      if (currentId && currentOther) void openConversation(currentId, currentOther);
    }, 7000);
    return () => clearInterval(timer);
  }, [currentId, currentOther]);

  async function startWith(p: Person) {
    const existing = conversations.find(c => c.other.id === p.id);
    if (existing) return openConversation(existing.id, p);
    setCurrentOther(p); setCurrentId(null); setMessages([]); setShowContacts(false); setMobileChat(true);
  }

  async function send() {
    if (!text.trim() || !currentOther || busy) return;
    setBusy(true);
    const r = await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json", "x-csrf-token": csrf() }, body: JSON.stringify({ recipientId: currentOther.id, body: text.trim() }) });
    const d = await r.json();
    if (r.ok) { setText(""); await openConversation(d.conversationId, currentOther); }
    else alert(d.error || "Không thể gửi tin nhắn");
    setBusy(false);
  }

  const availableContacts = useMemo(() => contacts.filter(c => !conversations.some(x => x.other.id === c.id)), [contacts, conversations]);

  return <AppShell role={role} name={name}>
    <div className="container-page fade-in">
      <div className="mb-5"><div className="text-sm text-slate-500">Trao đổi học tập</div><h1 className="text-3xl font-bold mt-1">Tin nhắn</h1><p className="text-slate-500 mt-2">Nhắn tin trực tiếp giữa giáo viên và học sinh trong phạm vi lớp học được cấp quyền.</p></div>
      <div className="card overflow-hidden grid md:grid-cols-[300px_1fr] min-h-[540px] md:min-h-[620px]">
        <aside className={`${mobileChat ? "hidden md:block" : "block"} border-r border-slate-200 bg-white`}>
          <div className="p-4 border-b border-slate-100 flex items-center justify-between"><div className="font-bold">Cuộc trò chuyện</div><button onClick={() => setShowContacts(!showContacts)} className="btn btn-secondary p-2" title="Liên hệ mới"><MessageCircle size={16}/></button></div>
          {showContacts && <div className="p-3 border-b border-slate-100 bg-slate-50"><div className="text-xs text-slate-400 mb-2">Liên hệ có thể nhắn</div>{contacts.map(p => <button key={p.id} onClick={() => void startWith(p)} className="w-full text-left p-2 rounded-xl hover:bg-white flex items-center gap-2"><span className="w-8 h-8 rounded-full bg-[#edf5fc] grid place-items-center text-xs font-bold text-[#4f7cac]">{initials(p)}</span><span className="text-sm truncate">{p.nickname || p.name}</span></button>)}{!contacts.length && <div className="text-xs text-slate-400">Chưa có liên hệ được cấp quyền.</div>}</div>}
          <div className="divide-y divide-slate-100">{conversations.map(c => <button key={c.id} onClick={() => void openConversation(c.id, c.other)} className={`w-full text-left p-3 flex gap-3 hover:bg-slate-50 ${currentId === c.id ? "bg-[#edf5fc]" : ""}`}><span className="w-10 h-10 rounded-full bg-[#e5eef7] grid place-items-center text-xs font-bold text-[#4f7cac] shrink-0">{initials(c.other)}</span><span className="min-w-0 flex-1"><span className="flex justify-between gap-2"><span className="font-semibold text-sm truncate">{c.other.nickname || c.other.name}</span>{c.unreadCount > 0 && <span className="pill pill-blue">{c.unreadCount}</span>}</span><span className="text-xs text-slate-400 line-clamp-1">{c.lastMessage?.body || "Chưa có tin nhắn"}</span></span></button>)}{!conversations.length && <div className="p-6 text-center text-sm text-slate-400">Chưa có cuộc trò chuyện.</div>}</div>
        </aside>
        <section className={`${mobileChat ? "block" : "hidden md:flex"} flex flex-col min-h-[540px] md:min-h-[620px] bg-[#fbfcfe]`}>
          {currentOther ? <>
            <div className="px-4 sm:px-5 py-4 border-b border-slate-200 bg-white flex items-center gap-3"><button className="md:hidden btn btn-secondary p-2" onClick={() => setMobileChat(false)} aria-label="Quay lại"><ArrowLeft size={17}/></button><span className="w-10 h-10 rounded-full bg-[#e5eef7] grid place-items-center text-xs font-bold text-[#4f7cac]">{initials(currentOther)}</span><div><div className="font-bold">{currentOther.nickname || currentOther.name}</div><div className="text-xs text-slate-400">{currentOther.role === "TEACHER" ? "Giáo viên" : "Học sinh"}</div></div></div>
            <div className="flex-1 p-4 sm:p-5 space-y-3 overflow-auto">{messages.map(m => <div key={m.id} className={`flex ${m.senderId === currentOther.id ? "justify-start" : "justify-end"}`}><div className={`max-w-[88%] sm:max-w-[78%] rounded-2xl px-4 py-3 ${m.senderId === currentOther.id ? "bg-white border border-slate-200" : "bg-[#4f7cac] text-white"}`}><div className="text-sm whitespace-pre-wrap break-words">{m.body}</div><div className={`text-[10px] mt-1 ${m.senderId === currentOther.id ? "text-slate-400" : "text-white/75"}`}>{new Date(m.createdAt).toLocaleString("vi-VN")}</div></div></div>)}{!messages.length && <div className="h-full grid place-items-center text-sm text-slate-400">Bắt đầu cuộc trò chuyện.</div>}</div>
            <div className="p-3 sm:p-4 border-t border-slate-200 bg-white"><div className="flex gap-2"><input className="input" placeholder="Nhập tin nhắn…" value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }} /><button disabled={busy || !text.trim()} onClick={() => void send()} className="btn btn-primary px-4"><Send size={17}/></button></div></div>
          </> : <div className="flex-1 grid place-items-center text-center p-10"><div><UserRound className="mx-auto text-[#4f7cac]" size={42}/><h2 className="font-bold text-xl mt-4">Chọn một cuộc trò chuyện</h2><p className="text-slate-500 mt-1">Bạn chỉ có thể nhắn trong phạm vi lớp học và khóa học đã được cấp quyền.</p></div></div>}
        </section>
      </div>
    </div>
  </AppShell>;
}
