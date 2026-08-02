import { redirect } from 'next/navigation';

/**
 * Het AI-profiel heeft sinds dashboard-v2 (§8) geen eigen scherm meer: kolom 2 van het
 * klantdetail ÍS de editor, inclusief versiehistorie. Deze route blijft alleen bestaan
 * voor oude links en bladwijzers en stuurt door naar het detail.
 *
 * Server-side redirect: dan is er geen flits van een lege pagina. De rest van het
 * dashboard is client-side (A2), maar hier valt niets te renderen.
 */
export default async function ProfielRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/klant/${encodeURIComponent(id)}`);
}
