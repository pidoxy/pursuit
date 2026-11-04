"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { RefreshIcon } from "./icons";

export function SyncButton({ label = "Sync now" }: { label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="btn btn-secondary btn-sm"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch("/api/sync", { method: "POST" });
        setTimeout(() => {
          router.refresh();
          setBusy(false);
        }, 4000);
      }}
    >
      <RefreshIcon size={15} className={busy ? "animate-spin" : ""} /> {busy ? "Syncing…" : label}
    </button>
  );
}
