import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  const s = await readSession();

  if (!s) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { lessonId } = await params;

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: {
      course: {
        include: {
          enrollments: {
            where: { studentId: s.id },
          },
        },
      },
    },
  });

  if (
    !lesson ||
    lesson.videoType !== "LOCAL" ||
    !lesson.videoUrl
  ) {
    return NextResponse.json(
      { error: "Not found" },
      { status: 404 }
    );
  }

  const allowed =
    s.role === "TEACHER"
      ? lesson.course.teacherId === s.id
      : !!lesson.course.enrollments.length;

  if (!allowed) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403 }
    );
  }

  const isDownload =
    new URL(req.url).searchParams.get("download") === "1";

  if (
    s.role === "STUDENT" &&
    !lesson.videoDownloadAllowed &&
    isDownload
  ) {
    return NextResponse.json(
      { error: "Tải xuống bị tắt" },
      { status: 403 }
    );
  }

  const { data, error } =
    await supabaseAdmin.storage
      .from("videos")
      .createSignedUrl(
        lesson.videoUrl,
        60 * 60,
        {
          download: isDownload,
        }
      );

  if (error || !data?.signedUrl) {
    console.error(
      "Supabase video signed URL error:",
      error
    );

    return NextResponse.json(
      { error: "Không thể mở video." },
      { status: 500 }
    );
  }

  return NextResponse.redirect(data.signedUrl);
}