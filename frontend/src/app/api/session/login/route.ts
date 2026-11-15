import { NextRequest, NextResponse } from "next/server";

const apiUrl = process.env.API_URL || "http://localhost:8000";

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return NextResponse.json(
      { error: "Cross-origin request rejected" },
      { status: 403 },
    );
  }
  const payload = await request.json().catch(() => null);
  const response = await fetch(`${apiUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok)
    return NextResponse.json(result, { status: response.status });
  if (
    !result.accessToken ||
    !["REGULATOR", "ORGANIZATION"].includes(result.user?.role)
  ) {
    return NextResponse.json(
      { error: "Unexpected sign-in response" },
      { status: 502 },
    );
  }
  const reply = NextResponse.json({ user: { role: result.user.role } });
  reply.cookies.set("ananta_session", result.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: result.expiresIn,
  });
  return reply;
}
