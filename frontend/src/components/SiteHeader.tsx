'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

export function SiteHeader({ area }: { area: 'public' | 'admin' | 'organization' }) {
  const router = useRouter();
  const logout = async () => {
    await fetch('/api/session/logout', { method: 'POST' });
    router.replace('/'); router.refresh();
  };
  return <header className="topbar"><Link className="brand" href="/"><span className="brand-mark">A</span><span>ANANTA<small>MEDICINE TRACEABILITY</small></span></Link>
    {area === 'public' ? <nav><Link href="/">Verify a batch</Link><Link className="nav-button" href="/login">Organization sign in →</Link></nav> : <nav>
      {area === 'admin' ? <><Link href="/admin">Overview</Link><a href="/admin#organizations">Organizations</a><a href="/admin#recalls">Recalls</a></> : <><Link href="/workspace">Inventory</Link><a href="/workspace#transfers">Transfers</a></>}
      <button className="signout" onClick={logout}>Sign out</button></nav>}
  </header>;
}
