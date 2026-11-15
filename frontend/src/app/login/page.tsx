"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";

type LoginResponse = {
  user?: {
    role?: string;
  };
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    setExpired(
      new URLSearchParams(window.location.search).get("expired") === "1",
    );
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);

    try {
      const response = await fetch("/api/session/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (response.status === 401) {
        setError("Invalid email or password");
        return;
      }

      if (response.status === 429) {
        setError("Too many attempts. Please wait a moment and try again.");
        return;
      }

      if (!response.ok) {
        setError("Something went wrong on our end. Please try again.");
        return;
      }

      const data = (await response.json()) as LoginResponse;
      const role = data.user?.role;

      if (role === "REGULATOR") {
        router.replace("/admin");
      } else if (role === "ORGANIZATION") {
        router.replace("/workspace");
      } else {
        setError("Unexpected server response. Please try again.");
      }
    } catch {
      setError("Couldn't complete sign-in. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="shell">
      <SiteHeader area="public" />
      <main className="narrow-main">
        <section className="panel">
          <div className="eyebrow">AUTHORIZED ACCESS</div>
          <h1 className="page-title">Sign in to your workspace</h1>
          <p className="muted">
            Regulator and approved supply-chain organization accounts use this
            sign-in.
          </p>

          {expired && (
            <p className="session-expired" role="status">
              Your session expired. Please sign in again.
            </p>
          )}

          <form className="stack-form" onSubmit={handleSubmit}>
            <label htmlFor="email">
              Email
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>

            <label htmlFor="password">
              Password
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>

            {error && (
              <p className="message failure" role="alert">
                {error}
              </p>
            )}

            <button className="primary" type="submit" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
              {!busy && <span>→</span>}
            </button>
          </form>

          <p className="help-note">
            Need an organization account? Contact your regulator administrator.
            <Link href="/">Return to public verification</Link>
          </p>
        </section>
      </main>
    </div>
  );
}
