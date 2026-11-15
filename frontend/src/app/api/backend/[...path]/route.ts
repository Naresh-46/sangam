import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const apiUrl = process.env.API_URL || "http://localhost:8000";
type Context = { params: Promise<{ path: string[] }> };

async function forward(request: NextRequest, context: Context) {
  if (
    request.method === "POST" &&
    request.headers.get("origin") !== request.nextUrl.origin
  ) {
    return NextResponse.json(
      { error: "Cross-origin request rejected" },
      { status: 403 },
    );
  }
  const { path } = await context.params;
  if (path[0] === "auth")
    return NextResponse.json(
      { error: "Use the session endpoints for authentication." },
      { status: 404 },
    );
  const token = (await cookies()).get("ananta_session")?.value;
  const upstream = new URL(
    `${apiUrl}/${path.map(encodeURIComponent).join("/")}`,
  );
  upstream.search = request.nextUrl.search;
  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  if (token) headers.set("authorization", `Bearer ${token}`);
  const body = request.method === "GET" ? undefined : await request.text();
  const response = await fetch(upstream, {
    method: request.method,
    headers,
    body,
    cache: "no-store",
  });
  if (response.status === 401) {
    const expired = NextResponse.json(
      { error: "Session expired" },
      { status: 401 },
    );
    expired.cookies.set("ananta_session", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    return expired;
  }
  const data = await response.arrayBuffer();
  return new NextResponse(data, {
    status: response.status,
    headers: {
      "content-type":
        response.headers.get("content-type") || "application/json",
    },
  });
}

export const GET = forward;
export const POST = forward;
