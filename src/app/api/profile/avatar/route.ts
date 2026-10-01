import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { assertCsrf } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase-admin";
import crypto from "node:crypto";
import path from "node:path";

export async function POST(req: Request) {
  const s = await readSession();

  if (!s) {
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

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Thiếu file" },
      { status: 400 }
    );
  }

  if (
    !/^image\/(png|jpeg|webp)$/.test(file.type) ||
    file.size > 5 * 1024 * 1024
  ) {
    return NextResponse.json(
      {
        error: "Chỉ nhận PNG/JPEG/WebP ≤ 5MB.",
      },
      { status: 400 }
    );
  }

  const ext =
    path.extname(file.name).toLowerCase() || ".jpg";

  const filename =
    `${crypto.randomUUID()}${ext}`;

  const { error } =
    await supabaseAdmin.storage
      .from("avatars")
      .upload(
        filename,
        Buffer.from(await file.arrayBuffer()),
        {
          contentType: file.type,
          upsert: false,
        }
      );

  if (error) {
    console.error(
      "Supabase avatar upload error:",
      error
    );

    return NextResponse.json(
      { error: "Không thể tải ảnh lên." },
      { status: 500 }
    );
  }

  const avatarUrl =
    `/api/profile/avatar/${filename}`;

  await prisma.user.update({
    where: {
      id: s.id,
    },
    data: {
      avatarUrl,
    },
  });

  return NextResponse.json({
    ok: true,
    avatarUrl,
  });
}