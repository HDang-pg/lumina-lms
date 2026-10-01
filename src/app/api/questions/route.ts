import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/auth";
import { assertCsrf } from "@/lib/csrf";
import { z } from "zod";

const schema = z.object({
  courseId: z.string().optional().nullable(),
  topic: z.string().trim().min(1).max(100),
  difficulty: z.enum(["NHAN_BIET", "THONG_HIEU", "VAN_DUNG", "VAN_DUNG_CAO"]),
  type: z.enum(["MCQ", "TRUE_FALSE", "SHORT_ANSWER", "ESSAY"]),
  text: z.string().trim().min(3).max(4000),
  points: z.number().min(0.5).max(20),
  explanation: z.string().max(3000).optional().nullable(),
  answerKey: z.string().trim().max(1000).optional().nullable(),
  options: z.array(z.object({ text: z.string().trim().min(1).max(500), isCorrect: z.boolean() })).max(8).default([]),
});

export async function POST(req: Request) {
  const s = await readSession();
  if (!s || s.role !== "TEACHER") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { await assertCsrf(req); } catch { return NextResponse.json({ error: "CSRF" }, { status: 403 }); }

  try {
    const b = schema.parse(await req.json());
    if (b.courseId) {
      const c = await prisma.course.findFirst({ where: { id: b.courseId, teacherId: s.id } });
      if (!c) return NextResponse.json({ error: "Khóa học không thuộc quyền quản lý của bạn." }, { status: 403 });
    }

    if (b.type === "ESSAY") {
      if (b.options.length) return NextResponse.json({ error: "Tự luận không dùng đáp án lựa chọn." }, { status: 400 });
    } else if (b.type === "SHORT_ANSWER") {
      if (!b.answerKey) return NextResponse.json({ error: "Câu trả lời ngắn cần đáp án chuẩn." }, { status: 400 });
      if (b.options.length) return NextResponse.json({ error: "Trả lời ngắn không dùng đáp án lựa chọn." }, { status: 400 });
    } else if (b.type === "TRUE_FALSE") {
      if (b.options.length !== 2 || b.options.filter(x => x.isCorrect).length !== 1) return NextResponse.json({ error: "Đúng/Sai phải có đúng 2 lựa chọn và đúng 1 đáp án đúng." }, { status: 400 });
    } else if (b.options.length < 2 || !b.options.some(x => x.isCorrect)) {
      return NextResponse.json({ error: "Trắc nghiệm cần ít nhất 2 lựa chọn và ít nhất một đáp án đúng." }, { status: 400 });
    }

    const q = await prisma.question.create({
      data: {
        teacherId: s.id,
        courseId: b.courseId || null,
        topic: b.topic,
        difficulty: b.difficulty,
        type: b.type,
        text: b.text,
        points: b.points,
        explanation: b.explanation || null,
        answerKey: b.answerKey || null,
        options: b.options.length ? { create: b.options.map((o, i) => ({ ...o, sortOrder: i })) } : undefined,
      },
      include: { options: true },
    });
    return NextResponse.json({ question: q });
  } catch (e: any) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: "Thông tin câu hỏi không hợp lệ." }, { status: 400 });
    return NextResponse.json({ error: "Không thể tạo câu hỏi." }, { status: 500 });
  }
}
