import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { assertCsrf } from "@/lib/csrf";
import { supabaseAdmin } from "@/lib/supabase-admin";
import crypto from "node:crypto";
import path from "node:path";
import { z } from "zod";

const schema = z.object({
  kind: z.enum(["video", "attachment"]),
  filename: z.string().min(1).max(255),
  contentType: z.string().max(200).optional(),
});

export async function POST(req: Request) {
  const s = await readSession();

  if (!s || s.role !== "TEACHER") {
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

  try {
    const body = schema.parse(await req.json());

    const ext = path.extname(body.filename).toLowerCase();

    const safeName = `${crypto.randomUUID()}${ext}`;

    const bucket =
      body.kind === "video"
        ? "videos"
        : "attachments";

    const { data, error } =
      await supabaseAdmin.storage
        .from(bucket)
        .createSignedUploadUrl(safeName);

    if (error || !data) {
      console.error("Supabase signed upload error:", error);

      return NextResponse.json(
        { error: "Không thể tạo URL upload." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      bucket,
      path: safeName,
      token: data.token,
      storageKey: safeName,
      name: body.filename,
      mime:
        body.contentType ||
        "application/octet-stream",
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Thông tin file không hợp lệ." },
        { status: 400 }
      );
    }

    console.error(e);

    return NextResponse.json(
      { error: "Không thể chuẩn bị upload." },
      { status: 500 }
    );
  }
}