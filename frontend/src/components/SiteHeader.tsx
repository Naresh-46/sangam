'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function SiteHeader({ area }: { area: 'public' | 'admin' | 'organization' }) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const logout = async () => {
    await fetch('/api/session/logout', { method: 'POST' });
    router.replace('/'); router.refresh();
  };
  return (
    <header className={`topbar${menuOpen ? " nav-open" : ""}`}>
      <Link className="brand" href="/" onClick={() => setMenuOpen(false)}>
        <span className="brand-mark">S</span>
        <span>SANGAM<small>MEDICINE TRACEABILITY</small></span>
      </Link>
      <button
        type="button"
        className="site-menu-toggle"
        aria-label={menuOpen ? "Close navigation" : "Open navigation"}
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((open) => !open)}
      >
        <span aria-hidden="true">{menuOpen ? "×" : "☰"}</span>
      </button>
      {area === 'public' ? (
        <nav aria-label="Main navigation">
          <Link href="/" onClick={() => setMenuOpen(false)}>Verify a batch</Link>
          <Link className="nav-button" href="/login" onClick={() => setMenuOpen(false)}>Organization sign in →</Link>
        </nav>
      ) : (
        <nav aria-label="Main navigation">
          {area === 'organization' && (
            <>
              <Link href="/workspace" onClick={() => setMenuOpen(false)}>Inventory</Link>
              <a href="/workspace#transfers" onClick={() => setMenuOpen(false)}>Transfers</a>
            </>
          )}
          <button className="signout" onClick={logout}>Sign out</button>
        </nav>
      )}
    </header>
  );
}
