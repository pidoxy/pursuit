"use client";
/** Client wrappers so server pages can render dialogs without passing functions across the boundary. */
import type { Ask, Opportunity, Person, Snippet } from "@/lib/types";
import { DialogButton } from "./dialog";
import { AskForm, PersonForm, SnippetForm } from "./forms";
import { PencilIcon, PlusIcon } from "./icons";
import { OppForm } from "./opp-form";

export function NewOppButton() {
  return (
    <DialogButton title="Add an opportunity" className="btn btn-primary" label={<><PlusIcon size={17} /> Add</>}>
      {(close) => <OppForm onDone={close} />}
    </DialogButton>
  );
}

export function EditOppButton({ opp }: { opp: Opportunity }) {
  return (
    <DialogButton title="Edit opportunity" label={<><PencilIcon size={15} /> Edit</>}>
      {(close) => <OppForm opp={opp} onDone={close} />}
    </DialogButton>
  );
}

export function PersonButton({ person, primary }: { person?: Person; primary?: boolean }) {
  return (
    <DialogButton
      title={person ? `Edit ${person.name}` : "Add a person"}
      className={person ? "btn btn-ghost btn-sm px-2" : primary ? "btn btn-primary" : "btn btn-secondary"}
      label={person ? <PencilIcon size={15} /> : <><PlusIcon size={16} /> Person</>}
    >
      {(close) => <PersonForm person={person} onDone={close} />}
    </DialogButton>
  );
}

export function AskButton({
  people,
  opps,
  oppId,
  personId,
  ask,
  label = "Ask",
  variant = "secondary",
}: {
  people: { id: string; name: string }[];
  opps: { id: string; org: string; role: string | null }[];
  oppId?: string;
  personId?: string;
  ask?: Ask;
  label?: string;
  variant?: "secondary" | "ghost";
}) {
  return (
    <DialogButton title="Track an ask" className={variant === "ghost" ? "btn btn-ghost btn-sm" : "btn btn-secondary"} label={<><PlusIcon size={14} /> {label}</>}>
      {(close) => <AskForm people={people} opps={opps} oppId={oppId} personId={personId} ask={ask} onDone={close} />}
    </DialogButton>
  );
}

export function SnippetButton({ snippet }: { snippet?: Snippet }) {
  return (
    <DialogButton
      title={snippet ? "Edit answer" : "New answer"}
      className={snippet ? "btn btn-ghost btn-sm" : "btn btn-primary"}
      label={snippet ? <><PencilIcon size={14} /> Edit</> : <><PlusIcon size={16} /> New</>}
    >
      {(close) => <SnippetForm snippet={snippet} onDone={close} />}
    </DialogButton>
  );
}
