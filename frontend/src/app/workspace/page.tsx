"use client";

import { Fragment, FormEvent, useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { SiteHeader } from "@/components/SiteHeader";
import { CustodyTimeline, type CustodyTransfer } from "@/components/CustodyTimeline";
import { api } from "@/lib/api";

type Batch = {
  id: string;
  medicineName: string;
  batchNumber: string;
  expiryDate: string;
  manufacturer: string;
  quantity: number;
  recalled: boolean;
  custodyCompleteness: number;
  pendingTransfers: number;
};
type Incoming = {
  id: string;
  batchId: string;
  offeredAt: string;
  fromOrganization: { name: string; kind: string };
  batch: { batchNumber: string; medicineName: string };
};
type Partner = { id: string; name: string; kind: string };
type ActiveRecall = {
  id: string;
  batchNumber: string;
  medicineName: string;
  severity: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
  reason: string | null;
  status: "PENDING" | "ACKNOWLEDGED";
  acknowledgedAt: string | null;
};
type OrganizationSubRole = "ORG_ADMIN" | "OPERATOR" | "VIEWER";
type TeamMember = {
  id: string;
  name: string | null;
  email: string;
  subRole: OrganizationSubRole;
  active: boolean;
};
type Me = {
  id: string;
  email: string;
  name: string | null;
  subRole: OrganizationSubRole;
  organization: {
    id: string;
    name: string;
    kind: string;
    approved: boolean;
  } | null;
};

function printBatchLabel(batchId: string) {
  const label = document.getElementById(`batch-label-${batchId}`);
  if (!label) return;

  const cleanup = () => label.classList.remove("print-target");
  label.classList.add("print-target");
  window.addEventListener("afterprint", cleanup, { once: true });
  window.print();
}

function BatchQrLabel({ batch }: { batch: Batch }) {
  const [qrUrl, setQrUrl] = useState("");

  useEffect(() => {
    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL || window.location.origin;
    const url = new URL("/", baseUrl);
    url.searchParams.set("batch", batch.id);
    setQrUrl(url.toString());
  }, [batch.id]);

  if (!qrUrl) return null;

  return (
    <div className="batch-qr-cell">
      <div className="batch-qr-preview">
        <QRCodeSVG value={qrUrl} size={88} marginSize={1} />
      </div>
      <button
        className="secondary"
        type="button"
        onClick={() => printBatchLabel(batch.id)}
      >
        Print label
      </button>
      <div className="batch-print-label" id={`batch-label-${batch.id}`}>
        <QRCodeSVG value={qrUrl} size={150} marginSize={1} />
        <div>
          <p className="batch-label-brand">ANANTA · MEDICINE TRACEABILITY</p>
          <h1>{batch.batchNumber}</h1>
          <p>{batch.medicineName}</p>
          <p>Manufacturer: {batch.manufacturer}</p>
          <p>Expiry: {batch.expiryDate}</p>
          <small>Scan to view the public registry record</small>
        </div>
      </div>
    </div>
  );
}

export default function OrganizationWorkspace() {
  const [me, setMe] = useState<Me | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [incoming, setIncoming] = useState<Incoming[]>([]);
  const [activeRecalls, setActiveRecalls] = useState<ActiveRecall[]>([]);
  const [recallLoading, setRecallLoading] = useState(true);
  const [acknowledgingRecallId, setAcknowledgingRecallId] = useState<string | null>(null);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [teamModalOpen, setTeamModalOpen] = useState(false);
  const [createdTemporaryPassword, setCreatedTemporaryPassword] = useState("");
  const [transferBatch, setTransferBatch] = useState<Batch | null>(null);
  const [custodyOpenId, setCustodyOpenId] = useState<string | null>(null);
  const [custodyByBatch, setCustodyByBatch] = useState<Record<string, CustodyTransfer[]>>({});
  const [custodyLoadingId, setCustodyLoadingId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [inventoryQuery, setInventoryQuery] = useState("");
  const visibleBatches = batches.filter((batch) =>
    `${batch.medicineName} ${batch.batchNumber}`
      .toLowerCase()
      .includes(inventoryQuery.toLowerCase()),
  );
  const load = async () => {
    const who = await fetch("/api/session/me", { cache: "no-store" }).then(
      async (r) => {
        const b = await r.json();
        if (!r.ok) throw new Error(b.error);
        return b as Me;
      },
    );
    setMe(who);
    if (!who.organization?.approved) return;
    const [stock, transfers, orgs, recalls, members] = await Promise.all([
      api<Batch[]>("/batches"),
      api<Incoming[]>("/transfers/incoming"),
      api<Partner[]>("/organizations/active"),
      api<ActiveRecall[]>("/recalls/active"),
      who.subRole === "ORG_ADMIN"
        ? api<TeamMember[]>(`/admin/organizations/${who.organization.id}/users`)
        : Promise.resolve([]),
    ]);
    setBatches(stock);
    setIncoming(transfers);
    setPartners(orgs);
    setActiveRecalls(recalls);
    setTeam(members);
    setRecallLoading(false);
  };
  useEffect(() => {
    load()
      .catch((e) => setError(e.message))
      .finally(() => {
        setLoading(false);
        setRecallLoading(false);
      });
  }, []);
  const action = async (work: () => Promise<void>) => {
    setNotice("");
    setError("");
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed.");
    }
  };
  const addTeamMember = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const element = event.currentTarget;
    await action(async () => {
      const form = new FormData(element);
      const created = await api<TeamMember & { temporaryPassword: string }>(
        `/admin/organizations/${me?.organization?.id}/users`,
        {
          method: "POST",
          body: JSON.stringify({
            email: form.get("email"),
            name: form.get("name"),
            subRole: form.get("subRole"),
          }),
        },
      );
      setCreatedTemporaryPassword(created.temporaryPassword);
      setNotice(`Added ${created.name || created.email}. Share the temporary password securely.`);
      element.reset();
      setTeamModalOpen(false);
      await load();
    });
  };
  const updateOrganizationProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    await action(async () => {
      const form = new FormData(formElement);
      const name = form.get("organizationName")?.toString().trim();
      await api(`/admin/organizations/${me?.organization?.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name }),
      });
      setNotice("Organization profile updated.");
      await load();
    });
  };
  const changeTeamRole = (member: TeamMember, subRole: OrganizationSubRole) =>
    action(async () => {
      const updated = await api<TeamMember>(
        `/admin/organizations/${me?.organization?.id}/users/${member.id}`,
        { method: "PATCH", body: JSON.stringify({ subRole }) },
      );
      setTeam((current) => current.map((item) => item.id === updated.id ? updated : item));
      setNotice(`Updated ${updated.name || updated.email} to ${updated.subRole.replace("_", " ")}.`);
      await load();
    });
  const removeTeamMember = (member: TeamMember) => {
    if (!window.confirm(`Remove ${member.name || member.email} from your organization?`)) return;
    void action(async () => {
      await api(`/admin/organizations/${me?.organization?.id}/users/${member.id}`, { method: "DELETE" });
      setTeam((current) => current.filter((item) => item.id !== member.id));
      setNotice(`${member.name || member.email} was removed from the organization.`);
    });
  };
  const registerBatch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const element = event.currentTarget;
    await action(async () => {
      const data = new FormData(element);
      const commonUse = data.get("commonUse")?.toString().trim();
      const payload = {
        medicineName: data.get("medicineName"),
        strength: data.get("strength"),
        ...(commonUse ? { commonUse } : {}),
        batchNumber: data.get("batchNumber"),
        expiryDate: data.get("expiryDate"),
        quantity: Number(data.get("quantity")),
        ...(data.get("documentSha256")
          ? { documentSha256: data.get("documentSha256") }
          : {}),
      };
      const created = await api<{ id: string }>("/batches", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      element.reset();
      setNotice(`Batch registered. Its QR identifier is ${created.id}.`);
      await load();
    });
  };
  const offerTransfer = async (
    event: FormEvent<HTMLFormElement>,
    batch: Batch,
  ) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await action(async () => {
      await api(`/batches/${batch.id}/offer`, {
        method: "POST",
        body: JSON.stringify({
          recipientOrganizationId: form.get("recipient"),
        }),
      });
      setNotice(
        `Transfer offered for batch ${batch.batchNumber}. It remains in your custody until accepted.`,
      );
      setTransferBatch(null);
      await load();
    });
  };
  const acceptTransfer = async (transfer: Incoming) =>
    action(async () => {
      await api(`/batches/${transfer.batchId}/accept`, { method: "POST" });
      setIncoming((current) => current.filter((item) => item.id !== transfer.id));
      setNotice("Transfer confirmed and custody updated.");
      await load();
    });
  const rejectTransfer = async (transfer: Incoming) =>
    action(async () => {
      await api(`/batches/${transfer.batchId}/reject`, { method: "POST" });
      setIncoming((current) => current.filter((item) => item.id !== transfer.id));
      setNotice("Transfer rejected.");
      await load();
    });
  const acknowledgeRecall = async (recall: ActiveRecall) => {
    setAcknowledgingRecallId(recall.id);
    await action(async () => {
      const updated = await api<{
        status: "ACKNOWLEDGED";
        acknowledgedAt: string;
      }>(`/recalls/${recall.id}/acknowledge`, { method: "POST" });
      setActiveRecalls((current) =>
        current.map((item) =>
          item.id === recall.id
            ? {
                ...item,
                status: updated.status,
                acknowledgedAt: updated.acknowledgedAt,
              }
            : item,
        ),
      );
      setNotice(`Recall acknowledged for batch ${recall.batchNumber}.`);
    });
    setAcknowledgingRecallId(null);
  };
  const toggleCustody = async (batchId: string) => {
    if (custodyOpenId === batchId) {
      setCustodyOpenId(null);
      return;
    }
    setCustodyOpenId(batchId);
    if (custodyByBatch[batchId]) return;
    setCustodyLoadingId(batchId);
    try {
      const history = await api<CustodyTransfer[]>(`/batches/${batchId}/transfers`);
      setCustodyByBatch((current) => ({ ...current, [batchId]: history }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load custody history.");
    } finally {
      setCustodyLoadingId(null);
    }
  };

  return (
    <div className="shell">
      <SiteHeader area="organization" />
      <main className="dashboard-main">
        <div className="dashboard-heading">
          <div>
            <div className="eyebrow">SUPPLY CHAIN WORKSPACE</div>
            <h1 className="page-title">
              {me?.organization?.name || "Your organization"}
            </h1>
            <p className="muted">
              {me?.organization?.kind?.toLowerCase()} account · {me?.email}
            </p>
          </div>
          <div className="workspace-heading-actions">
            {me?.subRole === "VIEWER" && <span className="badge read-only-badge">Read-only access</span>}
            <button className="secondary" onClick={() => action(load)}>↻ Refresh</button>
          </div>
        </div>
        {notice && <div className="message success">{notice}</div>}
        {error && <div className="message failure">{error}</div>}
        {loading ? (
          <div className="panel">
            <p className="empty">Loading your workspace…</p>
          </div>
        ) : !me?.organization?.approved ? (
          <div className="panel pending-panel">
            <div className="pending-icon">◷</div>
            <h2>Waiting for organization approval</h2>
            <p>
              Your account was created, but it cannot register or move batches
              until a regulator verifies and approves the organization license.
            </p>
          </div>
        ) : (
          <>
            {me.subRole === "ORG_ADMIN" && (
              <>
              <section className="panel team-panel">
                <div className="eyebrow">ORGANIZATION PROFILE</div>
                <h2>Organization details</h2>
                <p className="muted">Update your organization name. License and organization type remain regulator-managed.</p>
                <form className="organization-profile-form" onSubmit={(event) => void updateOrganizationProfile(event)}>
                  <label>
                    Organization name
                    <input name="organizationName" defaultValue={me.organization.name} required minLength={2} maxLength={160} />
                  </label>
                  <button className="secondary">Save profile</button>
                </form>
              </section>
              <section className="panel team-panel">
                <div className="panel-heading">
                  <div><div className="eyebrow">ORGANIZATION ACCESS</div><h2>Team</h2></div>
                  <div className="row-actions">
                    <span className="count-pill">{team.length} members</span>
                    <button className="primary" type="button" onClick={() => { setCreatedTemporaryPassword(""); setTeamModalOpen(true); }}>Add member</button>
                  </div>
                </div>
                {team.length ? (
                  <div className="team-list">
                    {team.map((member) => (
                      <div className="team-member-row" key={member.id}>
                        <div className="team-member-identity">
                          <b>{member.name || member.email}</b>
                          <small>{member.email}{!member.active ? " · inactive" : ""}</small>
                        </div>
                        <div className="team-member-actions">
                          <label className="team-role-select">
                            <span className="sr-only">Role for {member.name || member.email}</span>
                            <select
                              value={member.subRole}
                              onChange={(event) => {
                                const nextRole = event.target.value;
                                if (nextRole === "ORG_ADMIN" || nextRole === "OPERATOR" || nextRole === "VIEWER") {
                                  void changeTeamRole(member, nextRole);
                                }
                              }}
                              aria-label={`Role for ${member.name || member.email}`}
                            >
                              <option value="ORG_ADMIN">Org Admin</option>
                              <option value="OPERATOR">Operator</option>
                              <option value="VIEWER">Viewer</option>
                            </select>
                          </label>
                          {member.id === me.id
                            ? <span className="badge approved">You</span>
                            : <button className="danger-button" type="button" onClick={() => removeTeamMember(member)}>Remove</button>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <p className="empty">No team members found.</p>}
                {createdTemporaryPassword && (
                  <div className="message success team-password-message" role="status">
                    Temporary password for the new member: <code>{createdTemporaryPassword}</code>
                    <small>Copy and share it securely. Password changes are not currently available.</small>
                  </div>
                )}
              </section>
              </>
            )}
            <section className="panel incoming-panel">
              <div className="panel-heading">
                <div>
                  <div className="eyebrow">CUSTODY INBOX</div>
                  <h2>Pending Incoming</h2>
                </div>
                <span className="count-pill">{incoming.length}</span>
              </div>
              {incoming.length ? (
                <div className="incoming-list">
                  {incoming.map((transfer) => (
                    <div className="incoming-card" key={transfer.id}>
                      <div>
                        <b>{transfer.batch.medicineName} · {transfer.batch.batchNumber}</b>
                        <small>
                          From {transfer.fromOrganization.name} ·{" "}
                          {new Date(transfer.offeredAt).toLocaleString()}
                        </small>
                      </div>
                      {me.subRole === "VIEWER" ? <span className="badge read-only-badge">Read-only</span> : (
                        <div className="row-actions">
                          <button type="button" className="secondary" onClick={() => acceptTransfer(transfer)}>Accept</button>
                          <button type="button" className="danger-button" onClick={() => rejectTransfer(transfer)}>Reject</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="empty">No incoming transfers are awaiting your response.</p>
              )}
            </section>
            <section className="panel active-recalls-panel">
              <div className="panel-heading">
                <div>
                  <div className="eyebrow">BATCH SAFETY</div>
                  <h2>Active Recalls</h2>
                </div>
                <span className="count-pill">{activeRecalls.length}</span>
              </div>
              {recallLoading ? (
                <p className="empty">Loading active recalls…</p>
              ) : activeRecalls.length ? (
                <div className="dashboard-list">
                  {activeRecalls.map((recall) => (
                    <article className="recall-card" key={recall.id}>
                      <div className="recall-card-title">
                        <span className={`badge recall-severity severity-${recall.severity.toLowerCase()}`}>
                          {recall.severity}
                        </span>
                        <b>{recall.batchNumber}</b>
                      </div>
                      <p>{recall.medicineName}</p>
                      <small>{recall.reason || "No reason recorded"}</small>
                      <div className="recall-card-footer">
                        {recall.status === "ACKNOWLEDGED" ? (
                          <span className="recall-acknowledged">✓ Acknowledged</span>
                        ) : me.subRole === "VIEWER" ? (
                          <span className="muted">Read-only access: an Org Admin or Operator can acknowledge.</span>
                        ) : (
                          <>
                            <span>Confirm you have stopped selling and removed the batch.</span>
                            <button
                              className="secondary"
                              type="button"
                              disabled={acknowledgingRecallId === recall.id}
                              onClick={() => acknowledgeRecall(recall)}
                            >
                              {acknowledgingRecallId === recall.id ? "Saving…" : "Acknowledge"}
                            </button>
                          </>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="empty">No active recalls affect your organization.</p>
              )}
            </section>
            <div className="stat-row">
              <div className="stat-card">
                <small>HELD BATCHES</small>
                <b>{batches.length}</b>
                <span>current inventory</span>
              </div>
              <div className="stat-card">
                <small>INCOMING TRANSFERS</small>
                <b>{incoming.length}</b>
                <span>awaiting acceptance</span>
              </div>
              <div className="stat-card">
                <small>ORGANIZATION TYPE</small>
                <b className="kind-value">
                  {me.organization.kind.toLowerCase()}
                </b>
                <span>role-scoped access</span>
              </div>
            </div>
            <section className="dashboard-grid">
              {me.organization.kind === "MANUFACTURER" && me.subRole !== "VIEWER" ? (
                <div className="panel">
                  <div className="eyebrow">MANUFACTURER ACTION</div>
                  <h2>Register a batch</h2>
                  <p className="muted">
                    Register the product details before creating its
                    traceability record.
                  </p>
                  <form className="stack-form" onSubmit={registerBatch}>
                    <label>
                      Medicine name
                      <input name="medicineName" required maxLength={160} />
                    </label>
                    <label>
                      Strength
                      <input
                        name="strength"
                        placeholder="e.g. 500 mg"
                        required
                      />
                    </label>
                    <label>
                      Common use <span className="optional">optional</span>
                      <input
                        name="commonUse"
                        placeholder="e.g., Fever, mild to moderate pain"
                      />
                    </label>
                    <div className="two-col">
                      <label>
                        Batch number
                        <input name="batchNumber" required />
                      </label>
                      <label>
                        Quantity
                        <input name="quantity" type="number" min={1} required />
                      </label>
                    </div>
                    <label>
                      Expiry date
                      <input name="expiryDate" type="date" required />
                    </label>
                    <label>
                      Certificate SHA-256{" "}
                      <span className="optional">optional</span>
                      <input name="documentSha256" pattern="[a-fA-F0-9]{64}" />
                    </label>
                    <button className="primary">
                      Register batch <span>→</span>
                    </button>
                  </form>
                </div>
              ) : (
                <div className="panel role-note">
                  <div className="eyebrow">YOUR ROLE</div>
                  <h2>
                    {me.subRole === "VIEWER" ? "Read-only access" : me.organization.kind === "PHARMACY"
                      ? "Pharmacy stock"
                      : "Distribution stock"}
                  </h2>
                  <p>
                    {me.subRole === "VIEWER"
                      ? "You can view your organization’s inventory, custody history, incoming transfers, and active recalls. Organization actions are disabled."
                      : "Your organization can accept recorded deliveries, review its current inventory, and offer custody to another approved organization."}
                  </p>
                </div>
              )}
            </section>
            <section className="panel inventory-panel">
              <div className="panel-heading">
                <div>
                  <div className="eyebrow">CURRENT CUSTODY</div>
                  <h2>Inventory</h2>
                </div>
                <span className="count-pill">{batches.length} batches</span>
              </div>
              <input
                className="filter-input"
                aria-label="Search inventory"
                placeholder="Search medicine or batch number"
                value={inventoryQuery}
                onChange={(e) => setInventoryQuery(e.target.value)}
              />
              {batches.length ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Medicine / batch</th>
                        <th>Expiry</th>
                        <th>Quantity</th>
                        <th>Status</th>
                        <th>Custody</th>
                        <th>QR label</th>
                        <th>Custody</th>
                        <th>Transfer</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleBatches.map((batch) => (
                        <Fragment key={batch.id}>
                        <tr>
                          <td>
                            <b>{batch.medicineName}</b>
                            <small>{batch.batchNumber}</small>
                          </td>
                          <td>{batch.expiryDate}</td>
                          <td>{batch.quantity}</td>
                          <td>
                            <span
                              className={`badge ${batch.recalled ? "recalled" : "approved"}`}
                            >
                              {batch.recalled ? "Recalled" : "Recorded"}
                            </span>
                          </td>
                          <td>
                            <span className={`badge ${batch.custodyCompleteness === 100 ? "approved" : "pending"}`}>
                              {batch.custodyCompleteness === 100
                                ? "✅ Complete"
                                : `⚠️ ${batch.custodyCompleteness}% (${batch.pendingTransfers} pending)`}
                            </span>
                          </td>
                          <td>
                            <BatchQrLabel batch={batch} />
                          </td>
                          <td>
                            <button type="button" className="secondary" onClick={() => toggleCustody(batch.id)}>
                              {custodyOpenId === batch.id ? "Hide history" : "Custody history"}
                            </button>
                          </td>
                          <td>
                            {batch.recalled
                              ? <span className="muted">Transfer locked</span>
                              : me.subRole === "VIEWER"
                                ? <span className="muted">Read-only</span>
                                : partners.length
                                  ? <button type="button" className="primary" onClick={() => setTransferBatch(batch)}>Transfer</button>
                                  : <span className="muted">No approved recipients</span>}
                          </td>
                        </tr>
                        {custodyOpenId === batch.id && (
                          <tr className="timeline-row"><td colSpan={8}>
                            {custodyLoadingId === batch.id ? <p className="empty">Loading custody history…</p>
                              : custodyByBatch[batch.id]?.length ? <CustodyTimeline transfers={custodyByBatch[batch.id]} />
                              : <p className="empty">No transfer history recorded for this batch yet.</p>}
                          </td></tr>
                        )}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="empty">
                  No batches are currently recorded under your custody.
                </p>
              )}
            </section>
          </>
        )}
      </main>
      {transferBatch && (
        <div className="transfer-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setTransferBatch(null); }}>
          <section className="transfer-modal" role="dialog" aria-modal="true" aria-labelledby="transfer-title">
            <div className="eyebrow">WHOLE BATCH CUSTODY</div>
            <h2 id="transfer-title">Transfer {transferBatch.batchNumber}</h2>
            <p className="muted">The recipient becomes the holder after confirming delivery.</p>
            <form className="stack-form" onSubmit={(event) => offerTransfer(event, transferBatch)}>
              <label>Recipient organization
                <select name="recipient" defaultValue="" required>
                  <option value="" disabled>Select an approved organization</option>
                  {partners.map((org) => <option key={org.id} value={org.id}>{org.name} · {org.kind.toLowerCase()}</option>)}
                </select>
              </label>
              <div className="modal-actions">
                <button type="button" className="secondary" onClick={() => setTransferBatch(null)}>Cancel</button>
                <button className="primary">Send transfer offer</button>
              </div>
            </form>
          </section>
        </div>
      )}
      {teamModalOpen && me?.organization && (
        <div className="transfer-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setTeamModalOpen(false); }}>
          <section className="transfer-modal" role="dialog" aria-modal="true" aria-labelledby="team-modal-title">
            <div className="eyebrow">ORGANIZATION ACCESS</div>
            <h2 id="team-modal-title">Add team member</h2>
            <p className="muted">A secure temporary password will be generated after the account is created.</p>
            <form className="stack-form" onSubmit={(event) => void addTeamMember(event)}>
              <label>Full name<input name="name" required maxLength={160} /></label>
              <label>Email address<input name="email" type="email" required maxLength={254} /></label>
              <label>Role<select name="subRole" defaultValue="OPERATOR"><option value="OPERATOR">Operator</option><option value="VIEWER">Viewer</option></select></label>
              <div className="modal-actions">
                <button type="button" className="secondary" onClick={() => setTeamModalOpen(false)}>Cancel</button>
                <button className="primary">Add member</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
