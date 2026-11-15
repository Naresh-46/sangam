"use client";

import { FormEvent, Fragment, useMemo, useState } from "react";
import { CustodyTimeline, type CustodyTransfer } from "@/components/CustodyTimeline";
import { useAdminDashboard } from "@/components/admin/useAdminDashboard";
import { api } from "@/lib/api";
import { downloadCsv, toCsv } from "@/lib/csv";
import type { Batch } from "@/components/admin/types";

export default function BatchesPage() {
  const { dashboard, loading, error: loadError, reload } = useAdminDashboard();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [custodyOpenId, setCustodyOpenId] = useState<string | null>(null);
  const [custodyByBatch, setCustodyByBatch] = useState<Record<string, CustodyTransfer[]>>({});
  const [custodyLoadingId, setCustodyLoadingId] = useState<string | null>(null);

  const batches = dashboard?.batches ?? [];
  const visibleBatches = useMemo(() => batches.filter((batch) => {
    const matchesQuery = `${batch.medicineName} ${batch.batchNumber} ${batch.manufacturer} ${batch.currentHolder}`.toLowerCase().includes(query.toLowerCase());
    const matchesStatus = status === "ALL" || (status === "RECALLED" ? batch.recalled : !batch.recalled);
    return matchesQuery && matchesStatus;
  }), [batches, query, status]);
  const exportBatches = () => {
    const date = new Date().toISOString().slice(0, 10);
    const rows = visibleBatches.map((batch) => ({
      batchNumber: batch.batchNumber,
      medicine: batch.medicineName,
      manufacturer: batch.manufacturer,
      currentHolder: batch.currentHolder,
      status: batch.recalled ? "Recalled" : "Active",
      expiry: batch.expiryDate,
      registered: batch.createdAt,
      completeness: `${batch.custodyCompleteness}%`,
    }));
    downloadCsv(
      `sangam-batches-${date}.csv`,
      toCsv(rows, [
        { key: "batchNumber", header: "Batch Number" },
        { key: "medicine", header: "Medicine" },
        { key: "manufacturer", header: "Manufacturer" },
        { key: "currentHolder", header: "Current Holder" },
        { key: "status", header: "Status" },
        { key: "expiry", header: "Expiry" },
        { key: "registered", header: "Registered" },
        { key: "completeness", header: "Completeness" },
      ]),
    );
  };

  const recall = async (event: FormEvent<HTMLFormElement>, batch: Batch) => {
    event.preventDefault();
    const element = event.currentTarget;
    if (!window.confirm(`Recall batch ${batch.batchNumber}? This will block further transfers.`)) return;
    setNotice("");
    setError("");
    try {
      const form = new FormData(element);
      await api("/recalls", { method: "POST", body: JSON.stringify({
        batchId: batch.id,
        reason: form.get("reason"),
        severity: form.get("severity"),
      }) });
      setNotice(`Batch ${batch.batchNumber} recalled.`);
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not initiate recall.");
    }
  };

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
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load custody history.");
    } finally {
      setCustodyLoadingId(null);
    }
  };

  return (
    <>
      <div className="dashboard-heading">
        <div><div className="eyebrow">SUPPLY CHAIN REGISTRY</div><h1 className="page-title">Batches</h1><p className="muted">Search registered batches, inspect custody, or initiate a recall.</p></div>
        <span className="count-pill">{batches.length} batches</span>
      </div>
      {notice && <div className="message success">{notice}</div>}
      {(error || loadError) && <div className="message failure" role="alert">{error || loadError}</div>}
      {loading && !dashboard ? <div className="panel"><p className="empty">Loading batches…</p></div> : dashboard && (
        <section className="panel dashboard-panel">
          <div className="panel-heading">
            <div><div className="eyebrow">BATCH REGISTRY</div><h2>All batches</h2></div>
            <div className="row-actions">
              <span className="count-pill">{visibleBatches.length} shown</span>
              <button type="button" className="secondary csv-download-button" onClick={exportBatches} disabled={!visibleBatches.length}>
                <span aria-hidden="true">↓</span> Download CSV
              </button>
            </div>
          </div>
          <div className="admin-filter-row">
            <input className="filter-input" aria-label="Search batches" placeholder="Search medicine, batch, manufacturer or holder" value={query} onChange={(event) => setQuery(event.target.value)} />
            <select aria-label="Filter batch recall status" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="ALL">All batches</option><option value="ACTIVE">Not recalled</option><option value="RECALLED">Recalled</option>
            </select>
          </div>
          {visibleBatches.length ? (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Medicine / batch</th><th>Manufacturer</th><th>Recorded holder</th><th>Expiry</th><th>Completeness</th><th>Action</th><th>Custody</th></tr></thead>
                <tbody>{visibleBatches.map((batch) => (
                  <Fragment key={batch.id}>
                    <tr>
                      <td><b>{batch.medicineName}</b><small>{batch.batchNumber}</small></td>
                      <td>{batch.manufacturer}</td><td>{batch.currentHolder}</td><td>{batch.expiryDate}</td>
                      <td>
                        <div className={`completeness-meter completeness-${batch.custodyCompleteness >= 90 ? "high" : batch.custodyCompleteness >= 70 ? "medium" : "low"}`}>
                          <span>{batch.custodyCompleteness}%</span>
                          <div className="completeness-track" role="progressbar" aria-label={`Custody completeness ${batch.custodyCompleteness}%`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={batch.custodyCompleteness}>
                            <span style={{ width: `${batch.custodyCompleteness}%` }} />
                          </div>
                        </div>
                      </td>
                      <td>{batch.recalled ? <span className="badge recalled">Recalled</span> : (
                        <form className="recall-form" onSubmit={(event) => void recall(event, batch)}>
                          <select name="severity" defaultValue="CRITICAL" aria-label={`Recall severity for ${batch.batchNumber}`}>
                            <option value="LOW">Low</option><option value="MODERATE">Moderate</option><option value="HIGH">High</option><option value="CRITICAL">Critical</option>
                          </select>
                          <input name="reason" placeholder="Recall reason" minLength={4} required aria-label={`Recall reason for ${batch.batchNumber}`} />
                          <button className="danger-button">Recall</button>
                        </form>
                      )}</td>
                      <td><button type="button" className="secondary" onClick={() => void toggleCustody(batch.id)}>{custodyOpenId === batch.id ? "Hide" : "View"}</button></td>
                    </tr>
                    {custodyOpenId === batch.id && (
                      <tr className="timeline-row"><td colSpan={7}>
                        {custodyLoadingId === batch.id ? <p className="empty">Loading custody history…</p>
                          : custodyByBatch[batch.id]?.length ? <CustodyTimeline transfers={custodyByBatch[batch.id]} />
                          : <p className="empty">No transfer history recorded for this batch yet.</p>}
                      </td></tr>
                    )}
                  </Fragment>
                ))}</tbody>
              </table>
            </div>
          ) : <p className="empty">No batches match these filters.</p>}
        </section>
      )}
    </>
  );
}
