"use client";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { addNote, addTask, saveAsk, savePerson, saveSnippet } from "@/app/app/actions";
import type { Ask, Person, Snippet } from "@/lib/types";
import { FormError, SubmitButton } from "./submit";

export function NoteForm({ oppId }: { oppId: string }) {
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          await addNote(oppId, text);
          setText("");
        });
      }}
      className="flex gap-2"
    >
      <input className="field h-10" value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a note (e.g. spoke to recruiter, salary range…)" aria-label="Note" />
      <button className="btn btn-secondary h-10" disabled={pending || !text.trim()}>Add</button>
    </form>
  );
}

export function AddTaskForm({ oppId }: { oppId?: string }) {
  const [state, action] = useActionState(addTask, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="flex flex-wrap gap-2">
      {oppId && <input type="hidden" name="opportunity_id" value={oppId} />}
      <input className="field h-10 min-w-0 flex-1" name="title" placeholder="New task" aria-label="Task" />
      <input className="field h-10 w-40" name="due_at" type="date" aria-label="Due date" />
      <SubmitButton className="btn btn-secondary h-10" pendingText="…">Add</SubmitButton>
      <FormError error={state?.error} />
    </form>
  );
}

export function PersonForm({ person, onDone }: { person?: Person; onDone: () => void }) {
  const [state, action] = useActionState(savePerson, undefined);
  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);
  return (
    <form action={action} className="space-y-4">
      {person && <input type="hidden" name="id" value={person.id} />}
      <div>
        <label className="label" htmlFor="p-name">Name</label>
        <input id="p-name" className="field" name="name" defaultValue={person?.name} required />
      </div>
      <div>
        <label className="label" htmlFor="p-email">Email</label>
        <input id="p-email" className="field" name="email" type="email" defaultValue={person?.email ?? ""} />
      </div>
      <div>
        <label className="label" htmlFor="p-rel">Relationship</label>
        <input id="p-rel" className="field" name="relation" defaultValue={person?.relation ?? ""} placeholder="Lecturer, manager, mentor…" />
      </div>
      <FormError error={state?.error} />
      <div className="flex justify-end gap-2">
        <button type="button" className="btn btn-ghost" onClick={onDone}>Cancel</button>
        <SubmitButton className="btn btn-primary">Save</SubmitButton>
      </div>
    </form>
  );
}

export function AskForm({
  ask,
  people,
  opps,
  oppId,
  personId,
  onDone,
}: {
  ask?: Ask;
  people: { id: string; name: string }[];
  opps: { id: string; org: string; role: string | null }[];
  oppId?: string;
  personId?: string;
  onDone: () => void;
}) {
  const [state, action] = useActionState(saveAsk, undefined);
  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);
  return (
    <form action={action} className="space-y-4">
      {ask && <input type="hidden" name="id" value={ask.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="a-person">Person</label>
          <select id="a-person" className="field" name="person_id" defaultValue={ask?.person_id ?? personId ?? ""} required>
            <option value="" disabled>Choose…</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="a-kind">Asked for</label>
          <select id="a-kind" className="field" name="kind" defaultValue={ask?.kind ?? "recommendation"}>
            <option value="recommendation">Recommendation letter</option>
            <option value="review">Review / feedback</option>
            <option value="referral">Referral</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="a-opp">For</label>
          <select id="a-opp" className="field" name="opportunity_id" defaultValue={ask?.opportunity_id ?? oppId ?? ""}>
            <option value="">General</option>
            {opps.map((o) => <option key={o.id} value={o.id}>{o.org}{o.role ? ` — ${o.role}` : ""}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="a-status">Status</label>
          <select id="a-status" className="field" name="status" defaultValue={ask?.status ?? "asked"}>
            <option value="to_ask">To ask</option>
            <option value="asked">Asked</option>
            <option value="agreed">Agreed</option>
            <option value="submitted">Submitted</option>
            <option value="declined">Declined</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="a-due">Due</label>
          <input id="a-due" className="field" name="due_at" type="date" defaultValue={ask?.due_at ?? ""} />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="a-notes">Notes</label>
        <input id="a-notes" className="field" name="notes" defaultValue={ask?.notes ?? ""} />
      </div>
      <FormError error={state?.error} />
      <div className="flex justify-end gap-2">
        <button type="button" className="btn btn-ghost" onClick={onDone}>Cancel</button>
        <SubmitButton className="btn btn-primary">Save</SubmitButton>
      </div>
    </form>
  );
}

export function SnippetForm({ snippet, onDone }: { snippet?: Snippet; onDone: () => void }) {
  const [state, action] = useActionState(saveSnippet, undefined);
  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);
  return (
    <form action={action} className="space-y-4">
      {snippet && <input type="hidden" name="id" value={snippet.id} />}
      <div>
        <label className="label" htmlFor="s-title">Title</label>
        <input id="s-title" className="field" name="title" defaultValue={snippet?.title} required placeholder="Research pitch (2 sentences)" />
      </div>
      <div>
        <label className="label" htmlFor="s-body">Text</label>
        <textarea id="s-body" className="field" name="body" rows={8} defaultValue={snippet?.body} required />
      </div>
      <div>
        <label className="label" htmlFor="s-tags">Tags</label>
        <input id="s-tags" className="field" name="tags" defaultValue={snippet?.tags} placeholder="bio, research, why-us" />
      </div>
      <FormError error={state?.error} />
      <div className="flex justify-end gap-2">
        <button type="button" className="btn btn-ghost" onClick={onDone}>Cancel</button>
        <SubmitButton className="btn btn-primary">Save</SubmitButton>
      </div>
    </form>
  );
}
