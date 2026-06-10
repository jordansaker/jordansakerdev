import { PageHead } from "@/components/ui";
import { listClients } from "@/lib/queries";
import { recentSentEmails, sendEmailAction } from "./actions";
import { EmailComposer } from "./composer";

export const dynamic = "force-dynamic";
export const metadata = { title: "Send email · Studio" };

export default async function EmailPage() {
  const [clients, recent] = await Promise.all([listClients(), recentSentEmails()]);
  const from = process.env.RESEND_FROM || "jordan@jordansakerdev.com";

  return (
    <>
      <PageHead
        title="Send email"
        subtitle={`Send branded emails from ${extractAddress(from)} via the dashboard.`}
      />
      <EmailComposer
        clients={clients}
        recent={recent}
        from={from}
        sendAction={sendEmailAction}
      />
    </>
  );
}

function extractAddress(from: string): string {
  const m = from.match(/<([^>]+)>/);
  return m ? m[1] : from;
}
