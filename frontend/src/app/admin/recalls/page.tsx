"use client";

import Link from "next/link";
import { useState } from "react";
import { useAdminDashboard } from "@/components/admin/useAdminDashboard";

export default function RecallsPage() {
  const { dashboard, loading, error, reload } = useAdminDashboard();
  const [refreshing, setRefreshing] = useState(false);
  const recalls = dashboard?.activeRecalls ?? [];

  const refresh = async () => {
    setRefreshing(true);
    try {
      await reload();
    } catch {
      // useAdminDashboard exposes the failure inline.
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <>
      <div className="dashboard-heading">
        <div><div className="eyebrow">BATCH SAFETY</div><h1 className="page-title">Recalls</h1><p className="muted">Track acknowledgment progress for recalled batches.</p></div>
        <button type="button" className="secondary" onClick={() => void refresh()} disabled={loading || refreshing}>
          {refreshing ? "Refreshing…" : "↻ Refresh"}
        </button>
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
                        <span className="badge unavailable" title="The current API does not provide a recall close operation">
                          Close action unavailable
                        </span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="admin-empty-state">
                <span className="admin-empty-state-icon" aria-hidden="true">✓</span>
                <h3>No active recalls</h3>
                <p>There are no recalled batches requiring acknowledgment right now.</p>
                <Link className="secondary" href="/admin/batches">Open batch registry</Link>
              </div>
            )}
          </section>
          <section className="panel dashboard-panel admin-closed-recalls">
            <div className="panel-heading"><div><div className="eyebrow">HISTORY</div><h2>Recall history</h2></div><span className="badge unavailable">Not available yet</span></div>
            <p className="muted">Closed-recall history is not available in the current API. Active recalls remain listed until a close workflow is supported.</p>
          </section>
        </>
      )}
    </>
  );
}
