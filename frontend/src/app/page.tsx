"use client";

import { FormEvent, useEffect, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { api } from "@/lib/api";

type Verification = {
  status: string;
  message?: string;
  medicineName?: string;
  strength?: string;
  batchNumber?: string;
  expiryDate?: string;
  manufacturer?: string;
  currentHolder?: string;
  notice?: string;
  custodyHistory?: {
    event: string;
    details: string;
    at: string;
    chainStatus: "VERIFIED" | "PENDING" | "INTEGRITY_MISMATCH";
  }[];
};

function loadVerification(batchId: string) {
  return api<Verification>(`/verify/${encodeURIComponent(batchId)}`);
}

export default function PublicVerification() {
  const [id, setId] = useState("");
  const [result, setResult] = useState<Verification | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const batchId = new URLSearchParams(window.location.search)
      .get("batch")
      ?.trim();
    if (!batchId) return;

    setId(batchId);
    loadVerification(batchId)
      .then(setResult)
      .catch((e) => setError(e.message));
  }, []);
  const verify = (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setResult(null);
    loadVerification(id.trim())
      .then(setResult)
      .catch((e) => setError(e.message));
  };
  return (
    <div className="shell consumer-shell">
      <SiteHeader area="public" />
      <main className="consumer-main">
        <section className="consumer-hero">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="eyebrow-dot" /> MEDICINE TRACEABILITY, MADE CLEAR
            </div>
            <h1>
              Know the journey.
              <br />
              <em>Check the record.</em>
            </h1>
            <p>
              Look up a medicine batch’s recorded path through the supply chain.
              No account needed.
            </p>
            <a className="hero-anchor" href="#verify">
              Check a batch <span>↓</span>
            </a>
            <div className="hero-note">
              A digital record helps with traceability. It cannot test the
              medicine inside a pack.
            </div>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="medicine-pack">
              <div className="pack-band" />
              <div className="pack-brand">
                ANANTA<small>TRACEABLE BATCH</small>
              </div>
              <div className="pack-lines">
                <i />
                <i />
                <i />
              </div>
              <div className="pack-code">
                <b />
                <b />
                <b />
                <b />
                <b />
                <b />
                <b />
                <b />
                <b />
              </div>
              <div className="pack-batch">
                BATCH RECORD <span>↗</span>
              </div>
            </div>
            <div className="path-node node-one">
              <i /> Registered
            </div>
            <div className="path-node node-two">
              <i /> Transfer logged
            </div>
            <div className="path-node node-three">
              <i /> Recall checked
            </div>
            <span className="hero-cross cross-one">✳</span>
            <span className="hero-cross cross-two">✳</span>
          </div>
        </section>
        <section className="verify-section" id="verify">
          <div className="verify-intro">
            <div className="eyebrow">01 — CHECK A BATCH</div>
            <h2>
              Start with the code
              <br />
              on your pack.
            </h2>
            <p>
              Read the batch ID from the pack’s QR label and paste it below.
              Camera scanning is planned. A result marked <b>recorded</b> means
              registry details were found, not that the product has passed a lab
              test.
            </p>
          </div>
          <div className="verify-card">
            <div className="verify-card-top">
              <span className="verify-icon">⌕</span>
              <span>PUBLIC BATCH LOOKUP</span>
              <span className="no-login">NO LOGIN</span>
            </div>
            <form className="inline-form" onSubmit={verify}>
              <label className="sr-only" htmlFor="batch-id">
                Batch identifier
              </label>
              <input
                id="batch-id"
                value={id}
                onChange={(e) => setId(e.target.value)}
                placeholder="Paste batch ID"
                required
              />
              <button className="primary">
                Check record <span>↗</span>
              </button>
            </form>
            {error && <div className="message failure">{error}</div>}
            {result && (
              <div
                className={`result-card status-${result.status.toLowerCase()}`}
              >
                <div className="result-head">
                  <span className="status-dot" />
                  <strong>{result.status.replaceAll("_", " ")}</strong>
                  <span className="result-caption">Registry record</span>
                </div>
                {result.medicineName && (
                  <>
                    <h3>
                      {result.medicineName} <span>{result.strength}</span>
                    </h3>
                    <div className="result-grid">
                      <div>
                        <small>BATCH NUMBER</small>
                        <b>{result.batchNumber}</b>
                      </div>
                      <div>
                        <small>EXPIRY DATE</small>
                        <b>{result.expiryDate}</b>
                      </div>
                      <div>
                        <small>MANUFACTURER</small>
                        <b>{result.manufacturer}</b>
                      </div>
                      <div>
                        <small>RECORDED HOLDER</small>
                        <b>{result.currentHolder}</b>
                      </div>
                    </div>
                    {result.custodyHistory?.map((event, i) => (
                      <div className="timeline-item" key={i}>
                        <i />
                        <span>
                          <b>
                            {event.event.replaceAll("_", " ").toLowerCase()}
                          </b>
                          <small>
                            {event.details} ·{" "}
                            {new Date(event.at).toLocaleString()}
                          </small>
                          <span className={`chain-status chain-${event.chainStatus.toLowerCase()}`}>
                            {event.chainStatus === "VERIFIED"
                              ? "Chain-verified ✓"
                              : event.chainStatus === "INTEGRITY_MISMATCH"
                                ? "Integrity check failed"
                                : "Pending chain confirmation"}
                          </span>
                        </span>
                      </div>
                    ))}
                  </>
                )}
                <p className="record-notice">
                  {result.notice ||
                    result.message ||
                    "No registered batch matches this identifier."}
                </p>
              </div>
            )}
          </div>
        </section>
        <section className="how-section">
          <div className="section-kicker">02 — HOW TO USE THIS PAGE</div>
          <h2>Three simple steps.</h2>
          <div className="how-grid">
            <article>
              <span>01</span>
              <h3>Find the batch ID</h3>
              <p>
                Look for the QR code or batch details on the medicine package.
                Match the printed medicine name and batch number with the
                result.
              </p>
            </article>
            <article>
              <span>02</span>
              <h3>Read the status</h3>
              <p>
                Check the recorded expiry, manufacturer, current holder and any
                recall notice shown for that batch.
              </p>
            </article>
            <article>
              <span>03</span>
              <h3>Ask if something feels wrong</h3>
              <p>
                If the code fails, details differ, the package looks altered, or
                a recall appears, pause and ask a licensed pharmacist or the
                relevant authority.
              </p>
            </article>
          </div>
        </section>
        <section className="safety-section">
          <div className="safety-heading">
            <div>
              <div className="section-kicker">
                03 — MEDICINE SAFETY IN INDIA
              </div>
              <h2>Small checks matter.</h2>
              <p>
                Plain-language reminders based on public Indian government
                resources. For personal advice, ask a qualified doctor or
                pharmacist.
              </p>
            </div>
            <span className="safety-stamp">
              READ
              <br />
              THE
              <br />
              LABEL
            </span>
          </div>
          <div className="safety-grid">
            <article className="safety-card">
              <span className="safety-number">A</span>
              <h3>Check the pack details</h3>
              <p>
                Look for the medicine name, manufacturer, batch or lot number,
                and expiry information. If details are missing or appear
                altered, ask a pharmacist before using it.
              </p>
              <a
                href="https://www.cdsco.gov.in/opencms/export/sites/CDSCO_WEB/Pdf-documents/acts_rules/2016DrugsandCosmeticsAct1940Rules1945.pdf"
                target="_blank"
                rel="noreferrer"
              >
                Drugs and Cosmetics Rules ↗
              </a>
            </article>
            <article className="safety-card">
              <span className="safety-number">B</span>
              <h3>Use antibiotics only as prescribed</h3>
              <p>
                Government guidance advises against buying antibiotics without a
                valid prescription, using leftovers, or sharing them with
                someone else.
              </p>
              <a
                href="https://ncdc.mohfw.gov.in/wp-content/uploads/2024/04/Frequently-asked-questions-on-Antimicrobial-Resistance.pdf"
                target="_blank"
                rel="noreferrer"
              >
                NCDC antibiotic-resistance FAQ ↗
              </a>
            </article>
            <article className="safety-card">
              <span className="safety-number">C</span>
              <h3>Report suspected side effects</h3>
              <p>
                Patients and consumers can report suspected medicine-related
                side effects through India’s Pharmacovigilance Programme of
                India.
              </p>
              <a
                href="https://ipc.gov.in/PvPI/adr.html"
                target="_blank"
                rel="noreferrer"
              >
                PvPI patient reporting ↗
              </a>
            </article>
          </div>
          <p className="safety-source">
            These are general reminders, not a diagnosis or treatment plan.
            Follow your prescription and the medicine’s approved label.{" "}
            <a
              href="https://ncdc.mohfw.gov.in/wp-content/uploads/2024/04/What-can-the-community-do-for-AMR-containment.pdf"
              target="_blank"
              rel="noreferrer"
            >
              Community guidance on antibiotics ↗
            </a>
          </p>
        </section>
        <section className="trust-section">
          <div className="trust-mark">A</div>
          <div>
            <div className="section-kicker">
              WHAT THE RECORD CAN — AND CANNOT — TELL YOU
            </div>
            <h2>Traceability is one useful check.</h2>
            <p>
              ANANTA compares a batch with its recorded supply-chain history and
              recall status. Blockchain, when connected, can make shared event
              records harder to alter; it cannot confirm the physical contents,
              detect every counterfeit, or replace a regulator’s inspection.
            </p>
          </div>
          <a href="#verify">Check a batch ↑</a>
        </section>
        <section className="panel public-result-panel">
          <div className="privacy-note">
            <span>◈</span>
            <p>
              <b>Need to report a safety concern?</b>
              <br />
              For a suspected adverse drug reaction, use the official PvPI
              reporting route. For an immediate medical emergency, contact local
              emergency services or seek urgent care.
            </p>
          </div>
        </section>
      </main>
      <footer className="consumer-footer">
        <span>ANANTA · Medicine traceability</span>
        <span>General information · Not medical advice</span>
        <a
          href="https://ipc.gov.in/PvPI/adr.html"
          target="_blank"
          rel="noreferrer"
        >
          Official side-effect reporting ↗
        </a>
      </footer>
    </div>
  );
}
