import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/auth";
import { assertCsrf } from "@/lib/csrf";
import { recordStudyActivity } from "@/lib/streak";
import { z } from "zod";

const schema = z.object({
  lessonId: z.string(),
  watchedSec: z.number().int().min(0).max(86400),
  duration: z.number().int().min(0).max(86400),
});

export async function POST(req: Request) {
  const s = await readSession();

  if (!s || s.role !== "STUDENT") {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    await assertCsrf(req);
  } catch {
    return NextResponse.json(
      { error: "CSRF" },
      { status: 403 }
    );
  }

  const b = schema.parse(await req.json());

  const completed =
    b.duration > 0 &&
    b.watchedSec >= Math.max(1, b.duration - 10);

  await prisma.lessonProgress.upsert({
    where: {
      studentId_lessonId: {
        studentId: s.id,
        lessonId: b.lessonId,
      },
    },
    update: {
      watchedSec: b.watchedSec,
      completed,
    },
    create: {
      studentId: s.id,
      lessonId: b.lessonId,
      watchedSec: b.watchedSec,
      completed,
    },
  });

  const lesson = await prisma.lesson.findUnique({
    where: {
      id: b.lessonId,
    },
    select: {
      courseId: true,
    },
  });

  if (lesson) {
    // Ghi nhận hôm nay có học.
    // Gọi nhiều lần trong cùng ngày cũng chỉ tính 1 lần.
    await recordStudyActivity(s.id);

    const total = await prisma.lesson.count({
      where: {
        courseId: lesson.courseId,
      },
    });

    const done = await prisma.lessonProgress.count({
      where: {
        studentId: s.id,
        lesson: {
          courseId: lesson.courseId,
        },
        completed: true,
      },
    });

    await prisma.enrollment.updateMany({
      where: {
        studentId: s.id,
        courseId: lesson.courseId,
      },
      data: {
        progressPct: total
          ? Math.round((done / total) * 100)
          : 0,
      },
    });
  }

  return NextResponse.json({
    ok: true,
    completed,
  });
}