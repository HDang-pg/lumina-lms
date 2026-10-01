import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ answerId: string }> }
) {
  const s = await readSession();

  if (!s) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { answerId } = await params;

  const a = await prisma.answer.findUnique({
    where: { id: answerId },
    include: {
      attempt: {
        include: {
          exam: true,
        },
      },
    },
  });

  if (!a || !a.fileKey) {
    return NextResponse.json(
      { error: "Not found" },
      { status: 404 }
    );
  }

  const allowed =
    s.role === "TEACHER"
      ? a.attempt.exam.teacherId === s.id
      : a.attempt.studentId === s.id;

  if (!allowed) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403 }
    );
  }

  const { data, error } =
    await supabaseAdmin.storage
      .from("submissions")
      .createSignedUrl(
        a.fileKey,
        60 * 60,
        {
          download: false,
        }
      );

  if (error || !data?.signedUrl) {
    console.error(
      "Supabase submission signed URL error:",
      error
    );

    return NextResponse.json(
      { error: "Không thể mở ảnh bài làm." },
      { status: 500 }
    );
  }

  return NextResponse.redirect(data.signedUrl);
}