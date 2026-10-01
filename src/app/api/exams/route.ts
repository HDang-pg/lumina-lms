import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/auth";
import { assertCsrf } from "@/lib/csrf";
import { z } from "zod";

const schema = z.object({
  courseId: z.string(),
  title: z.string().trim().min(3).max(200),
  subject: z.string().trim().min(1).max(120).optional().default(""),
  category: z.enum(["PRACTICE", "QUIZ", "MIDTERM", "FINAL"]),
  openAt: z.string().min(1),
  closeAt: z.string().min(1),
  durationMin: z.number().int().min(1).max(10080),
  weight: z.number().min(0).max(100),
  mixQuestions: z.boolean(),
  mixOptions: z.boolean(),
  showResultImmediately: z.boolean(),
  published: z.boolean(),
  questionIds: z.array(z.string()).min(1).max(100),
});

export async function POST(req: Request) {
  const s = await readSession();
  if (!s || s.role !== "TEACHER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await assertCsrf(req);
  } catch {
    return NextResponse.json({ error: "CSRF" }, { status: 403 });
  }

  try {
    const b = schema.parse(await req.json());
    const course = await prisma.course.findFirst({
      where: { id: b.courseId, teacherId: s.id },
      select: { id: true, title: true },
    });

    if (!course) {
      return NextResponse.json({ error: "Khóa học không thuộc quyền quản lý của bạn." }, { status: 403 });
    }

    const openAt = new Date(b.openAt);
    const closeAt = new Date(b.closeAt);
    if (!Number.isFinite(openAt.getTime()) || !Number.isFinite(closeAt.getTime())) {
      return NextResponse.json({ error: "Thời gian mở/đóng không hợp lệ." }, { status: 400 });
    }
    if (!(closeAt > openAt)) {
      return NextResponse.json({ error: "Thời gian đóng phải sau thời gian mở." }, { status: 400 });
    }

    const questionIds = [...new Set(b.questionIds)];
    const valid = await prisma.question.findMany({
      where: {
        id: { in: questionIds },
        teacherId: s.id,
        OR: [{ courseId: b.courseId }, { courseId: null }],
      },
      select: { id: true },
    });

    if (valid.length !== questionIds.length) {
      return NextResponse.json({ error: "Có câu hỏi không thuộc khóa học / ngân hàng của giáo viên." }, { status: 400 });
    }

    const exam = await prisma.exam.create({
      data: {
        teacherId: s.id,
        courseId: b.courseId,
        title: b.title,
        subject: b.subject || course.title,
        category: b.category,
        openAt,
        closeAt,
        durationMin: b.durationMin,
        weight: b.weight,
        mixQuestions: b.mixQuestions,
        mixOptions: b.mixOptions,
        showResultImmediately: b.showResultImmediately,
        published: b.published,
        questions: {
          create: questionIds.map((questionId, i) => ({ questionId, sortOrder: i })),
        },
      },
    });

    const students = await prisma.enrollment.findMany({
      where: { courseId: course.id },
      select: { studentId: true },
    });

    if (students.length) {
      await prisma.notification.createMany({
        data: students.map((x) => ({
          userId: x.studentId,
          title: "Đề thi mới",
          body: `${exam.subject ? `${exam.subject} · ` : ""}${exam.title} đã được phát hành.`,
          href: `/student/exams/${exam.id}`,
          createdAt: new Date(),
        })),
      });
    }

    return NextResponse.json({ exam });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Thông tin đề thi không hợp lệ." }, { status: 400 });
    }
    return NextResponse.json({ error: "Không thể tạo đề thi." }, { status: 500 });
  }
}
