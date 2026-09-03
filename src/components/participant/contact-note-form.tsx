"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { Field, fieldAria } from "@/components/shared/form-field";
import { SubmitButton } from "@/components/shared/submit-button";
import { saveContactNote } from "@/server/actions/messaging";

/** Private note on a contact, saved in place. */
export function ContactNoteForm({
  token,
  contactId,
  note,
}: {
  token: string;
  contactId: string;
  note: string | null;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(saveContactNote.bind(null, token, contactId), null);
  const [value, setValue] = useState(note ?? "");
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  useEffect(() => {
    if (state?.ok) {
      toast.success(state.message ?? "Note enregistrée.");
      router.refresh();
    } else if (state && !state.ok && state.formError) toast.error(state.formError);
  }, [state, router]);
  const dirty = value.trim() !== (note ?? "").trim();
  const id = `note-${contactId}`;
  return (
    <form action={formAction} noValidate className="space-y-2">
      <Field label="Ma note" htmlFor={id} optionalLabel error={errors.note}>
        <Textarea
          id={id}
          name="note"
          rows={2}
          maxLength={500}
          placeholder="Ex. : rencontré à la table 4, rappeler en octobre."
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="text-sm"
          {...fieldAria(id, errors.note)}
        />
      </Field>
      {dirty ? (
        <SubmitButton size="sm" pendingLabel="Enregistrement…">
          Enregistrer la note
        </SubmitButton>
      ) : null}
    </form>
  );
}
