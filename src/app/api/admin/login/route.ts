import { NextRequest, NextResponse } from "next/server";
import { createAdminToken, COOKIE_NAME } from "@/lib/session";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const password = typeof body.password === "string" ? body.password : "";

  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || password !== expected) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const token = await createAdminToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });
  return res;
}
