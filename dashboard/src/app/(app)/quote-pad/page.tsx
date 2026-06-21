import { Inter, Space_Grotesk } from "next/font/google";
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
    <div className={`${spaceGrotesk.variable} ${inter.variable}`}>
      <QuotePad />
    </div>
  );
}
