import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/auth";
import { assertCsrf } from "@/lib/csrf";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { z } from "zod";

const schema = z.object({
  title: z.string().trim().min(2).max(200),
  chapter: z.string().trim().min(1).max(100),
  description: z.string().max(2000).default(""),
  videoType: z.enum(["LOCAL", "EMBED"]).default("EMBED"),
  videoUrl: z.string().max(1000).nullable().optional(),
  videoDownloadAllowed: z.boolean().default(false),
});

async function teacher(req: Request) {
  const s = await readSession();

  if (!s || s.role !== "TEACHER") {
    return null;
  }

  try {
    await assertCsrf(req);
  } catch {
    throw new Error("CSRF");
  }

  return s;
}

async function deleteSupabaseVideo(storageKey: string | null) {
  if (!storageKey) return;

  const { error } = await supabaseAdmin.storage
    .from("videos")
    .remove([storageKey]);

  if (error) {
    console.error(
      "Supabase video delete error:",
      error
    );
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let s;

  try {
    s = await teacher(req);
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message },
      { status: 403 }
    );
  }

  if (!s) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { id } = await params;

  try {
    const b = schema.parse(await req.json());

    const c = await prisma.course.findFirst({
      where: {
        id,
        teacherId: s.id,
      },
    });

    if (!c) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    const count = await prisma.lesson.count({
      where: {
        courseId: id,
      },
    });

    const l = await prisma.lesson.create({
      data: {
        ...b,
        videoUrl: b.videoUrl || null,
        courseId: id,
        sortOrder: count + 1,
      },
    });

    const students = await prisma.enrollment.findMany({
      where: {
        courseId: id,
      },
      select: {
        studentId: true,
      },
    });

    if (students.length) {
      await prisma.notification.createMany({
        data: students.map((x) => ({
          userId: x.studentId,
          title: "Bài giảng mới",
          body: `${b.title} vừa được thêm vào khóa học.`,
          createdAt: new Date(),
          href: `/dashboard/courses/${id}`,
        })),
      });
    }

    return NextResponse.json({
      lesson: l,
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Thông tin bài học không hợp lệ.",
        },
        { status: 400 }
      );
    }

    console.error(e);

    return NextResponse.json(
      {
        error: "Không thể tạo bài học.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let s;

  try {
    s = await teacher(req);
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message },
      { status: 403 }
    );
  }

  if (!s) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { id } = await params;

  try {
    const b = schema.partial().parse(
      await req.json()
    );

    const lesson =
      await prisma.lesson.findUnique({
        where: {
          id,
        },
        include: {
          course: true,
        },
      });

    if (
      !lesson ||
      lesson.course.teacherId !== s.id
    ) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    const data: any = {};

    if (b.title !== undefined) {
      data.title = b.title;
    }

    if (b.chapter !== undefined) {
      data.chapter = b.chapter;
    }

    if (b.description !== undefined) {
      data.description = b.description;
    }

    if (
      b.videoDownloadAllowed !== undefined
    ) {
      data.videoDownloadAllowed =
        b.videoDownloadAllowed;
    }

    if (b.videoUrl !== undefined) {
      data.videoUrl = b.videoUrl || null;
    }

    if (b.videoType !== undefined) {
      data.videoType =
        b.videoUrl === null
          ? "EMBED"
          : b.videoType;
    }

    const replacingVideo =
      b.videoUrl !== undefined &&
      lesson.videoUrl &&
      lesson.videoUrl !== b.videoUrl &&
      lesson.videoType === "LOCAL";

    if (replacingVideo) {
      await deleteSupabaseVideo(
        lesson.videoUrl
      );
    }

    const updated =
      await prisma.lesson.update({
        where: {
          id,
        },
        data,
      });

    return NextResponse.json({
      ok: true,
      lesson: updated,
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        {
          error:
            "Thông tin bài học không hợp lệ.",
        },
        { status: 400 }
      );
    }

    console.error(e);

    return NextResponse.json(
      {
        error:
          "Không thể cập nhật bài học.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let s;

  try {
    s = await teacher(req);
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message },
      { status: 403 }
    );
  }

  if (!s) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { id } = await params;

  const lesson =
    await prisma.lesson.findUnique({
      where: {
        id,
      },
      include: {
        course: true,
      },
    });

  if (
    !lesson ||
    lesson.course.teacherId !== s.id
  ) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403 }
    );
  }

  if (
    lesson.videoUrl &&
    lesson.videoType === "LOCAL"
  ) {
    await deleteSupabaseVideo(
      lesson.videoUrl
    );
  }

  const updated =
    await prisma.lesson.update({
      where: {
        id,
      },
      data: {
        videoUrl: null,
        videoType: "EMBED",
        videoDownloadAllowed: false,
      },
    });

  return NextResponse.json({
    ok: true,
    lesson: updated,
  });
}