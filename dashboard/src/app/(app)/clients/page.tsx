import { Empty, PageHead } from "@/components/ui";
import { listClients } from "@/lib/queries";
import { ClientsList } from "./clients-list";

export const dynamic = "force-dynamic";
export const metadata = { title: "Clients · Studio" };

export default async function ClientsPage() {
  const items = await listClients();
  return (
    <>
      <PageHead
        title="Clients"
        subtitle="Companies and people you invoice. Contact email is used when sending invoices and quotes."
      />
      {items.length === 0 ? (
        <ClientsList items={[]} forceCreate />
      ) : (
        <ClientsList items={items} />
      )}
    </>
  );
}
