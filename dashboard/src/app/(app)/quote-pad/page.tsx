import { Inter, Space_Grotesk } from "next/font/google";
import { PageHead } from "@/components/ui";
import { SectionTabs } from "@/components/section-tabs";
import { QUOTES_TABS } from "../quotes/tabs";
import { QuotePad } from "./quote-pad";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata = { title: "Quote Pad · Studio" };

export default function QuotePadPage() {
  return (
    <>
      <PageHead
        title="Quotes"
        subtitle="Scope in. Defensible quote out."
      />
      <SectionTabs tabs={QUOTES_TABS} />
      <div className={`${spaceGrotesk.variable} ${inter.variable}`}>
        <QuotePad />
      </div>
    </>
  );
}
