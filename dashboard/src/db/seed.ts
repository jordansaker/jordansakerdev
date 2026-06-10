import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

const SERVICES: Array<{
  name: string;
  description: string;
  priceCents: number;
  unit: "fixed" | "hourly" | "monthly";
  sortOrder: number;
}> = [
  {
    name: "Landing Page",
    description: "Single-page responsive site, copy polish, deployed live.",
    priceCents: 180000,
    unit: "fixed",
    sortOrder: 10,
  },
  {
    name: "Business Website (up to 5 pages)",
    description: "Multi-page site, CMS, contact forms, basic SEO.",
    priceCents: 350000,
    unit: "fixed",
    sortOrder: 20,
  },
  {
    name: "Development — Hourly",
    description: "Ad-hoc feature work, integrations, fixes.",
    priceCents: 12000,
    unit: "hourly",
    sortOrder: 30,
  },
  {
    name: "Maintenance Retainer — Website",
    description: "Updates, monitoring, small changes, priority support for content sites.",
    priceCents: 2000,
    unit: "monthly",
    sortOrder: 40,
  },
  {
    name: "Maintenance Retainer — Web app / app",
    description: "Updates, monitoring, small changes, priority support for web apps and mobile apps.",
    priceCents: 17000,
    unit: "monthly",
    sortOrder: 50,
  },
  {
    name: "Bug Fix / Small Change",
    description: "Scoped single change, tested and shipped.",
    priceCents: 25000,
    unit: "fixed",
    sortOrder: 60,
  },
  {
    name: "App MVP — Discovery",
    description: "Scoping workshop, technical plan, prototype.",
    priceCents: 250000,
    unit: "fixed",
    sortOrder: 70,
  },
];

async function main() {
  const { sql } = await import("drizzle-orm");
  const { db } = await import("./index");
  const { services, settings } = await import("./schema");

  console.log("Seeding settings…");
  await db
    .insert(settings)
    .values({
      id: 1,
      legalName: "Jordan Saker",
      abn: "95 658 646 131",
      gstRegistered: true,
      businessEmail: "jordan@jordansakerdev.com",
      addressLine: "10 Leinster Drive, Mareeba QLD 4880",
      paymentInstructions: "PayID: 95 658 646 131 (ABN). Reference the invoice number.",
      invoiceSeq: 1,
      quoteSeq: 1,
    })
    .onConflictDoUpdate({
      target: settings.id,
      set: {
        legalName: sql`excluded.legal_name`,
        abn: sql`excluded.abn`,
        gstRegistered: sql`excluded.gst_registered`,
        businessEmail: sql`excluded.business_email`,
        addressLine: sql`excluded.address_line`,
        paymentInstructions: sql`excluded.payment_instructions`,
        updatedAt: sql`now()`,
      },
    });

  console.log("Seeding services…");
  for (const svc of SERVICES) {
    await db.insert(services).values(svc).onConflictDoNothing({ target: services.name });
  }

  console.log("Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
