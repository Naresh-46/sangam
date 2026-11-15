export type CustodyTransfer = {
  id: string;
  status: "PENDING" | "CONFIRMED" | "REJECTED";
  offeredAt: string;
  confirmedAt: string | null;
  fromOrganization: { name: string; kind: string };
  toOrganization: { name: string; kind: string };
};

function relativeTime(value: string) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "time unavailable";

  const seconds = Math.round((timestamp - Date.now()) / 1000);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 60 * 60 * 24 * 365],
    ["month", 60 * 60 * 24 * 30],
    ["day", 60 * 60 * 24],
    ["hour", 60 * 60],
    ["minute", 60],
  ];
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

  for (const [unit, duration] of units) {
    if (Math.abs(seconds) >= duration) {
      return formatter.format(Math.round(seconds / duration), unit);
    }
  }
  return formatter.format(seconds, "second");
}

export function CustodyTimeline({ transfers }: { transfers: CustodyTransfer[] }) {
  return (
    <ol className="custody-timeline">
      {transfers.map((transfer) => (
        <li className="custody-step" key={transfer.id}>
          <span className={`custody-dot custody-${transfer.status.toLowerCase()}`} />
          <div className="custody-step-copy">
            <b>
              {transfer.fromOrganization.name} → {transfer.toOrganization.name}
            </b>
            <small>
              <span className={`custody-status custody-status-${transfer.status.toLowerCase()}`}>
                {transfer.status.charAt(0) + transfer.status.slice(1).toLowerCase()}
              </span>
              <span aria-hidden="true"> · </span>
              {relativeTime(transfer.confirmedAt || transfer.offeredAt)}
            </small>
          </div>
        </li>
      ))}
    </ol>
  );
}
