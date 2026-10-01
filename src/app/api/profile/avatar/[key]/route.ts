import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params;

  if (!key || key.includes("/") || key.includes("\\")) {
    return NextResponse.json(
      { error: "Invalid avatar key" },
      { status: 400 }
    );
  }

  const { data, error } =
    await supabaseAdmin.storage
      .from("avatars")
      .createSignedUrl(
        key,
        60 * 60
      );

  if (error || !data?.signedUrl) {
    return NextResponse.json(
      { error: "Avatar not found" },
      { status: 404 }
    );
  }

  return NextResponse.redirect(
    data.signedUrl
  );
}