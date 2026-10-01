import { cookies } from "next/headers";
import crypto from "crypto";

const CSRF_COOKIE = "lms_csrf";
export async function getCsrfToken() {
  const store = await cookies();
  let token = store.get(CSRF_COOKIE)?.value;
  if (!token) token = crypto.randomBytes(24).toString("hex");
  return token;
}
export async function assertCsrf(request: Request) {
  const cookie = (await cookies()).get(CSRF_COOKIE)?.value;
  const header = request.headers.get("x-csrf-token");
  if (!cookie || !header || cookie !== header) throw new Error("CSRF validation failed");
}
