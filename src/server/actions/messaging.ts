"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { resolveParticipantAccess } from "@/lib/auth/participant-session";
import { isAppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { fieldErrorsOf, formDataToObject } from "@/lib/validation/common";
import { contactNoteSchema, messageSchema } from "@/lib/validation/messaging";
import { addContact, removeContact, updateContactNote } from "@/server/services/contacts";
import {
  getOrCreateConversation,
  getThread,
  sendMessage,
  setConversationBlocked,
} from "@/server/services/messaging";
import { GENERIC_ERROR, type ActionState } from "./types";

const INVALID = "Votre lien n'est plus valide.";

function revalidate(token: string) {
  revalidatePath(`/p/${token}`, "layout");
}

/** « Message » on a match card, a company card or a contact: opens (or creates) the thread. */
export async function startConversation(token: string, otherId: string): Promise<ActionState> {
  const context = await resolveParticipantAccess(token);
  if (!context) return { ok: false, formError: INVALID };
  let conversationId: string;
  try {
    const conversation = await getOrCreateConversation(
      context.organization.id,
      context.participant.id,
      otherId,
    );
    conversationId = conversation.id;
  } catch (error) {
    if (isAppError(error)) return { ok: false, formError: error.message };
    logger.error({ err: error }, "conversation start failed");
    return { ok: false, formError: GENERIC_ERROR };
  }
  redirect(`/p/${token}/messages/${conversationId}`);
}

/** Posts one message in a thread the participant belongs to. */
export async function postMessage(
  token: string,
  conversationId: string,
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await resolveParticipantAccess(token);
  if (!context) return { ok: false, formError: INVALID };
  const parsed = messageSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsOf(parsed.error) };
  const thread = await getThread(context.participant.id, conversationId);
  if (!thread) return { ok: false, formError: "Cette conversation est introuvable." };
  try {
    await sendMessage(
      context.organization,
      context.participant.id,
      thread.conversation.other.participantId,
      parsed.data.body,
    );
    revalidate(token);
    return { ok: true, message: "Message envoyé." };
  } catch (error) {
    if (isAppError(error)) return { ok: false, formError: error.message };
    logger.error({ err: error }, "message send failed");
    return { ok: false, formError: GENERIC_ERROR };
  }
}

export async function toggleConversationBlocked(
  token: string,
  conversationId: string,
  blocked: boolean,
): Promise<ActionState> {
  const context = await resolveParticipantAccess(token);
  if (!context) return { ok: false, formError: INVALID };
  try {
    await setConversationBlocked(
      context.organization.id,
      context.participant.id,
      conversationId,
      blocked,
    );
    revalidate(token);
    return {
      ok: true,
      message: blocked
        ? "Conversation fermée : cette entreprise ne peut plus vous écrire."
        : "Conversation rouverte.",
    };
  } catch (error) {
    if (isAppError(error)) return { ok: false, formError: error.message };
    logger.error({ err: error }, "conversation block failed");
    return { ok: false, formError: GENERIC_ERROR };
  }
}

export async function addContactAction(
  token: string,
  contactId: string,
  eventId: string | null = null,
): Promise<ActionState> {
  const context = await resolveParticipantAccess(token);
  if (!context) return { ok: false, formError: INVALID };
  try {
    await addContact(context.organization.id, context.participant.id, contactId, eventId);
    revalidate(token);
    return { ok: true, message: "Ajouté à vos contacts." };
  } catch (error) {
    if (isAppError(error)) return { ok: false, formError: error.message };
    logger.error({ err: error }, "contact add failed");
    return { ok: false, formError: GENERIC_ERROR };
  }
}

export async function removeContactAction(token: string, contactId: string): Promise<ActionState> {
  const context = await resolveParticipantAccess(token);
  if (!context) return { ok: false, formError: INVALID };
  try {
    await removeContact(context.participant.id, contactId);
    revalidate(token);
    return { ok: true, message: "Retiré de vos contacts." };
  } catch (error) {
    logger.error({ err: error }, "contact removal failed");
    return { ok: false, formError: GENERIC_ERROR };
  }
}

export async function saveContactNote(
  token: string,
  contactId: string,
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await resolveParticipantAccess(token);
  if (!context) return { ok: false, formError: INVALID };
  const parsed = contactNoteSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsOf(parsed.error) };
  try {
    await updateContactNote(context.participant.id, contactId, parsed.data.note ?? null);
    revalidate(token);
    return { ok: true, message: "Note enregistrée." };
  } catch (error) {
    if (isAppError(error)) return { ok: false, formError: error.message };
    logger.error({ err: error }, "contact note save failed");
    return { ok: false, formError: GENERIC_ERROR };
  }
}
