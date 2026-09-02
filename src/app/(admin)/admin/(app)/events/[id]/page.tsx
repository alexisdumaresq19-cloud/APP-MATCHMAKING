import { redirect } from "next/navigation";

export default async function EventIndexPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/admin/events/${id}/details`);
}
