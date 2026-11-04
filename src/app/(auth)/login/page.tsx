import Link from "next/link";
import { LoginForm } from "./form";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <div className="card p-7 sm:p-9">
      <h1 className="h-display text-3xl">Welcome back</h1>
      <p className="mt-1.5 text-ink-2">Sign in to your pipeline.</p>
      <div className="mt-7"><LoginForm next={next} /></div>
      <p className="mt-6 text-center text-sm text-muted">
        New here? <Link className="font-semibold text-accent" href={`/signup${next ? `?next=${encodeURIComponent(next)}` : ""}`}>Create an account</Link>
      </p>
    </div>
  );
}
