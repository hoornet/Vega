import { useState } from "react";
import { useRelayStatus } from "../../hooks/useRelayStatus";

function shortenUrl(url: string): string {
  return url.replace(/^wss?:\/\//, "").replace(/\/$/, "");
}

export function RelayStatusBadge() {
  const { connectedCount, totalCount, relays } = useRelayStatus();
  const [hovered, setHovered] = useState(false);

  const ratio = totalCount > 0 ? connectedCount / totalCount : 0;
  const colorClass =
    ratio > 0.75
      ? "text-success"
      : ratio > 0.25
        ? "text-warning"
        : "text-danger";
  const dotClass =
    ratio > 0.75
      ? "bg-success"
      : ratio > 0.25
        ? "bg-warning"
        : "bg-danger";

  if (totalCount === 0) return null;

  return (
    <span
      className={`relative ${colorClass} text-[11px] flex items-center gap-1 cursor-default`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dotClass} inline-block`} />
      {connectedCount}/{totalCount} relays

      {hovered && (
        <div className="absolute right-0 top-full mt-1 bg-bg-raised border border-border p-2 z-50 min-w-[200px] shadow-lg">
          {relays
            .sort((a, b) => (a.connected === b.connected ? 0 : a.connected ? -1 : 1))
            .map((r) => (
              <div key={r.url} className="flex items-center gap-2 py-0.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    r.connected ? "bg-success" : "bg-danger"
                  }`}
                />
                <span className="text-[11px] text-text-dim truncate">
                  {shortenUrl(r.url)}
                </span>
              </div>
            ))}
        </div>
      )}
    </span>
  );
}
