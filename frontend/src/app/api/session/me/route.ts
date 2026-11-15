import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const apiUrl = process.env.API_URL || "http://localhost:8000";

export async function GET() {
  const token = (await cookies()).get("ananta_session")?.value;
  if (!token)
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const response = await fetch(`${apiUrl}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const reply = NextResponse.json(result, { status: response.status });
    if (response.status === 401) reply.cookies.delete("ananta_session");
    return reply;
  }
  return NextResponse.json(result);
}
