import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";

const stateCookie = "ananta_google_state";
const verifierCookie = "ananta_google_verifier";
const cookiePath = "/api/session/google";

export async function GET(request: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return NextResponse.redirect(new URL("/login?error=google", request.url));
  }

  const state = randomBytes(32).toString("base64url");
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
  const authorizationUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorizationUrl.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  }).toString();

  const response = NextResponse.redirect(authorizationUrl);
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: cookiePath,
    maxAge: 5 * 60,
  };
  response.cookies.set(stateCookie, state, cookieOptions);
  response.cookies.set(verifierCookie, codeVerifier, cookieOptions);
  return response;
}
