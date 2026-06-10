"use client";

const BRAND_NAME = "Jordan Saker";
const BRAND_EMAIL = "jordan@jordansakerdev.com";
const BRAND_PHONE = "0447 481 016";
const BRAND_WEBSITE = "jordansakerdev.com";
const BRAND_ABN = "95 658 646 131";
const ACCENT = "#E8743B";

export function BrandEmailPreview({
  subject,
  body,
  fromAddress,
  compact = false,
}: {
  subject: string;
  body: string;
  fromAddress: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`bg-[#F4EFE3] border border-[#E5DDD0] rounded-2xl ${
        compact ? "p-4" : "p-6"
      } text-[#1B1814]`}
    >
      <h2 className="font-serif font-medium text-[1.05rem] mb-3 flex items-center gap-2 text-[#1B1814]">
        <span
          className="w-2 h-2 rounded-full"
          style={{ background: ACCENT }}
          aria-hidden
        />
        Live preview
      </h2>

      <div className="bg-white border border-[#E5DDD0] rounded-xl p-5 shadow-[0_1px_0_rgba(27,24,20,0.03)]">
        <div className="flex items-baseline justify-between gap-3 mb-2">
          <span className="text-[0.85rem] text-[#1B1814]">
            <b>{BRAND_NAME}</b>{" "}
            <span className="text-[#766C5F]">· {fromAddress}</span>
          </span>
          <span className="text-[0.75rem] text-[#766C5F]">Just now</span>
        </div>
        <div className="text-[0.92rem] text-[#1B1814] font-medium mb-4">
          {subject || <span className="text-[#766C5F]">Subject preview</span>}
        </div>

        {/* The rendered email itself */}
        <div className="bg-[#FAF6EE] border border-[#F1ECDE] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#F1ECDE] flex items-center gap-3 bg-white">
            <span
              className="w-8 h-8 rounded-md flex items-center justify-center text-[#0E0D0B] text-[0.78rem] font-semibold"
              style={{ background: ACCENT, fontFamily: "Georgia, serif" }}
            >
              JS
            </span>
            <span className="font-semibold text-[1.02rem] text-[#1B1814]">
              {BRAND_NAME}
            </span>
          </div>
          <div className="px-5 py-5 text-[0.93rem] text-[#1B1814] leading-relaxed bg-white">
            <BodyPreview value={body} />
          </div>
          <div className="px-5 pb-5 pt-2 bg-white text-[0.86rem]">
            <div className="font-semibold text-[#1B1814]">{BRAND_NAME}</div>
            <div className="text-[#766C5F] mt-0.5">
              <a href={`mailto:${BRAND_EMAIL}`} style={{ color: ACCENT }}>
                {BRAND_EMAIL}
              </a>{" "}
              · {BRAND_PHONE}
            </div>
            <div className="mt-0.5">
              <a href={`https://${BRAND_WEBSITE}`} style={{ color: ACCENT }}>
                {BRAND_WEBSITE}
              </a>
            </div>
          </div>
          <div className="px-5 py-3 bg-[#FAF6EE] border-t border-[#F1ECDE] text-center text-[0.72rem] text-[#766C5F]">
            {BRAND_NAME} · ABN {BRAND_ABN}
          </div>
        </div>
      </div>
    </div>
  );
}

function BodyPreview({ value }: { value: string }) {
  const paragraphs = value
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) {
    return <p className="text-[#766C5F]">Type a message on the left…</p>;
  }
  return (
    <>
      {paragraphs.map((p, i) => (
        <p key={i} className="mb-3 last:mb-0 whitespace-pre-wrap">
          {p}
        </p>
      ))}
    </>
  );
}
