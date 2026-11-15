"use client";

import { useAdminDashboard } from "@/components/admin/useAdminDashboard";

function downloadCsv(filename: string, rows: (string | number | boolean | null)[][]) {
  const csv = rows.map((row) => row.map((value) => {
    const text = value == null ? "" : String(value);
    return `"${text.replaceAll('"', '""')}"`;
  }).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const { dashboard, loading, error } = useAdminDashboard();

  if (loading && !dashboard) {
    return <><div className="dashboard-heading"><div><div className="eyebrow">ANALYTICS</div><h1 className="page-title">Reports</h1></div></div><div className="panel"><p className="empty">Loading report data…</p></div></>;
  }

  const organizations = dashboard?.organizations ?? [];
  const recalls = dashboard?.activeRecalls ?? [];
  const transfers = dashboard?.custodyActivity ?? [];
  const reportCards = [
    {
      title: "Compliance overview",
      description: "Organization approval status and registered batch counts.",
      count: organizations.length,
      download: () => downloadCsv("sangam-compliance.csv", [
        ["Organization", "Type", "License number", "Approved"],
        ...organizations.map((org) => [org.name, org.kind, org.licenseNumber, org.approved]),
      ]),
    },
    {
      title: "Recall effectiveness",
      description: "Acknowledgment progress for each currently recorded recall.",
      count: recalls.length,
      download: () => downloadCsv("sangam-recall-effectiveness.csv", [
        ["Batch number", "Medicine", "Severity", "Acknowledged", "Total downstream", "Reason"],
        ...recalls.map((recall) => [recall.batchNumber, recall.medicineName, recall.severity, recall.acknowledgedCount, recall.totalDownstream, recall.reason]),
      ]),
    },
    {
      title: "Organization activity",
      description: "Organization directory with transfer counts from the latest custody activity returned by the API.",
      count: organizations.length,
      download: () => downloadCsv("sangam-organization-activity.csv", [
        ["Organization", "Type", "Approved", "Recent transfers"],
        ...organizations.map((org) => [org.name, org.kind, org.approved, transfers.filter((item) => item.from === org.name || item.to === org.name).length]),
      ]),
    },
  ];

  return (
    <>
      <div className="dashboard-heading">
        <div><div className="eyebrow">ANALYTICS</div><h1 className="page-title">Reports</h1><p className="muted">Download CSV snapshots from the currently available admin dashboard data.</p></div>
      </div>
      {error && <div className="message failure" role="alert">{error}</div>}
      <section className="admin-report-grid">
        {reportCards.map((report) => (
          <article className="panel dashboard-panel admin-report-card" key={report.title}>
            <div className="eyebrow">CSV REPORT</div><h2>{report.title}</h2><p className="muted">{report.description}</p>
            <div className="admin-report-footer"><span className="count-pill">{report.count} rows</span><button className="primary" onClick={report.download}>Download CSV</button></div>
          </article>
        ))}
      </section>
      <p className="admin-api-note">Reports reflect the response limits of the current API: recent custody activity is limited to five transfers, and audit events to ten.</p>
    </>
  );
}
