import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/guards";
import { Role } from "@prisma/client";
import GradeClient from "./GradeClient";

export default async function Grading({ searchParams }: { searchParams: Promise<{ attemptId?: string }> }) {
  const s = await requireRole(Role.TEACHER);
  const { attemptId } = await searchParams;
  const focusAttempt = attemptId ? await prisma.attempt.findFirst({ where: { id: attemptId, exam: { teacherId: s.id } }, include: { student: { select: { name: true, email: true, className: true } }, exam: { select: { title: true } } } }) : null;

  const items = await prisma.answer.findMany({
    where: focusAttempt
      ? { attemptId: focusAttempt.id, question: { teacherId: s.id } }
      : { graded: false, question: { teacherId: s.id, type: "ESSAY" } },
    include: { question: true, attempt: { include: { student: { select: { name: true, email: true, className: true } }, exam: { select: { title: true } } } } },
    orderBy: { attempt: { startedAt: "asc" } },
  });

  return <div className="container-page fade-in">
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
      <div><div className="text-sm text-slate-500">Chấm bài</div><h1 className="text-3xl font-bold mt-1">Bài nộp & chấm tự luận</h1><p className="text-slate-500 mt-2">Chọn thông báo bài nộp để mở đúng bài của học sinh; câu tự luận có thể nhập điểm và nhận xét trực tiếp.</p></div>
      {focusAttempt && <Link href="/teacher/grading" className="btn btn-secondary">← Danh sách chờ chấm</Link>}
    </div>
    {focusAttempt && <div className="mt-5 card p-4 border-[#b7cde1] bg-[#f8fbfe]"><div className="font-bold">Đang chấm: {focusAttempt.student.name}</div><div className="text-sm text-slate-500 mt-1">{focusAttempt.student.email} · {focusAttempt.student.className || "Chưa xếp lớp"} · {focusAttempt.exam.title}</div></div>}
    <div className="mt-6"><GradeClient initial={items} focusAttemptId={focusAttempt?.id || null}/></div>
  </div>;
}
