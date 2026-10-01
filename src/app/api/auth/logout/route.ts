import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth";
export async function POST(){ const r=NextResponse.json({ok:true}); clearSessionCookie(r); r.cookies.set("lms_csrf","",{httpOnly:false,path:"/",maxAge:0}); return r; }
