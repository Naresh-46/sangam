"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";

const navigation = [
  { href: "/admin/dashboard", label: "Dashboard", icon: "⌂" },
  { href: "/admin/organizations", label: "Organizations", icon: "▦" },
  { href: "/admin/batches", label: "Batches", icon: "▤" },
  { href: "/admin/recalls", label: "Recalls", icon: "!" },
  { href: "/admin/audit", label: "Audit Log", icon: "≡" },
  { href: "/admin/users", label: "Users", icon: "♙" },
  { href: "/admin/reports", label: "Reports", icon: "▥" },
];

export function AdminShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="shell admin-shell">
      <SiteHeader area="admin" />
      <div className="admin-workspace">
        <button
          type="button"
          className="admin-menu-toggle"
          aria-expanded={menuOpen}
          aria-controls="admin-sidebar"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span aria-hidden="true">{menuOpen ? "×" : "☰"}</span>
          <span>{menuOpen ? "Close menu" : "Admin menu"}</span>
        </button>
        <aside
          id="admin-sidebar"
          className={`admin-sidebar${menuOpen ? " is-open" : ""}`}
          aria-label="Admin navigation"
        >
          <div className="admin-sidebar-label">REGULATOR CONSOLE</div>
          <nav>
            {navigation.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={active ? "admin-nav-link active" : "admin-nav-link"}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setMenuOpen(false)}
                >
                  <span className="admin-nav-icon" aria-hidden="true">{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>
        <main className="dashboard-main admin-route-main">{children}</main>
      </div>
    </div>
  );
}
