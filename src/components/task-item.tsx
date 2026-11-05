"use client";
import Link from "next/link";
import { useState } from "react";
import { setTaskDue, snoozeTask, toggleTask } from "@/app/app/actions";
import { CheckIcon, ClockIcon } from "./icons";
import { Kbd, useToast } from "./toast";

export function dueLabel(due: string | null, today: string): string | null {
  if (!due) return null;
  if (due === today) return "Today";
  const t = new Date(today + "T12:00:00Z").getTime();
  const d = new Date(due + "T12:00:00Z").getTime();
  if (d - t === 86400_000) return "Tomorrow";
  return new Date(due + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}

/** Under 48 hours (or overdue) is the only legitimate use of red. */
export function isUrgent(due: string | null, today: string): boolean {
  if (!due) return false;
  return new Date(due + "T12:00:00Z").getTime() - new Date(today + "T12:00:00Z").getTime() <= 86400_000;
}

export function TaskItem({
  task,
  today,
  keyed = true,
}: {
  task: { id: string; title: string; due_at: string | null; done: number; org?: string | null; opportunity_id: string | null };
  today: string;
  keyed?: boolean;
}) {
  const { act } = useToast();
  const [hidden, setHidden] = useState(false);
  const [done, setDone] = useState(Boolean(task.done));
  const [editDate, setEditDate] = useState(false);
  const urgent = !done && isUrgent(task.due_at, today);
  const overdue = !done && task.due_at && task.due_at < today;
  const label = dueLabel(task.due_at, today);

  const complete = () => {
    const next = !done;
    setDone(next);
    if (keyed && next) setHidden(true);
    act(() => toggleTask(task.id, next)).then((r) => {
      if (r?.error) { setDone(!next); setHidden(false); }
    });
  };
  const snooze = () => {
    setHidden(true);
    act(() => snoozeTask(task.id, 1)).then((r) => r?.error && setHidden(false));
  };

  if (hidden) return null;
  return (
    <li
      data-nav-item={keyed ? "" : undefined}
      tabIndex={keyed ? -1 : undefined}
      className="row-hover group -mx-2 flex min-h-11 items-start gap-3 rounded-md px-2 py-2 outline-none"
    >
      <button
        type="button"
        data-key="e"
        aria-label={done ? "Mark not done" : "Mark done"}
        aria-pressed={done}
        onClick={complete}
        className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-[5px] border transition-colors ${
          done ? "border-sage bg-sage text-white" : "border-line-strong bg-surface hover:border-accent"
        }`}
      >
        {done ? <CheckIcon size={13} /> : null}
      </button>
      <div className="min-w-0 flex-1">
        <p className={`text-[14px] leading-5 ${done ? "text-muted line-through" : "text-ink"}`}>{task.title}</p>
        {task.org && task.opportunity_id && (
          <Link data-key="enter" href={`/app/o/${task.opportunity_id}`} className="text-[12px] text-muted hover:text-accent">{task.org}</Link>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {editDate ? (
          <input
            type="date"
            aria-label="Due date"
            autoFocus
            defaultValue={task.due_at ?? ""}
            onBlur={() => setEditDate(false)}
            onChange={(e) => { setEditDate(false); act(() => setTaskDue(task.id, e.target.value || null)); }}
            className="field h-7 w-36 px-2 text-[12px]"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditDate(true)}
            title="Change date"
            className={`chip tabular cursor-pointer ${urgent ? "border-transparent bg-danger-soft text-danger" : ""}`}
          >
            {label ? (overdue ? `Overdue · ${label}` : label) : "No date"}
          </button>
        )}
        {keyed && !done && (
          <button type="button" data-key="h" onClick={snooze} className="btn btn-ghost btn-sm px-1.5 text-muted opacity-0 group-hover:opacity-100 group-data-[selected=true]:opacity-100 focus:opacity-100 max-sm:opacity-100" title="Snooze until tomorrow (H)" aria-label="Snooze until tomorrow">
            <ClockIcon size={16} className="sm:hidden" /><span className="max-sm:hidden">Snooze</span> <Kbd>H</Kbd>
          </button>
        )}
      </div>
    </li>
  );
}
