"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { SendIcon } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormAlert, fieldAria } from "@/components/shared/form-field";
import { SubmitButton } from "@/components/shared/submit-button";
import { MESSAGE_MAX_LENGTH } from "@/lib/validation/messaging";
import { postMessage } from "@/server/actions/messaging";
import type { ThreadMessage } from "@/server/services/messaging";

type MessageView = Omit<ThreadMessage, "createdAt"> & { createdAtLabel: string };

export function MessageThread({
  token,
  conversationId,
  messages,
  otherCompany,
  blocked,
  blockedByMe,
}: {
  token: string;
  conversationId: string;
  messages: MessageView[];
  otherCompany: string;
  blocked: boolean;
  blockedByMe: boolean;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(postMessage.bind(null, token, conversationId), null);
  const [body, setBody] = useState("");
  const bottom = useRef<HTMLDivElement>(null);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);
  useEffect(() => {
    if (state?.ok) {
      setBody("");
      router.refresh();
    }
  }, [state, router]);
  useEffect(() => {
    if (state && !state.ok && state.formError) toast.error(state.formError);
  }, [state]);

  return (
    <div className="flex flex-col gap-4">
      <ol
        className="max-h-[60vh] space-y-3 overflow-y-auto rounded-lg border bg-muted/30 p-3"
        aria-label={`Conversation avec ${otherCompany}`}
      >
        {messages.length === 0 ? (
          <li className="py-6 text-center text-sm text-muted-foreground">
            Aucun message pour l&apos;instant. Présentez-vous en quelques mots.
          </li>
        ) : null}
        {messages.map((message) => (
          <li key={message.id} className={message.mine ? "flex justify-end" : "flex justify-start"}>
            <div
              className={
                message.mine
                  ? "max-w-[85%] rounded-2xl rounded-br-sm bg-brand px-4 py-2 text-brand-foreground"
                  : "max-w-[85%] rounded-2xl rounded-bl-sm border bg-card px-4 py-2"
              }
            >
              <p className="text-base whitespace-pre-line">{message.body}</p>
              <p
                className={
                  message.mine
                    ? "mt-1 text-right text-xs opacity-80"
                    : "mt-1 text-xs text-muted-foreground"
                }
              >
                {message.mine ? "Vous" : otherCompany} · {message.createdAtLabel}
              </p>
            </div>
          </li>
        ))}
        <div ref={bottom} />
      </ol>

      {blocked ? (
        <FormAlert
          variant="info"
          message={
            blockedByMe
              ? "Vous avez fermé cette conversation. Rouvrez-la pour écrire à nouveau."
              : "Cette entreprise a fermé la conversation."
          }
        />
      ) : (
        <form action={formAction} noValidate className="space-y-3">
          <Field
            label={`Votre message à ${otherCompany}`}
            htmlFor="body"
            error={errors.body}
            hint={`${body.length}/${MESSAGE_MAX_LENGTH} caractères. Restez courtois; aucune coordonnée personnelle n'est transmise.`}
          >
            <Textarea
              id="body"
              name="body"
              rows={3}
              maxLength={MESSAGE_MAX_LENGTH}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="text-base"
              {...fieldAria("body", errors.body, "hint")}
            />
          </Field>
          <SubmitButton
            size="lg"
            className="bg-brand text-brand-foreground hover:bg-brand/90"
            pendingLabel="Envoi…"
            disabled={!body.trim()}
          >
            <SendIcon aria-hidden="true" />
            Envoyer
          </SubmitButton>
        </form>
      )}
    </div>
  );
}
