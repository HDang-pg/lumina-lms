import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { assertCsrf } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase-admin";
import crypto from "node:crypto";
import path from "node:path";

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

  const fd = await req.formData();
  const file = fd.get("file");
  const examId = String(fd.get("examId") || "");

  if (!(file instanceof File) || !examId) {
    return NextResponse.json(
      { error: "Thiếu file hoặc examId" },
      { status: 400 }
    );
  }

  const exam = await prisma.exam.findFirst({
    where: {
      id: examId,
      published: true,
      course: {
        enrollments: {
          some: {
            studentId: s.id,
          },
        },
      },
    },
  });

  if (!exam) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403 }
    );
  }

  if (
    !/^image\/(png|jpeg|webp)$/.test(file.type) ||
    file.size > 10 * 1024 * 1024
  ) {
    return NextResponse.json(
      {
        error: "Chỉ nhận PNG/JPEG/WebP ≤ 10MB.",
      },
      { status: 400 }
    );
  }

  const ext =
    path.extname(file.name).toLowerCase() || ".jpg";

  const key = `submissions/${crypto.randomUUID()}${ext}`;

  const { error } =
    await supabaseAdmin.storage
      .from("submissions")
      .upload(
        key,
        Buffer.from(await file.arrayBuffer()),
        {
          contentType: file.type,
          upsert: false,
        }
      );

  if (error) {
    console.error(
      "Supabase submission upload error:",
      error
    );

    return NextResponse.json(
      { error: "Không thể tải ảnh lên." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    storageKey: key,
  });
}