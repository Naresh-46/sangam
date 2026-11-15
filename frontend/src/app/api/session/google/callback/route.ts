import { NextRequest, NextResponse } from "next/server";

const stateCookie = "ananta_google_state";
const verifierCookie = "ananta_google_verifier";
const cookiePath = "/api/session/google";

function clearOAuthCookies(response: NextResponse) {
  response.cookies.set(stateCookie, "", { httpOnly: true, path: cookiePath, maxAge: 0 });
  response.cookies.set(verifierCookie, "", { httpOnly: true, path: cookiePath, maxAge: 0 });
  return response;
}

function loginError(request: NextRequest) {
  return clearOAuthCookies(NextResponse.redirect(new URL("/login?error=google", request.url)));
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const returnedState = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get(stateCookie)?.value;
  const codeVerifier = request.cookies.get(verifierCookie)?.value;
  if (!code || !returnedState || !expectedState || returnedState !== expectedState || !codeVerifier) {
    return loginError(request);
  }

  const apiUrl = process.env.API_URL || "http://localhost:8000";
  try {
    const backendResponse = await fetch(`${apiUrl}/auth/google/callback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, codeVerifier }),
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    const result: unknown = await backendResponse.json().catch(() => null);
    if (!backendResponse.ok || !result || typeof result !== "object") {
      return loginError(request);
    }

    const session = result as {
      token?: unknown;
      expiresIn?: unknown;
      user?: { id?: unknown; email?: unknown; role?: unknown };
    };
    if (
      typeof session.token !== "string" ||
      typeof session.user?.id !== "string" ||
      typeof session.user.email !== "string" ||
      !["REGULATOR", "ORGANIZATION", "CONSUMER"].includes(String(session.user.role))
    ) {
      return loginError(request);
    }

    const destination = session.user.role === "ORGANIZATION"
      ? "/workspace"
      : session.user.role === "REGULATOR"
        ? "/admin"
        : "/";
    const response = clearOAuthCookies(NextResponse.redirect(new URL(destination, request.url)));
    response.cookies.set("ananta_session", session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: typeof session.expiresIn === "number" && Number.isFinite(session.expiresIn)
        ? session.expiresIn
        : 30 * 60,
    });
    return response;
  } catch {
    return loginError(request);
  }
}
