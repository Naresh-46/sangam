"use client";

import { FormEvent, Fragment, useCallback, useEffect, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { BatchFlowChart, OrgTypePie } from "@/components/AdminCharts";
import { CustodyTimeline, type CustodyTransfer } from "@/components/CustodyTimeline";
import { api } from "@/lib/api";

type Organization = {
  id: string;
  name: string;
  kind: string;
  approved: boolean;
  licenseNumber: string;
};
type Batch = {
  id: string;
  medicineName: string;
  batchNumber: string;
  expiryDate: string;
  manufacturer: string;
  currentHolder: string;
  recalled: boolean;
};
type DashboardData = {
  kpis: {
    totalBatches: number;
    batchesThisMonth: number;
    totalOrganizations: number;
    approvedOrganizations: number;
    pendingApprovals: number;
    activeRecalls: number;
    transferRecords: number;
  };
  batchFlow: { month: string; count: number }[];
  orgDistribution: { kind: string; count: number }[];
  activeRecalls: {
    id: string;
    batchNumber: string;
    medicineName: string;
    manufacturer: string;
    expiryDate: string;
    quantity: number;
    reason: string | null;
  }[];
  recentEvents: {
    id: string;
    type: string;
    actor: string;
    batchNumber: string;
    medicineName: string;
    details: string;
    createdAt: string;
  }[];
  custodyActivity: {
    id: string;
    batchNumber: string;
    medicineName: string;
    from: string;
    to: string;
    status: string;
    offeredAt: string;
  }[];
  chainStatus: null;
  recallProgressAvailable: false;
  custodyCompletenessAvailable: false;
  alerts: { type: string; severity: string; message: string }[];
  organizations: Organization[];
  batches: Batch[];
};

const eventIcons: Record<string, string> = {
  REGISTERED: "+",
  TRANSFER_OFFERED: "→",
  TRANSFER_ACCEPTED: "✓",
  RECALLED: "!",
};

export default function AdminPage() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [organizationQuery, setOrganizationQuery] = useState("");
  const [batchQuery, setBatchQuery] = useState("");
  const [custodyOpenId, setCustodyOpenId] = useState<string | null>(null);
  const [custodyByBatch, setCustodyByBatch] = useState<Record<string, CustodyTransfer[]>>({});
  const [custodyLoadingId, setCustodyLoadingId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const data = await api<DashboardData>("/admin/dashboard");
    setDashboard(data);
  }, []);

  useEffect(() => {
    let mounted = true;
    const load = () =>
      reload()
        .catch((e) => {
          if (mounted) setError(e instanceof Error ? e.message : "Could not load dashboard.");
        })
        .finally(() => {
          if (mounted) setLoading(false);
        });
    void load();
    const interval = window.setInterval(load, 30_000);
    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, [reload]);

  const organizations = dashboard?.organizations ?? [];
  const batches = dashboard?.batches ?? [];
  const visibleOrganizations = organizations.filter((org) =>
    `${org.name} ${org.kind} ${org.licenseNumber}`
      .toLowerCase()
      .includes(organizationQuery.toLowerCase()),
  );
  const visibleBatches = batches.filter((batch) =>
    `${batch.medicineName} ${batch.batchNumber} ${batch.manufacturer} ${batch.currentHolder}`
      .toLowerCase()
      .includes(batchQuery.toLowerCase()),
  );

  const action = async (work: () => Promise<void>) => {
    setNotice("");
    setError("");
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed.");
    }
  };

  const createOrganization = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const element = event.currentTarget;
    await action(async () => {
      const form = new FormData(element);
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
      element.reset();
      setNotice("Organization and initial account created.");
      await reload();
    });
  };

  const approve = (id: string) =>
    action(async () => {
      await api(`/organizations/${id}/approve`, { method: "POST" });
      setNotice("Organization approved.");
      await reload();
    });

  const recall = async (event: FormEvent<HTMLFormElement>, batch: Batch) => {
    event.preventDefault();
    const element = event.currentTarget;
    if (!window.confirm(`Recall batch ${batch.batchNumber}? This will block further transfers.`)) return;
    await action(async () => {
      const reason = new FormData(element).get("reason");
      await api(`/batches/${batch.id}/recall`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      setNotice(`Batch ${batch.batchNumber} recalled.`);
      await reload();
    });
  };

  const trackBatch = (id: string) =>
    document.getElementById(`batch-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });

  const toggleCustody = async (batchId: string) => {
    if (custodyOpenId === batchId) {
      setCustodyOpenId(null);
      return;
    }
    setCustodyOpenId(batchId);
    if (custodyByBatch[batchId]) return;
    setCustodyLoadingId(batchId);
    setError("");
    try {
      const history = await api<CustodyTransfer[]>(`/batches/${batchId}/transfers`);
      setCustodyByBatch((current) => ({ ...current, [batchId]: history }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load custody history.");
    } finally {
      setCustodyLoadingId(null);
    }
  };

  const stats = dashboard
    ? [
        { label: "REGISTERED BATCHES", value: dashboard.kpis.totalBatches, detail: `+${dashboard.kpis.batchesThisMonth} this month`, tone: "green" },
        { label: "ORGANIZATIONS", value: `${dashboard.kpis.approvedOrganizations}/${dashboard.kpis.totalOrganizations}`, detail: `${dashboard.kpis.pendingApprovals} pending approval`, tone: "blue" },
        { label: "ACTIVE RECALLS", value: dashboard.kpis.activeRecalls, detail: "currently recorded", tone: "red" },
        { label: "TRANSFER RECORDS", value: dashboard.kpis.transferRecords, detail: "offers and accepted transfers", tone: "purple" },
        { label: "PENDING APPROVALS", value: dashboard.kpis.pendingApprovals, detail: "organizations waiting", tone: "amber" },
      ]
    : [];

  return (
    <div className="shell">
      <SiteHeader area="admin" />
      <main className="dashboard-main admin-dashboard">
        <div className="dashboard-heading">
          <div>
            <div className="eyebrow">REGULATOR CONSOLE</div>
            <h1 className="page-title">Network overview</h1>
            <p className="muted">Batch registrations, organizations, recalls, and recorded activity.</p>
          </div>
          <button className="secondary" onClick={() => action(reload)} disabled={loading}>
            ↻ Refresh
          </button>
        </div>
        {notice && <div className="message success">{notice}</div>}
        {error && <div className="message failure" role="alert">{error}</div>}

        {loading ? (
          <div className="dashboard-skeleton" aria-label="Loading dashboard">
            {Array.from({ length: 5 }, (_, index) => <div className="skeleton-card" key={index} />)}
            <div className="skeleton-panel" />
            <div className="skeleton-panel" />
          </div>
        ) : dashboard ? (
          <>
            <section className="stat-row admin-kpis" aria-label="Key figures">
              {stats.map((stat) => (
                <article className={`stat-card stat-${stat.tone}`} key={stat.label}>
                  <small>{stat.label}</small>
                  <b>{stat.value}</b>
                  <span>{stat.detail}</span>
                </article>
              ))}
            </section>

            <section className="dashboard-grid admin-panel-grid">
              <article className="panel dashboard-panel">
                <div className="eyebrow">LAST 90 DAYS</div>
                <h2>Batch flow</h2>
                {dashboard.kpis.totalBatches ? <BatchFlowChart data={dashboard.batchFlow} /> : <p className="empty">No batch registrations yet.</p>}
              </article>
              <article className="panel dashboard-panel">
                <div className="eyebrow">NETWORK</div>
                <h2>Organization types</h2>
                {dashboard.kpis.totalOrganizations ? <OrgTypePie data={dashboard.orgDistribution} /> : <p className="empty">No organizations registered yet.</p>}
              </article>

              <article className="panel dashboard-panel">
                <div className="panel-heading">
                  <div><div className="eyebrow">BATCH SAFETY</div><h2>Active recalls</h2></div>
                  <span className="count-pill">{dashboard.activeRecalls.length}</span>
                </div>
                {dashboard.activeRecalls.length ? (
                  <div className="dashboard-list">
                    {dashboard.activeRecalls.map((recall) => (
                      <div className="recall-card" key={recall.id}>
                        <div className="recall-card-title">
                          <span className="badge recalled">Recalled</span>
                          <b>{recall.batchNumber}</b>
                        </div>
                        <p>{recall.medicineName} · {recall.manufacturer}</p>
                        <small>{recall.reason || "No reason recorded"} · expiry {recall.expiryDate}</small>
                        <div className="recall-card-footer">
                          <span>Recovery progress: no data yet</span>
                          <button className="secondary" onClick={() => trackBatch(recall.id)}>Track batch</button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <p className="empty">No active recalls.</p>}
              </article>

              <article className="panel dashboard-panel">
                <div className="eyebrow">AUDIT LOG</div>
                <h2>Recent activity</h2>
                {dashboard.recentEvents.length ? (
                  <div className="activity-list">
                    {dashboard.recentEvents.map((event) => (
                      <div className="activity-row" key={event.id}>
                        <span className="activity-icon">{eventIcons[event.type] || "•"}</span>
                        <div className="activity-copy">
                          <b>{event.type.replaceAll("_", " ").toLowerCase()}</b>
                          <span>{event.actor} · {event.batchNumber}</span>
                          <small>{event.details}</small>
                        </div>
                        <time>{new Date(event.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>
                      </div>
                    ))}
                  </div>
                ) : <p className="empty">No audit events recorded yet.</p>}
              </article>
            </section>

            <section className="panel dashboard-panel custody-activity-panel">
              <div className="eyebrow">SUPPLY CHAIN</div>
              <h2>Recent custody activity</h2>
              {dashboard.custodyActivity.length ? (
                <div className="activity-list">
                  {dashboard.custodyActivity.map((transfer) => (
                    <div className="activity-row" key={transfer.id}>
                      <span className="activity-icon">→</span>
                      <div className="activity-copy">
                        <b>{transfer.batchNumber} · {transfer.status.toLowerCase()}</b>
                        <span>{transfer.from} → {transfer.to}</span>
                        <small>{transfer.medicineName}</small>
                      </div>
                      <time>{new Date(transfer.offeredAt).toLocaleDateString()}</time>
                    </div>
                  ))}
                </div>
              ) : <p className="empty">No transfer records yet.</p>}
            </section>

            <section className="dashboard-grid admin-panel-grid dashboard-data-gaps">
              <article className="panel dashboard-panel">
                <div className="eyebrow">RECALL FOLLOW-UP</div>
                <h2>Recovery progress</h2>
                <p className="empty">No data yet. The system does not record units recovered from a recall.</p>
              </article>
              <article className="panel dashboard-panel">
                <div className="eyebrow">CUSTODY RECORDS</div>
                <h2>Chain completeness</h2>
                <p className="empty">No completeness score yet. Required supply-chain steps are not defined in the data model.</p>
              </article>
              <article className="panel dashboard-panel">
                <div className="eyebrow">BLOCKCHAIN</div>
                <h2>Anchor status</h2>
                <p className="empty">No data yet. A Hardhat node and event anchoring are not configured.</p>
              </article>
              <article className="panel dashboard-panel">
                <div className="eyebrow">ATTENTION</div>
                <h2>Alerts</h2>
                {dashboard.alerts.length ? (
                  <div className="alert-list">
                    {dashboard.alerts.map((alert) => <div className={`dashboard-alert alert-${alert.severity}`} key={alert.type}>{alert.message}</div>)}
                  </div>
                ) : <p className="empty">No alerts from the checks currently tracked.</p>}
              </article>
            </section>

            <section className="dashboard-grid admin-management-grid" id="organizations">
              <article className="panel dashboard-panel">
                <div className="panel-heading">
                  <div><div className="eyebrow">ORGANIZATION ACCESS</div><h2>Organizations</h2></div>
                  <span className="count-pill">{organizations.length}</span>
                </div>
                <input className="filter-input" aria-label="Search organizations" placeholder="Search name, type or license" value={organizationQuery} onChange={(e) => setOrganizationQuery(e.target.value)} />
                {visibleOrganizations.length ? visibleOrganizations.map((org) => (
                  <div className="organization-row" key={org.id}>
                    <div><b>{org.name}</b><small>{org.kind.toLowerCase()} · licence {org.licenseNumber}</small></div>
                    <div className="row-actions">
                      <span className={org.approved ? "badge approved" : "badge pending"}>{org.approved ? "Approved" : "Pending"}</span>
                      {!org.approved && <button className="secondary" onClick={() => approve(org.id)}>Approve</button>}
                    </div>
                  </div>
                )) : <p className="empty">No matching organizations.</p>}
              </article>
              <article className="panel dashboard-panel">
                <div className="eyebrow">ONBOARD A PARTNER</div>
                <h2>Register organization</h2>
                <p className="muted">Create its first sign-in. It remains locked until approved.</p>
                <form className="stack-form" onSubmit={createOrganization}>
                  <label>Organization name<input name="name" required minLength={2} /></label>
                  <label>Organization type<select name="kind" defaultValue="MANUFACTURER"><option value="MANUFACTURER">Manufacturer</option><option value="DISTRIBUTOR">Distributor / wholesaler</option><option value="PHARMACY">Pharmacy</option></select></label>
                  <label>License number<input name="licenseNumber" required /></label>
                  <label>Account email<input name="email" type="email" required /></label>
                  <label>Temporary password<input name="password" type="password" minLength={12} required /><small className="field-hint">At least 12 characters. Share it securely with the organization.</small></label>
                  <button className="primary">Create organization <span>→</span></button>
                </form>
              </article>
            </section>

            <section className="panel recall-panel dashboard-panel" id="batch-safety">
              <div className="panel-heading">
                <div><div className="eyebrow">BATCH SAFETY ACTIONS</div><h2>Batch registry</h2></div>
                <span className="count-pill">{batches.length} batches</span>
              </div>
              <input className="filter-input" aria-label="Search batches" placeholder="Search medicine, batch, manufacturer or holder" value={batchQuery} onChange={(e) => setBatchQuery(e.target.value)} />
              {visibleBatches.length ? (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Medicine / batch</th><th>Manufacturer</th><th>Recorded holder</th><th>Expiry</th><th>Action</th><th>Custody</th></tr></thead>
                    <tbody>{visibleBatches.map((batch) => (
                      <Fragment key={batch.id}>
                        <tr id={`batch-${batch.id}`}>
                          <td><b>{batch.medicineName}</b><small>{batch.batchNumber}</small></td>
                          <td>{batch.manufacturer}</td><td>{batch.currentHolder}</td><td>{batch.expiryDate}</td>
                          <td>{batch.recalled ? <span className="badge recalled">Recalled</span> : (
                            <form className="recall-form" onSubmit={(e) => recall(e, batch)}>
                              <input name="reason" placeholder="Recall reason" minLength={4} required />
                              <button className="danger-button">Recall</button>
                            </form>
                          )}</td>
                          <td><button type="button" className="secondary" onClick={() => toggleCustody(batch.id)}>
                            {custodyOpenId === batch.id ? "Hide" : "View"}
                          </button></td>
                        </tr>
                        {custodyOpenId === batch.id && (
                          <tr className="timeline-row"><td colSpan={6}>
                            {custodyLoadingId === batch.id ? <p className="empty">Loading custody history…</p>
                              : custodyByBatch[batch.id]?.length ? <CustodyTimeline transfers={custodyByBatch[batch.id]} />
                              : <p className="empty">No transfer history recorded for this batch yet.</p>}
                          </td></tr>
                        )}
                      </Fragment>
                    ))}</tbody>
                  </table>
                </div>
              ) : <p className="empty">No batches match this search.</p>}
            </section>
            <p className="help-note">Regulator access is logged by the API. Verify organization licenses through the proper authority before approving an account.</p>
          </>
        ) : null}
      </main>
    </div>
  );
}
