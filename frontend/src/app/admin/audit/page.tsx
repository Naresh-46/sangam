"use client";

import { useMemo, useState } from "react";
import { useAdminDashboard } from "@/components/admin/useAdminDashboard";
import { downloadCsv, toCsv } from "@/lib/csv";

const pageSize = 5;

export default function AuditPage() {
  const { dashboard, loading, error } = useAdminDashboard();
  const [eventType, setEventType] = useState("ALL");
  const [organizationQuery, setOrganizationQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const events = dashboard?.recentEvents ?? [];

  const eventTypes = Array.from(new Set(events.map((event) => event.type))).sort();
  const filteredEvents = useMemo(() => events.filter((event) => {
    const typeMatches = eventType === "ALL" || event.type === eventType;
    const search = organizationQuery.trim().toLowerCase();
    const organizationMatches = !search || `${event.actor} ${event.details}`.toLowerCase().includes(search);
    const date = event.createdAt.slice(0, 10);
    const fromMatches = !dateFrom || date >= dateFrom;
    const toMatches = !dateTo || date <= dateTo;
    return typeMatches && organizationMatches && fromMatches && toMatches;
  }), [events, eventType, organizationQuery, dateFrom, dateTo]);
  const pageCount = Math.max(1, Math.ceil(filteredEvents.length / pageSize));
  const visibleEvents = filteredEvents.slice((page - 1) * pageSize, page * pageSize);
  const exportEvents = () => {
    const date = new Date().toISOString().slice(0, 10);
    const rows = visibleEvents.map((event) => ({
      timestamp: event.createdAt,
      eventType: event.type,
      actor: event.actor,
      batchNumber: event.batchNumber,
      details: event.details,
    }));
    downloadCsv(
      `sangam-audit-log-${date}.csv`,
      toCsv(rows, [
        { key: "timestamp", header: "Timestamp" },
        { key: "eventType", header: "Event Type" },
        { key: "actor", header: "Actor" },
        { key: "batchNumber", header: "Batch Number" },
        { key: "details", header: "Details" },
      ]),
    );
  };

  const updateFilter = (update: () => void) => {
    update();
    setPage(1);
  };

  return (
    <>
      <div className="dashboard-heading">
        <div><div className="eyebrow">TRACEABILITY</div><h1 className="page-title">Audit log</h1><p className="muted">Filter recorded system events by type, organization/actor, and date.</p></div>
        <span className="count-pill">{filteredEvents.length} events</span>
      </div>
      {error && <div className="message failure" role="alert">{error}</div>}
      <div className="admin-api-note">The current dashboard API returns the latest 10 audit events. Filters and pagination apply to that available set.</div>
      <section className="panel dashboard-panel">
        <div className="panel-heading admin-audit-heading">
          <div><div className="eyebrow">TRACEABILITY</div><h2>Audit events</h2></div>
          <div className="row-actions">
            <span className="count-pill">{visibleEvents.length} shown</span>
            <button type="button" className="secondary csv-download-button" onClick={exportEvents} disabled={!visibleEvents.length}>
              <span aria-hidden="true">↓</span> Download CSV
            </button>
          </div>
        </div>
        <div className="admin-audit-filters">
          <label>Event type<select value={eventType} onChange={(event) => updateFilter(() => setEventType(event.target.value))}>
            <option value="ALL">All event types</option>{eventTypes.map((type) => <option key={type} value={type}>{type.replaceAll("_", " ")}</option>)}
          </select></label>
          <label>Organization / actor<input value={organizationQuery} onChange={(event) => updateFilter(() => setOrganizationQuery(event.target.value))} placeholder="Search actor or event details" /></label>
          <label>From<input type="date" value={dateFrom} onChange={(event) => updateFilter(() => setDateFrom(event.target.value))} /></label>
          <label>To<input type="date" value={dateTo} onChange={(event) => updateFilter(() => setDateTo(event.target.value))} /></label>
        </div>
        {loading && !dashboard ? <p className="empty">Loading audit events…</p> : visibleEvents.length ? (
          <div className="activity-list">
            {visibleEvents.map((event) => (
              <article className="audit-event-row" key={event.id}>
                <div className="activity-copy">
                  <b>{event.type.replaceAll("_", " ").toLowerCase()} · {event.batchNumber}</b>
                  <span>{event.actor} · {event.medicineName}</span>
                  <small>{event.details}</small>
                </div>
                <time dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString()}</time>
              </article>
            ))}
          </div>
        ) : <p className="empty">No events match these filters.</p>}
        <div className="admin-pagination">
          <span>Page {page} of {pageCount}</span>
          <div className="row-actions">
            <button className="secondary" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1}>Previous</button>
            <button className="secondary" onClick={() => setPage((current) => Math.min(pageCount, current + 1))} disabled={page >= pageCount}>Next</button>
          </div>
        </div>
      </section>
    </>
  );
}
