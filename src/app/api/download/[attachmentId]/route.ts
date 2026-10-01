import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ attachmentId: string }> }
) {
  const s = await readSession();

  if (!s) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { attachmentId } = await params;

  const a = await prisma.attachment.findUnique({
    where: { id: attachmentId },
    include: {
      lesson: {
        include: {
          course: {
            include: {
              enrollments: {
                where: { studentId: s.id },
              },
            },
          },
        },
      },
    },
  });

  if (!a) {
    return NextResponse.json(
      { error: "Not found" },
      { status: 404 }
    );
  }

  if (
    s.role === "STUDENT" &&
    !a.lesson.course.enrollments.length
  ) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403 }
    );
  }

  if (
    s.role === "TEACHER" &&
    a.lesson.course.teacherId !== s.id
  ) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403 }
    );
  }

  const { data, error } =
    await supabaseAdmin.storage
      .from("attachments")
      .createSignedUrl(
        a.storageKey,
        60 * 60,
        {
          download: a.name,
        }
      );

  if (error || !data?.signedUrl) {
    console.error(
      "Supabase attachment signed URL error:",
      error
    );

    return NextResponse.json(
      { error: "Không thể tải file." },
      { status: 500 }
    );
  }

  return NextResponse.redirect(data.signedUrl);
}