"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, LayoutDashboard, Library, ClipboardList, BarChart3, Users, FileQuestion, GraduationCap, Menu, Trophy, Bell, MessageCircle, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import HeaderActions from "./HeaderActions";

export function AppShell({ children, role, name }: { children: React.ReactNode; role: "TEACHER" | "STUDENT"; name: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState(name);
  const [chatUnread, setChatUnread] = useState(0);

  useEffect(() => {
    let mounted = true;
    async function poll() {
      try {
        const r = await fetch("/api/chat?summary=1", { cache: "no-store" });
        if (r.ok) {
          const d = await r.json();
          if (mounted) setChatUnread(Number(d.unreadTotal || 0));
        }
      } catch {}
    }
    void poll();
    const timer = setInterval(() => void poll(), 5000);
    return () => { mounted = false; clearInterval(timer); };
  }, [pathname]);

  const studentNav = [
    ["/dashboard", "Tổng quan", LayoutDashboard],
    ["/dashboard/courses", "Khóa học", Library],
    ["/student/exams", "Bài kiểm tra", ClipboardList],
    ["/student/gradebook", "Sổ điểm", BarChart3],
    ["/student/progress", "Tiến độ & huy hiệu", Trophy],
    ["/notifications", "Thông báo", Bell],
    ["/chat", "Tin nhắn", MessageCircle],
  ] as const;

  const teacherNav = [
    ["/teacher", "Tổng quan", LayoutDashboard],
    ["/teacher/courses", "Khóa học & bài giảng", Library],
    ["/teacher/students", "Học sinh & lớp", UserRound],
    ["/teacher/questions", "Ngân hàng câu hỏi", FileQuestion],
    ["/teacher/exams", "Đề thi", ClipboardList],
    ["/teacher/grading", "Chấm tự luận", GraduationCap],
    ["/teacher/analytics", "Thống kê lớp", Users],
    ["/notifications", "Thông báo", Bell],
    ["/chat", "Tin nhắn", MessageCircle],
  ] as const;

  const nav = role === "TEACHER" ? teacherNav : studentNav;

  return <div className="min-h-screen flex">
    {open && <button aria-label="Đóng menu" className="fixed inset-0 z-30 bg-slate-900/20 md:hidden" onClick={() => setOpen(false)} />}
    <aside className={`fixed md:static z-40 inset-y-0 left-0 w-[min(18rem,88vw)] bg-white border-r border-slate-200 p-5 flex flex-col overflow-y-auto transition-transform ${open ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}>
      <div className="flex items-center gap-3 px-2 mb-8 shrink-0"><div className="w-10 h-10 rounded-xl bg-[#4f7cac] text-white grid place-items-center"><BookOpen size={20}/></div><div><div className="font-bold">Lumina LMS</div><div className="text-xs text-slate-400">{role === "TEACHER" ? "Teacher workspace" : "Student workspace"}</div></div></div>
      <nav className="space-y-1 flex-1">{nav.map(([href, label, Icon]) => {
        const active = pathname === href || (href !== "/dashboard" && href !== "/teacher" && pathname.startsWith(href + "/"));
        return <Link key={label} href={href} prefetch={false} onClick={() => setOpen(false)} className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition ${active ? "bg-[#edf5fc] text-[#3f6790] font-semibold" : "text-slate-600 hover:bg-slate-50"}`}><Icon size={18}/><span>{label}</span>{label === "Tin nhắn" && chatUnread > 0 && <span className="ml-auto w-5 h-5 rounded-full bg-[#c65d5d] text-white text-[11px] font-black grid place-items-center">!</span>}</Link>;
      })}</nav>
      <div className="mt-6 shrink-0"><div className="rounded-2xl bg-slate-50 p-3"><div className="text-sm font-semibold truncate">{displayName}</div><div className="text-xs text-slate-500">{role === "TEACHER" ? "Giáo viên" : "Học sinh"}</div></div></div>
    </aside>
    <div className="flex-1 min-w-0"><header className="min-h-16 bg-white border-b border-slate-200 flex items-center justify-between gap-3 px-3 sm:px-4 md:px-7 sticky top-0 z-30"><button className="md:hidden btn btn-secondary shrink-0" onClick={() => setOpen(!open)} aria-label="Mở menu"><Menu size={18}/></button><div className="text-xs sm:text-sm text-slate-500 truncate">{role === "TEACHER" ? "Quản lý lớp học" : "Học tập hôm nay"}</div><HeaderActions initialName={displayName} initialRole={role} onProfileNameChange={setDisplayName}/></header><main>{children}</main></div>
  </div>;
}