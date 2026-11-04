"use client";
import Link from "next/link";
import { useTransition } from "react";
import { toggleTask } from "@/app/app/actions";
import { CheckIcon } from "./icons";

export function TaskItem({
  task,
  today,
}: {
  task: { id: string; title: string; due_at: string | null; done: number; org?: string | null; opportunity_id: string | null };
  today: string;
}) {
  const [pending, start] = useTransition();
  const overdue = task.due_at && task.due_at < today && !task.done;
  const dueLabel = task.due_at
    ? task.due_at === today
      ? "Today"
      : new Date(task.due_at + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })
    : null;
  return (
    <li className={`flex items-start gap-3 py-2.5 ${pending ? "opacity-50" : ""}`}>
      <button
        aria-label={task.done ? "Mark not done" : "Mark done"}
        onClick={() => start(() => toggleTask(task.id, !task.done))}
        className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border-2 transition-colors ${
          task.done ? "border-sage bg-sage text-white" : "border-line-strong hover:border-accent"
        }`}
      >
        {task.done ? <CheckIcon size={12} /> : null}
      </button>
      <div className="min-w-0 flex-1">
        <p className={`text-[0.93rem] font-medium leading-snug ${task.done ? "text-muted line-through" : ""}`}>{task.title}</p>
        {task.org && task.opportunity_id && (
          <Link href={`/app/o/${task.opportunity_id}`} className="text-xs text-muted hover:text-accent">{task.org}</Link>
        )}
      </div>
      {dueLabel && (
        <span className={`chip shrink-0 ${overdue ? "border-transparent bg-danger-soft text-danger" : ""}`}>{overdue ? `Overdue · ${dueLabel}` : dueLabel}</span>
      )}
    </li>
  );
}
