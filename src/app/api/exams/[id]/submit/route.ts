import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/auth";
import { assertCsrf } from "@/lib/csrf";
import { z } from "zod";

const schema = z.object({
  answers: z.record(z.string(), z.string()).default({}),
  files: z.record(z.string(), z.string()).default({}),
  autoSubmitted: z.boolean().default(false),
});

function normalizeAnswer(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function shortAnswerCorrect(raw: string, key: string | null) {
  if (!key) return false;
  const a = normalizeAnswer(raw);
  return key.split("|").some(expected => {
    const b = normalizeAnswer(expected);
    if (a === b) return true;
    const na = Number(a.replace(",", "."));
    const nb = Number(b.replace(",", "."));
    return Number.isFinite(na) && Number.isFinite(nb) && Math.abs(na - nb) <= 1e-9;
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await readSession();
  if (!s || s.role !== "STUDENT") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { await assertCsrf(request); } catch { return NextResponse.json({ error: "CSRF validation failed" }, { status: 403 }); }

  const { id } = await params;
  const body = schema.parse(await request.json());
  const now = new Date();
  const exam = await prisma.exam.findFirst({
    where: { id, published: true, openAt: { lte: now }, closeAt: { gte: now }, course: { enrollments: { some: { studentId: s.id } } } },
    include: { questions: { include: { question: { include: { options: true } } } }, course: { select: { title: true, teacherId: true } } },
  });
  if (!exam) return NextResponse.json({ error: "Đề thi không khả dụng." }, { status: 403 });

  const attempt = await prisma.attempt.findUnique({ where: { examId_studentId: { examId: id, studentId: s.id } } });
  if (!attempt || attempt.status !== "IN_PROGRESS") return NextResponse.json({ error: "Attempt không hợp lệ hoặc đã nộp." }, { status: 409 });

  if (now.getTime() > attempt.startedAt.getTime() + exam.durationMin * 60000 + 5000) body.autoSubmitted = true;

  const answerRows: any[] = [];
  let earned = 0;
  let total = 0;
  let pendingEssay = false;

  for (const eq of exam.questions) {
    const q = eq.question;
    total += q.points;
    const raw = body.answers[q.id] || "";
    let pts = 0;
    let graded = true;
    if (q.type === "ESSAY") {
      pendingEssay = true;
      graded = false;
    } else if (q.type === "SHORT_ANSWER") {
      if (shortAnswerCorrect(raw, q.answerKey)) pts = q.points;
    } else {
      const correct = q.options.find(o => o.isCorrect);
      if (correct && raw === correct.id) pts = q.points;
    }
    earned += pts;
    answerRows.push({
      attemptId: attempt.id,
      questionId: q.id,
      selectedOptionId: q.type === "MCQ" || q.type === "TRUE_FALSE" ? raw || null : null,
      textAnswer: q.type === "ESSAY" || q.type === "SHORT_ANSWER" ? raw || null : null,
      fileKey: q.type === "ESSAY" && body.files[q.id]?.startsWith("submissions/") ? body.files[q.id] : null,
      pointsEarned: pts,
      graded,
    });
  }

  const score = Math.round((earned / Math.max(total, 1)) * 100) / 10;

  // Thêm cấu hình timeout 15000ms (15 giây) vào transaction
  await prisma.$transaction(
    async tx => {
      for (const a of answerRows) await tx.answer.upsert({ where: { attemptId_questionId: { attemptId: a.attemptId, questionId: a.questionId } }, update: a, create: a });
      await tx.attempt.update({ where: { id: attempt.id }, data: { submittedAt: now, status: body.autoSubmitted ? "AUTO_SUBMITTED" : "SUBMITTED", score } });
      await tx.gamification.upsert({ where: { studentId: s.id }, update: { points: { increment: 20 }, streak: { increment: 1 }, lastStudyAt: now }, create: { studentId: s.id, points: 20, streak: 1, lastStudyAt: now } });
      for (const code of ["FIRST_ASSIGNMENT", "ON_TIME_HERO"] as const) await tx.studentBadge.upsert({ where: { studentId_code: { studentId: s.id, code } }, update: {}, create: { studentId: s.id, code } });
      await tx.notification.create({ data: { userId: exam.course.teacherId, title: "Có bài nộp mới", body: `${s.name} đã nộp bài "${exam.title}".`, href: `/teacher/grading?attemptId=${attempt.id}` } });
    },
    {
      maxWait: 5000,
      timeout: 15000, // Tăng từ 5s mặc định lên 15s
    }
  );

  return NextResponse.json({ score, pendingEssay });
}
