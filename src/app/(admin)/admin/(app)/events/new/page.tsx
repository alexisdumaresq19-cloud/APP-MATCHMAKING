import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { EventForm } from "@/components/admin/events/event-form";
import { requireOrganizer } from "@/lib/auth/session";
import { saveEvent } from "@/server/actions/events";
import { getRuleSets } from "@/server/queries/admin";

export const metadata: Metadata = { title: "Nouvel événement" };

export default async function NewEventPage() {
  const { organization } = await requireOrganizer();
  const ruleSets = await getRuleSets(organization.id);
  return (
    <>
      <PageHeader title="Nouvel événement" description="Vous pourrez tout modifier par la suite." />
      <EventForm
        action={saveEvent.bind(null, null)}
        ruleSets={ruleSets}
        timezone={organization.timezone}
      />
    </>
  );
}
