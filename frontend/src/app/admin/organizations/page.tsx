"use client";

import { FormEvent, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useAdminDashboard } from "@/components/admin/useAdminDashboard";

export default function OrganizationsPage() {
  const { dashboard, loading, error: loadError, reload } = useAdminDashboard();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const organizations = dashboard?.organizations ?? [];
  const visibleOrganizations = useMemo(() => organizations.filter((org) => {
    const matchesQuery = `${org.name} ${org.kind} ${org.licenseNumber}`.toLowerCase().includes(query.toLowerCase());
    const matchesStatus = status === "ALL" || (status === "APPROVED" ? org.approved : !org.approved);
    return matchesQuery && matchesStatus;
  }), [organizations, query, status]);

  const action = async (work: () => Promise<void>) => {
    setNotice("");
    setError("");
    try {
      await work();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Request failed.");
    }
  };

  const createOrganization = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    await action(async () => {
      const form = new FormData(formElement);
      await api("/organizations", {
        method: "POST",
        body: JSON.stringify({
          name: form.get("name"),
          kind: form.get("kind"),
          licenseNumber: form.get("licenseNumber"),
          adminEmail: form.get("email"),
          adminPassword: form.get("password"),
        }),
      });
      formElement.reset();
      setNotice("Organization and initial account created.");
      await reload();
    });
  };

  const approve = (id: string) => action(async () => {
    await api(`/organizations/${id}/approve`, { method: "POST" });
    setNotice("Organization approved.");
    await reload();
  });

  return (
    <>
      <div className="dashboard-heading">
        <div><div className="eyebrow">NETWORK ACCESS</div><h1 className="page-title">Organizations</h1><p className="muted">Review partner organizations and manage onboarding.</p></div>
        <span className="count-pill">{organizations.length} organizations</span>
      </div>
      {notice && <div className="message success">{notice}</div>}
      {(error || loadError) && <div className="message failure" role="alert">{error || loadError}</div>}
      {loading && !dashboard ? <div className="panel"><p className="empty">Loading organizations…</p></div> : dashboard && (
        <section className="admin-management-grid">
          <article className="panel dashboard-panel">
            <div className="panel-heading"><div><div className="eyebrow">ORGANIZATION DIRECTORY</div><h2>Partners</h2></div><span className="count-pill">{visibleOrganizations.length} shown</span></div>
            <div className="admin-filter-row">
              <input className="filter-input" aria-label="Search organizations" placeholder="Search name, type or license" value={query} onChange={(event) => setQuery(event.target.value)} />
              <select aria-label="Filter organization approval status" value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="ALL">All statuses</option><option value="PENDING">Pending</option><option value="APPROVED">Approved</option>
              </select>
            </div>
            {visibleOrganizations.length ? visibleOrganizations.map((org) => (
              <div className="organization-row" key={org.id}>
                <div><b>{org.name}</b><small>{org.kind.toLowerCase()} · licence {org.licenseNumber}</small></div>
                <div className="row-actions">
                  <span className={org.approved ? "badge approved" : "badge pending"}>{org.approved ? "Approved" : "Pending"}</span>
                  {!org.approved
                    ? <button className="secondary" onClick={() => void approve(org.id)}>Approve</button>
                    : <span className="badge unavailable" title="Organization suspension is not supported by the current API">Suspension unavailable</span>}
                </div>
              </div>
            )) : <p className="empty">No matching organizations.</p>}
          </article>
          <article className="panel dashboard-panel">
            <div className="eyebrow">ONBOARD A PARTNER</div><h2>Register organization</h2>
            <p className="muted">Create its first sign-in. It remains locked until approved.</p>
            <form className="stack-form" onSubmit={(event) => void createOrganization(event)}>
              <label>Organization name<input name="name" required minLength={2} /></label>
              <label>Organization type<select name="kind" defaultValue="MANUFACTURER"><option value="MANUFACTURER">Manufacturer</option><option value="DISTRIBUTOR">Distributor / wholesaler</option><option value="PHARMACY">Pharmacy</option></select></label>
              <label>License number<input name="licenseNumber" required /></label>
              <label>Account email<input name="email" type="email" required /></label>
              <label>Temporary password<input name="password" type="password" minLength={12} required /><small className="field-hint">At least 12 characters. Share it securely with the organization.</small></label>
              <button className="primary">Create organization <span>→</span></button>
            </form>
          </article>
        </section>
      )}
    </>
  );
}
