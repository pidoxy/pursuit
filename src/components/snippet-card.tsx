"use client";
import { useState } from "react";
import { recordSnippetUse } from "@/app/app/actions";
import { CopyIcon } from "./icons";

export function CopySnippet({ id, body }: { id: string; body: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="btn btn-secondary btn-sm"
      onClick={() => {
        void navigator.clipboard?.writeText(body);
        void recordSnippetUse(id);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      <CopyIcon size={14} /> {copied ? "Copied" : "Copy"}
    </button>
  );
}
