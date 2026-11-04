import { requireUser } from "@/lib/auth";
import { SnippetButton } from "@/components/dialogs";
import { db } from "@/lib/db";
import type { Snippet } from "@/lib/types";
import { ActionButton } from "@/components/action-button";
import { CopySnippet } from "@/components/snippet-card";
import { deleteSnippet } from "../actions";

export const metadata = { title: "Answers" };

export default async function AnswersPage({ searchParams }: { searchParams: Promise<{ q?: string; tag?: string }> }) {
  const user = await requireUser();
  const { q, tag } = await searchParams;
  let snippets = db.prepare(`SELECT * FROM snippets WHERE user_id = ? ORDER BY uses DESC, updated_at DESC`).all(user.id) as Snippet[];
  const tags = [...new Set(snippets.flatMap((s) => s.tags.split(",").filter(Boolean)))].sort();
  if (tag) snippets = snippets.filter((s) => s.tags.split(",").includes(tag));
  if (q) {
    const needle = q.toLowerCase();
    snippets = snippets.filter((s) => s.title.toLowerCase().includes(needle) || s.body.toLowerCase().includes(needle));
  }
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="h-display text-3xl">Answers</h1>
          <p className="mt-1 text-ink-2">Your best paragraphs — bio, research pitch, &ldquo;why us&rdquo; — ready to reuse.</p>
        </div>
        <SnippetButton />
      </div>
      <form className="flex flex-wrap gap-2" role="search">
        <input className="field h-10 max-w-sm" name="q" defaultValue={q} placeholder="Search answers" aria-label="Search answers" />
        {tag && <input type="hidden" name="tag" value={tag} />}
        <button className="btn btn-secondary h-10">Search</button>
      </form>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <a href="/app/answers" className={`chip ${!tag ? "border-ink bg-ink text-bg" : ""}`}>All</a>
          {tags.map((t) => <a key={t} href={`/app/answers?tag=${encodeURIComponent(t)}`} className={`chip ${tag === t ? "border-ink bg-ink text-bg" : ""}`}>{t}</a>)}
        </div>
      )}
      {snippets.length ? (
        <ul className="grid gap-4 md:grid-cols-2">
          {snippets.map((s) => (
            <li key={s.id} className="card flex flex-col p-5">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold">{s.title}</p>
                <span className="shrink-0 text-xs text-muted">{s.body.split(/\s+/).length} words · used {s.uses}×</span>
              </div>
              <p className="mt-2 line-clamp-6 whitespace-pre-wrap text-sm leading-relaxed text-ink-2">{s.body}</p>
              <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-4">
                <CopySnippet id={s.id} body={s.body} />
                <SnippetButton snippet={s} />
                <ActionButton action={deleteSnippet.bind(null, s.id)} className="btn btn-ghost btn-sm text-danger" confirmText="Delete this answer?">Delete</ActionButton>
                <span className="ml-auto flex gap-1">{s.tags.split(",").filter(Boolean).map((t) => <span key={t} className="chip">{t}</span>)}</span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-2xl border border-dashed border-line-strong p-10 text-center">
          <p className="font-semibold">{q || tag ? "No matches" : "Start your answer bank"}</p>
          <p className="mt-1 text-sm text-muted">Save the paragraphs you keep rewriting: a two-line bio, your research pitch, why this company.</p>
        </div>
      )}
    </div>
  );
}
