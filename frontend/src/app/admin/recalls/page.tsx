"use client";

import Link from "next/link";
import { useAdminDashboard } from "@/components/admin/useAdminDashboard";

export default function RecallsPage() {
  const { dashboard, loading, error, reload } = useAdminDashboard();
  const recalls = dashboard?.activeRecalls ?? [];

  return (
    <>
      <div className="dashboard-heading">
        <div><div className="eyebrow">BATCH SAFETY</div><h1 className="page-title">Recalls</h1><p className="muted">Track acknowledgment progress for recalled batches.</p></div>
        <button className="secondary" onClick={() => void reload().catch(() => {})} disabled={loading}>↻ Refresh</button>
      </div>
      {error && <div className="message failure" role="alert">{error}</div>}
      {loading && !dashboard ? <div className="panel"><p className="empty">Loading recalls…</p></div> : (
        <>
          <section className="panel dashboard-panel">
            <div className="panel-heading"><div><div className="eyebrow">OPEN CASES</div><h2>Active recalls</h2></div><span className="count-pill">{recalls.length}</span></div>
            {recalls.length ? (
              <div className="dashboard-list">
                {recalls.map((recall) => (
                  <article className="recall-card" key={recall.id}>
                    <div className="recall-card-title">
                      <span className="badge recalled">Active</span>
                      <span className={`badge recall-severity severity-${recall.severity.toLowerCase()}`}>{recall.severity}</span>
                      <b>{recall.batchNumber}</b>
                    </div>
                    <p>{recall.medicineName} · {recall.manufacturer}</p>
                    <small>{recall.reason || "No reason recorded"} · expiry {recall.expiryDate} · quantity {recall.quantity}</small>
                    <div
                      className="recall-progress"
                      role="progressbar"
                      aria-label={`${recall.acknowledgedCount} of ${recall.totalDownstream} organizations acknowledged`}
                      aria-valuemin={0}
                      aria-valuemax={recall.totalDownstream}
                      aria-valuenow={recall.acknowledgedCount}
                    >
                      <span style={{ width: recall.totalDownstream ? `${(recall.acknowledgedCount / recall.totalDownstream) * 100}%` : "0%" }} />
                    </div>
                    <div className="recall-card-footer">
                      <span>{recall.acknowledgedCount}/{recall.totalDownstream} downstream orgs acknowledged</span>
                      <div className="row-actions">
                        <Link className="secondary admin-text-link" href="/admin/batches">View batches</Link>
                        <button className="secondary" disabled title="The current API does not provide a recall close operation">Close recall unavailable</button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : <p className="empty">No active recalls.</p>}
          </section>
          <section className="panel dashboard-panel admin-closed-recalls">
            <div className="panel-heading"><div><div className="eyebrow">HISTORY</div><h2>Closed recalls</h2></div><span className="count-pill">Unavailable</span></div>
            <p className="muted">The current API and data model do not expose a closed-recall state. Existing recalled batches remain active until a close operation is added.</p>
          </section>
        </>
      )}
    </>
  );
}
