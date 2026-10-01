import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/guards";
import { Role } from "@prisma/client";
import ExamClient, { ExamQuestion } from "./ExamClient";

function seededShuffle<T>(arr: T[], seed: number) {
  const a = [...arr];
  let x = seed || 1;
  for (let i = a.length - 1; i > 0; i--) {
    x = (x * 1664525 + 1013904223) >>> 0;
    const j = x % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default async function ExamPage({ params }: { params: Promise<{ id: string }> }) {
  const s = await requireRole(Role.STUDENT);
  const { id } = await params;
  const exam = await prisma.exam.findFirst({
    where: { id, published: true, course: { enrollments: { some: { studentId: s.id } } } },
    include: { course: { select: { title: true } }, questions: { include: { question: { include: { options: true } } }, orderBy: { sortOrder: "asc" } } },
  });

  if (!exam) return <div className="container-page"><div className="card p-8 max-w-xl"><h1 className="text-xl font-bold">Không tìm thấy đề thi</h1><Link href="/student/exams" className="btn btn-secondary inline-block mt-4">Quay lại</Link></div></div>;

  const now = Date.now();
  if (now < exam.openAt.getTime() || now > exam.closeAt.getTime()) return <div className="container-page"><div className="card p-8 max-w-xl"><span className="pill pill-orange">Chưa được phép truy cập</span><h1 className="text-2xl font-bold mt-3">{now < exam.openAt.getTime() ? "Đề chưa mở" : "Đề đã đóng"}</h1><p className="text-slate-500 mt-2">Hệ thống không gửi câu hỏi xuống trình duyệt trước giờ mở.</p><Link href="/student/exams" className="btn btn-secondary inline-block mt-4">Quay lại</Link></div></div>;

  let attempt = await prisma.attempt.findUnique({ where: { examId_studentId: { examId: exam.id, studentId: s.id } }, include: { answers: true } });
  if (!attempt) {
    await prisma.attempt.create({ data: { examId: exam.id, studentId: s.id, variantSeed: Math.floor(Math.random() * 2147483647) } });
    attempt = await prisma.attempt.findUnique({ where: { examId_studentId: { examId: exam.id, studentId: s.id } }, include: { answers: true } });
  }
  if (!attempt) throw new Error("Attempt creation failed");

  if (attempt.status !== "IN_PROGRESS" && attempt.score != null) return <div className="container-page"><div className="card p-8 max-w-xl"><h1 className="text-2xl font-bold">Bạn đã nộp bài này</h1><div className="text-5xl font-bold mt-4">{attempt.score.toFixed(1)}<span className="text-lg text-slate-400">/10</span></div><Link href="/student/gradebook" className="btn btn-primary inline-block mt-5">Xem sổ điểm</Link></div></div>;

  const order = exam.mixQuestions ? seededShuffle(exam.questions, attempt.variantSeed) : exam.questions;
  const questions: ExamQuestion[] = order.map(x => ({
    id: x.question.id,
    text: x.question.text,
    type: x.question.type,
    points: x.question.points,
    options: x.question.type === "ESSAY" || x.question.type === "SHORT_ANSWER" ? [] : (exam.mixOptions ? seededShuffle(x.question.options, attempt!.variantSeed + x.question.id.length) : x.question.options).map(o => ({ id: o.id, text: o.text })),
  }));
  const existing = Object.fromEntries(attempt.answers.map(a => [a.questionId, a.selectedOptionId || a.textAnswer || ""]));

  return <ExamClient examId={exam.id} title={`${exam.subject || exam.course?.title || "Môn học"} · ${exam.title}`} durationMin={exam.durationMin} questions={questions} existingAnswers={existing} />;
}
