import { useState, useEffect } from "react";
import { getNDK } from "../lib/nostr";

interface RelayInfo {
  url: string;
  connected: boolean;
}

interface RelayStatus {
  connectedCount: number;
  totalCount: number;
  relays: RelayInfo[];
}

function readPool(): RelayStatus {
  const ndk = getNDK();
  const relays = Array.from(ndk.pool?.relays?.values() ?? []).map((r) => ({
    url: r.url,
    connected: r.connected,
  }));
  return {
    connectedCount: relays.filter((r) => r.connected).length,
    totalCount: relays.length,
    relays,
  };
}

export function useRelayStatus(): RelayStatus {
  const [status, setStatus] = useState<RelayStatus>(readPool);

  useEffect(() => {
    const id = setInterval(() => setStatus(readPool()), 5000);
    return () => clearInterval(id);
  }, []);

  return status;
}
