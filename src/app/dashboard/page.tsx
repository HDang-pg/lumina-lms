import Link from "next/link";
import { CalendarClock, CheckCircle2, Clock3, PlayCircle, Trophy } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/guards";
import { Role } from "@prisma/client";
import { StatCard } from "@/components/StatCard";
import { ProgressBar } from "@/components/ProgressBar";

function viTime(value: Date) { return value.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }); }
function viDate(value: Date) { return new Intl.DateTimeFormat("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" }).format(value); }

export default async function StudentDashboard(){
  const s=await requireRole(Role.STUDENT);
  const [enrollments, attempts, exams, game, notifs]=await Promise.all([
    prisma.enrollment.findMany({where:{studentId:s.id},include:{course:true},orderBy:{createdAt:"desc"}}),
    prisma.attempt.findMany({where:{studentId:s.id,status:{in:["SUBMITTED","AUTO_SUBMITTED"]}},include:{exam:true},orderBy:{submittedAt:"desc"},take:5}),
    prisma.exam.findMany({where:{published:true,openAt:{lte:new Date()},closeAt:{gte:new Date()},course:{enrollments:{some:{studentId:s.id}}}},include:{course:true},orderBy:{openAt:"asc"},take:4}),
    prisma.gamification.findUnique({where:{studentId:s.id}}),
    prisma.notification.findMany({where:{userId:s.id},orderBy:{createdAt:"desc"},take:3})
  ]);
  const avg=attempts.length?attempts.reduce((a,x)=>a+(x.score||0),0)/attempts.length:0;
  const completed=await prisma.lessonProgress.count({where:{studentId:s.id,completed:true}});
  return <div className="container-page fade-in">
    <div className="mb-7"><div className="text-sm text-slate-500">{viDate(new Date())}</div><h1 className="text-3xl font-bold mt-1">Chào {s.name.split(" ").slice(-1)[0]}, hôm nay học gì?</h1><p className="text-slate-500 mt-2">Giữ nhịp đều — vài phiên ngắn mỗi ngày thường hiệu quả hơn một buổi quá dài.</p></div>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4"><StatCard label="Điểm trung bình gần đây" value={`${avg.toFixed(1)}/10`} note="5 lần làm gần nhất"/><StatCard label="Bài đã hoàn thành" value={completed} note="lesson progress"/><StatCard label="Streak" value={`${game?.streak||0} ngày`} note={`${game?.points||0} điểm thưởng`}/><StatCard label="Bài kiểm tra đang mở" value={exams.length} note="Có thể vào làm ngay"/></div>
    <div className="grid xl:grid-cols-[1.5fr_1fr] gap-5 mt-6">
      <section className="card p-5"><div className="flex justify-between items-center mb-5"><div><h2 className="font-bold text-lg">Khóa học của tôi</h2><p className="text-sm text-slate-500">Tiếp tục nơi bạn đang dở.</p></div><Link href="/dashboard/courses" className="text-sm text-[#4f7cac] font-semibold">Xem tất cả</Link></div>
        <div className="space-y-3">{enrollments.map(e=><Link key={e.id} href={`/dashboard/courses/${e.courseId}`} className="block border border-slate-200 rounded-2xl p-4 hover-lift"><div className="flex justify-between gap-4"><div><div className="font-semibold">{e.course.title}</div><div className="text-sm text-slate-500 mt-1">Khóa học · {e.progressPct}%</div></div><PlayCircle className="text-[#4f7cac]"/></div><div className="mt-3"><ProgressBar value={e.progressPct}/></div></Link>)}</div>
      </section>
      <section className="card p-5"><div className="flex justify-between items-center mb-4"><div><h2 className="font-bold text-lg">Đang mở</h2><p className="text-sm text-slate-500">Bài thi cần chú ý.</p></div><Clock3 className="text-slate-400"/></div>
        <div className="space-y-3">{exams.map(e=><Link key={e.id} href={`/student/exams/${e.id}`} className="block rounded-2xl bg-slate-50 p-4 hover:bg-[#edf5fc] transition"><div className="font-semibold">{e.title}</div><div className="text-xs text-slate-500 mt-1">{e.durationMin} phút · đóng {viTime(e.closeAt)}</div><span className="pill pill-green mt-3">Đang mở</span></Link>)}{!exams.length&&<div className="text-sm text-slate-500 py-6">Không có bài thi đang mở.</div>}</div>
      </section>
    </div>
    <div className="grid lg:grid-cols-2 gap-5 mt-5">
      <section className="card p-5"><h2 className="font-bold text-lg mb-4">Điểm gần đây</h2><div className="divide-y divide-slate-100">{attempts.map(a=><div key={a.id} className="py-3 flex justify-between"><div><div className="font-medium text-sm">{a.exam.title}</div><div className="text-xs text-slate-400">{a.submittedAt?.toLocaleString("vi-VN")}</div></div><div className="font-bold">{a.score?.toFixed(1)}/10</div></div>)}</div>{!attempts.length&&<div className="text-sm text-slate-500">Chưa có điểm.</div>}</section>
      <section className="card p-5"><div className="flex justify-between items-center mb-4"><h2 className="font-bold text-lg">Thông báo</h2><CalendarClock className="text-slate-400"/></div><div className="space-y-3">{notifs.map(n=><div key={n.id} className="p-3 rounded-xl bg-slate-50"><div className="font-medium text-sm">{n.title}</div><div className="text-sm text-slate-500 mt-1">{n.body}</div></div>)}</div></section>
    </div>
  </div>;
}
