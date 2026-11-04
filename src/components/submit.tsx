"use client";
import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  pendingText,
  className = "btn btn-primary w-full h-11",
}: {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? (pendingText ?? "Working…") : children}
    </button>
  );
}

export function FormError({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
      {error}
    </p>
  );
}
