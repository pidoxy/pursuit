import Link from "next/link";
import { SignupForm } from "./form";

export const metadata = { title: "Create account" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <div className="card p-7 sm:p-9">
      <h1 className="h-display text-3xl">Create your account</h1>
      <p className="mt-1.5 text-ink-2">Free. Connect Gmail next and your pipeline builds itself.</p>
      <div className="mt-7"><SignupForm next={next} /></div>
      <p className="mt-6 text-center text-sm text-muted">
        Already have one? <Link className="font-semibold text-accent" href={`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`}>Sign in</Link>
      </p>
    </div>
  );
}
