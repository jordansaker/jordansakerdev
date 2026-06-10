import { PageHead } from "@/components/ui";
import { listServices } from "@/lib/queries";
import { ServicesList } from "./services-list";

export const dynamic = "force-dynamic";
export const metadata = { title: "Services · Studio" };

export default async function ServicesPage() {
  const items = await listServices();
  return (
    <>
      <PageHead
        title="Services & Pricing"
        subtitle="Your standard offerings. Prices are GST-exclusive — GST is added on quotes & invoices when registered."
      />
      <ServicesList items={items} />
      <p className="text-[0.78rem] text-muted-2 mt-4 leading-relaxed">
        For custom projects, head to <b>Quotes</b> — pull in any of these standard services and add
        one-off line items, then send or convert to an invoice.
      </p>
    </>
  );
}
