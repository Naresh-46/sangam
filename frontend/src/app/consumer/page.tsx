"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { api } from "@/lib/api";

type Verification = {
  status: string;
  message?: string;
  notice?: string;
  medicineName?: string;
  strength?: string;
  commonUse?: string | null;
  genericName?: string | null;
  batchNumber?: string;
  expiryDate?: string;
  manufacturer?: string;
  currentHolder?: string;
  custodyHistory?: {
    event: string;
    details: string;
    at: string;
    chainStatus: "VERIFIED" | "PENDING" | "INTEGRITY_MISMATCH";
  }[];
};

type MedicineInfo = {
  title: string;
  extract: string | null;
  url: string | null;
};

type BarcodeResult = { rawValue: string };
type BrowserBarcodeDetector = {
  detect(source: HTMLVideoElement): Promise<BarcodeResult[]>;
};
type WindowWithBarcodeDetector = Window & {
  BarcodeDetector?: new (options: { formats: string[] }) => BrowserBarcodeDetector;
};

function firstSentences(text: string, count = 3) {
  return (text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [text])
    .slice(0, count)
    .join(" ")
    .trim();
}

function batchIdFromQr(value: string) {
  try {
    const url = new URL(value);
    return url.searchParams.get("batch")?.trim() || value.trim();
  } catch {
    return value.trim();
  }
}

export default function ConsumerPage() {
  const [batchId, setBatchId] = useState("");
  const [result, setResult] = useState<Verification | null>(null);
  const [medicineInfo, setMedicineInfo] = useState<MedicineInfo | null>(null);
  const [loadingMedicineInfo, setLoadingMedicineInfo] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [scannerMessage, setScannerMessage] = useState("");
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const lookup = useCallback(async (value: string) => {
    const id = value.trim();
    if (!id) {
      setError("Enter a batch ID or scan the QR code on the medicine pack.");
      return;
    }

    setBatchId(id);
    setError("");
    setResult(null);
    setMedicineInfo(null);
    setLoading(true);
    try {
      const data = await api<Verification>(`/verify/${encodeURIComponent(id)}`);
      setResult(data);
    } catch (lookupError) {
      setError(
        lookupError instanceof Error
          ? lookupError.message
          : "We couldn't check this batch. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!scanning) return;

    let cancelled = false;
    let stream: MediaStream | undefined;
    let timer: number | undefined;

    async function startDetection() {
      try {
        const Detector = (window as WindowWithBarcodeDetector).BarcodeDetector;
        if (!Detector) {
          setScannerMessage("QR camera scanning isn't supported in this browser. Enter the batch ID below instead.");
          setScanning(false);
          return;
        }
        if (!navigator.mediaDevices?.getUserMedia) {
          setScannerMessage("Camera access isn't available. Enter the batch ID below instead.");
          setScanning(false);
          return;
        }

        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: "environment" } },
        });
        if (cancelled || !videoRef.current) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        const video = videoRef.current;
        video.srcObject = stream;
        await video.play();
        const detector = new Detector({ formats: ["qr_code"] });

        const detect = async () => {
          if (cancelled) return;
          try {
            const codes = await detector.detect(video);
            if (codes[0]?.rawValue) {
              const id = batchIdFromQr(codes[0].rawValue);
              setScanning(false);
              setScannerMessage("");
              void lookup(id);
              return;
            }
          } catch {
            setScannerMessage("Couldn't read that QR code. Hold the camera steady or enter the batch ID below.");
          }
          timer = window.setTimeout(detect, 350);
        };
        void detect();
      } catch {
        if (!cancelled) {
          setScannerMessage("Camera access was blocked. Allow camera access or enter the batch ID below.");
          setScanning(false);
        }
      }
    }

    void startDetection();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [scanning, lookup]);

  useEffect(() => {
    const genericName = result?.status === "RECORDED" || result?.status === "VERIFIED" || result?.status === "RECALLED"
      ? result.genericName?.trim()
      : undefined;
    if (!genericName) {
      setMedicineInfo(null);
      setLoadingMedicineInfo(false);
      return;
    }

    let active = true;
    setLoadingMedicineInfo(true);
    api<MedicineInfo>(`/medicine-info/${encodeURIComponent(genericName)}`, {
      signal: AbortSignal.timeout(6_000),
    })
      .then((data) => {
        if (active) setMedicineInfo(data);
      })
      .catch(() => {
        if (active) setMedicineInfo(null);
      })
      .finally(() => {
        if (active) setLoadingMedicineInfo(false);
      });

    return () => {
      active = false;
    };
  }, [result]);

  function submitLookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void lookup(batchId);
  }

  const notFound = result?.status.includes("NOT_FOUND") || result?.status.includes("INVALID");
  const recalled = result?.status === "RECALLED";
  const found = !!result && !notFound;

  return (
    <div className="shell consumer-shell">
      <SiteHeader area="consumer" />
      <main className="consumer-lookup">
        <section className="consumer-lookup-intro">
          <div className="eyebrow"><span className="eyebrow-dot" /> YOUR MEDICINE CHECK</div>
          <h1>Scan the pack.<br /><em>Check its record.</em></h1>
          <p>Scan the SANGAM QR code to look up the batch, review its recorded supply-chain details, and see medicine background information.</p>
        </section>

        <section className="consumer-lookup-card" aria-label="Scan or enter batch code">
          <div className="consumer-lookup-card-heading">
            <span className="consumer-lookup-icon" aria-hidden="true">⌕</span>
            <div>
              <h2>Check a medicine batch</h2>
              <p>Point your camera at the QR label or enter the batch ID.</p>
            </div>
          </div>
          {scanning ? (
            <div className="consumer-scanner">
              <video ref={videoRef} className="consumer-scanner-video" muted playsInline />
              <p>Place the QR code inside the camera view.</p>
              <button type="button" className="secondary" onClick={() => setScanning(false)}>Stop scanning</button>
            </div>
          ) : (
            <button
              type="button"
              className="primary consumer-scan-button"
              onClick={() => {
                setScannerMessage("");
                setScanning(true);
              }}
            >
              <span aria-hidden="true">▦</span> Scan QR code
            </button>
          )}
          {scannerMessage && <p className="consumer-scanner-message" role="status">{scannerMessage}</p>}
          <div className="consumer-lookup-divider"><span>OR ENTER BATCH ID</span></div>
          <form className="consumer-lookup-form" onSubmit={submitLookup}>
            <label htmlFor="consumer-batch-id">Batch ID</label>
            <input
              id="consumer-batch-id"
              value={batchId}
              onChange={(event) => setBatchId(event.target.value)}
              placeholder="Enter the code printed on the pack"
              autoComplete="off"
            />
            <button className="primary" type="submit" disabled={loading}>
              {loading ? "Checking record…" : "Check batch"}
            </button>
          </form>
          {error && <p className="message failure" role="alert">{error}</p>}
        </section>

        {loading && (
          <section className="consumer-result-loading" aria-live="polite">
            <span className="consumer-loading-dot" />
            Checking the SANGAM registry…
          </section>
        )}

        {result && !loading && (
          <section className="consumer-result-section" aria-live="polite">
            <div className={`consumer-result-banner ${recalled ? "is-recalled" : notFound ? "is-not-found" : "is-found"}`}>
              <span aria-hidden="true">{recalled ? "!" : notFound ? "?" : "✓"}</span>
              <div>
                <strong>{recalled ? "Recall notice for this batch" : notFound ? "Batch not found" : "Batch record found"}</strong>
                <p>{notFound ? "This code doesn't match a batch in the SANGAM registry. Check the code and try again." : recalled ? "This batch has an active recall notice. Do not use it; contact a pharmacist or health authority." : "These details are from the registered batch record."}</p>
              </div>
            </div>

            {found && (
              <article className="consumer-record-card">
                <div className="consumer-record-header">
                  <div>
                    <span className="section-kicker">SANGAM REGISTRY RECORD</span>
                    <h2>{result.medicineName} {result.strength && <span>{result.strength}</span>}</h2>
                  </div>
                  <span className={`consumer-record-status${recalled ? " is-recalled" : ""}`}>{recalled ? "RECALLED" : "RECORDED"}</span>
                </div>
                <dl className="consumer-record-grid">
                  <div><dt>Batch number</dt><dd>{result.batchNumber || batchId}</dd></div>
                  <div><dt>Expiry date</dt><dd>{result.expiryDate || "Not provided"}</dd></div>
                  <div><dt>Manufacturer</dt><dd>{result.manufacturer || "Not provided"}</dd></div>
                  <div><dt>Recorded holder</dt><dd>{result.currentHolder || "Not provided"}</dd></div>
                </dl>
                {result.commonUse?.trim() && <p className="consumer-common-use"><strong>Common use:</strong> {result.commonUse.trim()}</p>}
                <p className="consumer-record-notice">{result.notice || result.message || "Registry details do not verify the physical contents of the medicine pack."}</p>
                {!!result.custodyHistory?.length && (
                  <div className="consumer-custody">
                    <h3>Recorded custody history</h3>
                    {result.custodyHistory.map((event, index) => (
                      <div className="consumer-custody-item" key={`${event.at}-${index}`}>
                        <span className={`consumer-custody-dot chain-${event.chainStatus.toLowerCase()}`} />
                        <div>
                          <strong>{event.event.replaceAll("_", " ")}</strong>
                          <p>{event.details} · {new Date(event.at).toLocaleString()}</p>
                          <small>{event.chainStatus === "VERIFIED" ? "Chain record verified" : event.chainStatus === "INTEGRITY_MISMATCH" ? "Integrity check failed" : "Pending chain confirmation"}</small>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </article>
            )}

            {found && result.genericName?.trim() && (
              <article className="consumer-wikipedia-card">
                <span className="section-kicker">ADDITIONAL MEDICINE INFORMATION</span>
                {loadingMedicineInfo ? (
                  <p className="consumer-wikipedia-loading">Loading medicine information…</p>
                ) : medicineInfo ? (
                  <>
                    <h2>{medicineInfo.title || result.genericName}</h2>
                    <p>{medicineInfo.extract ? firstSentences(medicineInfo.extract) : "No additional information is available."}</p>
                    {medicineInfo.url && <a href={medicineInfo.url} target="_blank" rel="noopener noreferrer">Read full details <span aria-hidden="true">↗</span></a>}
                    <small>Source: Wikipedia. For medical advice, consult a qualified health professional.</small>
                  </>
                ) : (
                  <p>No additional information is available right now.</p>
                )}
              </article>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
