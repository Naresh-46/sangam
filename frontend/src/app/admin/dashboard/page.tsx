"use client";

import { BatchFlowChart, OrgTypePie } from "@/components/AdminCharts";
import { useAdminDashboard } from "@/components/admin/useAdminDashboard";

const eventIcons: Record<string, string> = {
  REGISTERED: "+",
  TRANSFER_OFFERED: "→",
  TRANSFER_ACCEPTED: "✓",
  RECALLED: "!",
};

export default function AdminDashboardPage() {
  const { dashboard, loading, error, reload } = useAdminDashboard();
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
    <>
      <div className="dashboard-heading">
        <div>
          <div className="eyebrow">REGULATOR CONSOLE</div>
          <h1 className="page-title">Network overview</h1>
          <p className="muted">Batch registrations, organizations, recalls, and recorded activity.</p>
        </div>
        <button className="secondary" onClick={() => void reload().catch(() => {})} disabled={loading}>↻ Refresh</button>
      </div>
      {error && <div className="message failure" role="alert">{error}</div>}
      {loading && !dashboard ? (
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
                <small>{stat.label}</small><b>{stat.value}</b><span>{stat.detail}</span>
              </article>
            ))}
          </section>

          <section className="dashboard-grid admin-panel-grid">
            <article className="panel dashboard-panel">
              <div className="eyebrow">LAST 90 DAYS</div><h2>Batch flow</h2>
              {dashboard.kpis.totalBatches ? <BatchFlowChart data={dashboard.batchFlow} /> : <p className="empty">No batch registrations yet.</p>}
            </article>
            <article className="panel dashboard-panel">
              <div className="eyebrow">NETWORK</div><h2>Organization types</h2>
              {dashboard.kpis.totalOrganizations ? <OrgTypePie data={dashboard.orgDistribution} /> : <p className="empty">No organizations registered yet.</p>}
            </article>
          </section>

          <section className="dashboard-grid admin-panel-grid">
            <article className="panel dashboard-panel">
              <div className="eyebrow">AUDIT LOG</div><h2>Recent activity</h2>
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
            <article className="panel dashboard-panel">
              <div className="eyebrow">ATTENTION</div><h2>Alerts</h2>
              {dashboard.alerts.length ? (
                <div className="alert-list">
                  {dashboard.alerts.map((alert) => <div className={`dashboard-alert alert-${alert.severity}`} key={alert.type}>{alert.message}</div>)}
                </div>
              ) : <p className="empty">No alerts from the checks currently tracked.</p>}
            </article>
          </section>

          <section className="panel dashboard-panel custody-activity-panel">
            <div className="eyebrow">SUPPLY CHAIN</div><h2>Recent custody activity</h2>
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
        </>
      ) : null}
    </>
  );
}
