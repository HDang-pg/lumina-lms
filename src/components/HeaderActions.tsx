"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Bell, Camera, CheckCheck, ChevronDown, Eye, EyeOff, LogOut, Save, Settings2, X } from "lucide-react";

 type Profile = {
  id: string;
  name: string;
  nickname: string | null;
  email: string;
  role: "TEACHER" | "STUDENT";
  avatarUrl: string | null;
  age: number | null;
  className: string | null;
};

type Notice = { id: string; title: string; body: string; href: string | null; readAt: string | null; createdAt: string };

function csrf() { return document.cookie.split(";").map(x => x.trim()).find(x => x.startsWith("lms_csrf="))?.split("=")[1] || ""; }
function initials(name: string) { return name.split(" ").filter(Boolean).map(s => s[0]).slice(-2).join("").toUpperCase(); }

function Avatar({ profile, size = "sm" }: { profile: Profile | null; size?: "sm" | "lg" }) {
  const cls = size === "lg" ? "w-14 h-14" : "w-9 h-9";
  if (profile?.avatarUrl) return <img src={profile.avatarUrl} alt="Avatar" className={`${cls} rounded-full object-cover border border-slate-200`} />;
  return <div className={`${cls} rounded-full bg-[#e5eef7] grid place-items-center text-sm font-bold text-[#4f7cac]`}>{initials(profile?.nickname || profile?.name || "U")}</div>;
}

export default function HeaderActions({ initialName, onProfileNameChange }: { initialName: string; initialRole: "TEACHER" | "STUDENT"; onProfileNameChange?: (name: string) => void }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [unread, setUnread] = useState(0);
  const [panel, setPanel] = useState<"notifications" | "profile" | null>(null);
  const [editing, setEditing] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ name: initialName, nickname: "", email: "", age: "", className: "", password: "" });
  const [busy, setBusy] = useState(false);
  const editingRef = useRef(false);

  async function load() {
    const [p, n] = await Promise.all([fetch("/api/profile", { cache: "no-store" }), fetch("/api/notifications", { cache: "no-store" })]);
    if (p.ok) {
      const pd = await p.json(); setProfile(pd.profile);
      if (!editingRef.current) setForm({ name: pd.profile.name || "", nickname: pd.profile.nickname || "", email: pd.profile.email || "", age: pd.profile.age?.toString() || "", className: pd.profile.className || "", password: "" });
    }
    if (n.ok) { const nd = await n.json(); setNotices(nd.notifications); setUnread(nd.unreadCount); }
  }

  useEffect(() => { editingRef.current = editing; }, [editing]);
  useEffect(() => { void load(); const timer = setInterval(() => void load(), 10000); return () => clearInterval(timer); }, []);

  async function openNotice(n: Notice) {
    await fetch("/api/notifications", { method: "PATCH", headers: { "content-type": "application/json", "x-csrf-token": csrf() }, body: JSON.stringify({ id: n.id }) });
    setPanel(null);
    if (n.href) window.location.href = n.href; else await load();
  }
  async function markAllRead() { await fetch("/api/notifications", { method: "PATCH", headers: { "content-type": "application/json", "x-csrf-token": csrf() }, body: JSON.stringify({ all: true }) }); await load(); }

  async function saveProfile() {
    setBusy(true);
    const payload: Record<string, unknown> = { name: form.name, nickname: form.nickname, age: form.age ? Number(form.age) : null, className: form.className };
    if (profile?.role === "TEACHER") payload.email = form.email;
    if (form.password) payload.password = form.password;
    const r = await fetch("/api/profile", { method: "PATCH", headers: { "content-type": "application/json", "x-csrf-token": csrf() }, body: JSON.stringify(payload) });
    const d = await r.json();
    if (r.ok) { setProfile(d.profile); onProfileNameChange?.(d.profile.name); setEditing(false); setForm(x => ({ ...x, password: "" })); }
    else alert(d.error || "Không thể lưu hồ sơ");
    setBusy(false);
  }

  async function uploadAvatar(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return alert("Chỉ hỗ trợ file ảnh.");
    const fd = new FormData(); fd.set("file", file); setBusy(true);
    const r = await fetch("/api/profile/avatar", { method: "POST", headers: { "x-csrf-token": csrf() }, body: fd }); const d = await r.json();
    if (r.ok) setProfile(p => p ? { ...p, avatarUrl: d.avatarUrl } : p); else alert(d.error || "Không thể tải avatar"); setBusy(false);
  }

  async function logout() { await fetch("/api/auth/logout", { method: "POST" }); window.location.href = "/login"; }
  const label = profile?.nickname || profile?.name || initialName;
  const countText = unread > 99 ? "99+" : unread;

  return <div className="relative flex items-center gap-2 sm:gap-3">
    <button onClick={() => setPanel(panel === "notifications" ? null : "notifications")} className="relative w-9 h-9 rounded-xl hover:bg-slate-50 grid place-items-center text-slate-500 transition" title="Thông báo"><Bell size={19}/>{unread > 0 && <span className="absolute -right-1 -top-1 min-w-5 h-5 px-1 rounded-full bg-[#c65d5d] text-white text-[10px] font-bold grid place-items-center">{countText}</span>}</button>
    <button onClick={() => setPanel(panel === "profile" ? null : "profile")} className="flex items-center gap-2 rounded-xl px-1.5 py-1 hover:bg-slate-50 transition" title="Tài khoản"><Avatar profile={profile}/><span className="hidden sm:block max-w-28 truncate text-sm font-semibold text-slate-700">{label}</span><ChevronDown size={15} className="hidden sm:block text-slate-400"/></button>

    {panel === "notifications" && <div className="absolute right-0 top-12 w-[360px] max-w-[calc(100vw-16px)] bg-white border border-slate-200 shadow-2xl rounded-2xl z-50 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3"><div><div className="font-bold">Thông báo</div><div className="text-xs text-slate-400">{unread ? `${unread} thông báo chưa đọc` : "Bạn đã xem hết thông báo"}</div></div>{unread > 0 && <button onClick={() => void markAllRead()} className="text-xs font-semibold text-[#4f7cac] flex items-center gap-1"><CheckCheck size={14}/> Đọc tất cả</button>}</div>
      <div className="max-h-80 overflow-auto">{notices.map(n => <button key={n.id} onClick={() => void openNotice(n)} className={`w-full text-left px-4 py-3 border-b border-slate-50 hover:bg-slate-50 transition ${n.readAt ? "bg-white" : "bg-[#f7fbff]"}`}><div className="flex gap-2"><span className={`mt-1.5 w-2 h-2 rounded-full ${n.readAt ? "bg-transparent" : "bg-[#c65d5d]"}`}/><div className="min-w-0"><div className="font-semibold text-sm truncate">{n.title}</div><div className="text-sm text-slate-500 mt-0.5 line-clamp-2">{n.body}</div><div className="text-[11px] text-slate-400 mt-1">{new Date(n.createdAt).toLocaleString("vi-VN")}</div></div></div></button>)}{!notices.length && <div className="p-8 text-center text-sm text-slate-400">Chưa có thông báo.</div>}</div>
      <div className="p-3 border-t border-slate-100"><Link href="/notifications" onClick={() => setPanel(null)} className="block text-center text-sm font-semibold text-[#4f7cac]">Xem tất cả thông báo</Link></div>
    </div>}

    {panel === "profile" && <div className="absolute right-0 top-12 w-[390px] max-w-[calc(100vw-16px)] bg-white border border-slate-200 shadow-2xl rounded-2xl z-50 p-4 max-h-[calc(100vh-72px)] overflow-y-auto">
      <div className="flex items-start justify-between"><div><div className="font-bold">Hồ sơ cá nhân</div><div className="text-xs text-slate-400 mt-1">{profile?.role === "TEACHER" ? "Giáo viên" : "Học sinh"} · {profile?.email}</div></div><button onClick={() => setPanel(null)} className="text-slate-400 hover:text-slate-700"><X size={18}/></button></div>
      <div className="flex items-center gap-3 mt-4"><Avatar profile={profile} size="lg"/><div><label className="btn btn-secondary text-xs flex items-center gap-1 cursor-pointer"><Camera size={14}/> Đổi avatar<input type="file" className="hidden" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={e => void uploadAvatar(e.target.files?.[0])}/></label><div className="text-xs text-slate-400 mt-1">PNG/JPG/WebP · tối đa 3 MB</div></div></div>
      {!editing ? <div className="mt-4 space-y-2 text-sm"><div><span className="text-slate-400">Tên:</span> <b>{profile?.name}</b></div><div><span className="text-slate-400">Nickname:</span> <b>{profile?.nickname || "Chưa đặt"}</b></div><div><span className="text-slate-400">Tên đăng nhập:</span> <b>{profile?.email}</b></div><div><span className="text-slate-400">Lớp:</span> <b>{profile?.className || "—"}</b></div><div><span className="text-slate-400">Tuổi:</span> <b>{profile?.age || "—"}</b></div><button onClick={() => setEditing(true)} className="btn btn-primary w-full mt-3 flex items-center justify-center gap-2"><Settings2 size={16}/> Chỉnh sửa hồ sơ</button></div>
      : <div className="mt-4 space-y-3">
        <div><label className="text-xs font-semibold text-slate-500">Họ và tên</label><input className="input mt-1" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}/></div>
        {profile?.role === "TEACHER" && <div><label className="text-xs font-semibold text-slate-500">Tên đăng nhập (email)</label><input type="email" className="input mt-1" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}/></div>}
        {profile?.role === "TEACHER" && <div className="grid grid-cols-2 gap-3"><div><label className="text-xs font-semibold text-slate-500">Tuổi</label><input type="number" className="input mt-1" value={form.age} onChange={e => setForm({ ...form, age: e.target.value })}/></div><div><label className="text-xs font-semibold text-slate-500">Lớp / bộ môn</label><input className="input mt-1" value={form.className} onChange={e => setForm({ ...form, className: e.target.value })}/></div></div>}
        <div><label className="text-xs font-semibold text-slate-500">Nickname</label><input className="input mt-1" value={form.nickname} onChange={e => setForm({ ...form, nickname: e.target.value })}/></div>
        {profile?.role === "TEACHER" && <div><label className="text-xs font-semibold text-slate-500">Mật khẩu mới</label><div className="relative"><input autoComplete="new-password" type={showPassword ? "text" : "password"} className="input mt-1 pr-11" placeholder="Để trống nếu không đổi" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}/><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-4 text-slate-400">{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div></div>}
        <div className="flex gap-2"><button onClick={() => setEditing(false)} className="btn btn-secondary flex-1">Hủy</button><button disabled={busy} onClick={() => void saveProfile()} className="btn btn-primary flex-1 flex items-center justify-center gap-2"><Save size={16}/> {busy ? "Đang lưu…" : "Lưu"}</button></div>
      </div>}
      <button onClick={() => void logout()} className="btn btn-danger w-full mt-3 flex items-center justify-center gap-2"><LogOut size={16}/> Đăng xuất</button>
    </div>}
  </div>;
}
