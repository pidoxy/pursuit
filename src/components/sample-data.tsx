"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { loadSampleData } from "@/app/app/actions";

export function SampleDataButton({ className = "btn btn-secondary btn-sm" }: { className?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className={className}
      disabled={pending}
      onClick={() => start(async () => { await loadSampleData(); router.push("/app/connect?step=scan"); })}
    >
      {pending ? "Loading sample inbox…" : "See it with sample data"}
    </button>
  );
}
