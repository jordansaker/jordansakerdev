export type AuditSections = {
  eyebrow: string;
  titleFragment: string;
  lede: string;
  callout: {
    heading: string;
    para1: string;
    para2: string;
  };
  section1Title: string;
  section2Title: string;
  section2Intro: string;
  section2Outro: string;
  section3Title: string;
  section3Paras: string[];
  section4Title: string;
  priceLabel: string;
  priceFootnote: string;
  signoff: string;
};

export type TemplateKey =
  | "performance"
  | "seo"
  | "accessibility"
  | "conversion"
  | "custom";

export const TEMPLATE_LABELS: Record<TemplateKey, string> = {
  performance: "Performance — mobile speed",
  seo: "SEO — organic visibility",
  accessibility: "Accessibility — WCAG compliance",
  conversion: "Conversion — checkout & funnel",
  custom: "Custom — start blank",
};

export const PERFORMANCE_DEFAULTS: AuditSections = {
  eyebrow: "Site performance review",
  titleFragment: "mobile speed",
  lede:
    "A no-obligation review of your storefront's mobile performance. Yours to keep regardless of whether we work together.",
  callout: {
    heading: "The situation.",
    para1:
      "{client}'s site is currently loading slowly enough on mobile to fail Google's Core Web Vitals — the real-user speed metric that affects both the buying experience and search visibility. For a store taking orders online, that's a measurable drag on conversion, especially on phones.",
    para2:
      "The encouraging part: the causes are specific, and none of them require changing your theme, your setup, your apps, or how the site looks. This is optimisation, not a rebuild. A current Google PageSpeed test scores the mobile homepage at {score}/100.",
  },
  section1Title: "What's slowing it down",
  section2Title: "What I'd do",
  section2Intro:
    "A fixed-scope performance pass on the homepage and key templates:",
  section2Outro:
    "What stays exactly as it is: your theme, your setup, your apps, your checkout, and the entire look and content of the site. Nothing customer-facing changes except the speed. Work is done on an unpublished copy and shared for review before anything goes live — your live store is never touched mid-build.",
  section3Title: "Honest expectations",
  section3Paras: [
    'The lab test score improves as soon as the work ships. Google\'s official Core Web Vitals status — the one in Search Console — is based on a rolling ~28-day window of real visitor data, so the "passing" status follows about a month later. The fix is immediate; Google\'s confirmation lags.',
    "I commit to a target — passing Core Web Vitals and a materially better mobile score — rather than a precise final number, confirmed on the working copy rather than over-promised here.",
  ],
  section4Title: "Commercials",
  priceLabel: "Fixed-scope optimisation project",
  priceFootnote:
    "A defined piece of work with a clear before/after — not an open-ended engagement. Optional ongoing maintenance available separately at a monthly rate, but not required.",
  signoff:
    "Happy to walk through any of this on a call, or send the full PageSpeed report it's based on. No obligation either way. — Jordan",
};

export const SEO_DEFAULTS: AuditSections = {
  eyebrow: "Search visibility review",
  titleFragment: "organic search",
  lede:
    "A no-obligation review of how {url} is showing up in Google search. Yours to keep regardless of whether we work together.",
  callout: {
    heading: "The situation.",
    para1:
      "{client}'s site is losing winnable search traffic — pages that should rank for clear, commercial queries aren't, and the technical fundamentals that Google relies on to understand the site are partially broken or missing.",
    para2:
      "The good news: search isn't a content overhaul project here. The biggest wins are technical (crawlability, indexing, structured data) and on-page (titles, headings, internal linking). No new pages or rewrites required to land the first set of gains.",
  },
  section1Title: "What's holding rankings back",
  section2Title: "What I'd do",
  section2Intro:
    "A focused technical SEO pass plus on-page work on the highest-intent pages:",
  section2Outro:
    "Your content, design, and brand voice stay exactly as they are. This is making the site legible to Google, not rewriting it. All changes are reviewed on staging before they go live; nothing customer-facing changes except where it improves clarity.",
  section3Title: "Honest expectations",
  section3Paras: [
    "Technical fixes (indexing, structured data, crawl errors) move within days of going live. Ranking improvements for the on-page work typically show up over 4–12 weeks as Google re-crawls and re-evaluates the pages.",
    "I commit to a target — measurable indexing improvements and ranking movement on the targeted queries — rather than a precise position guarantee. Search is a contested game; I'll be straight about what's realistic for your domain.",
  ],
  section4Title: "Commercials",
  priceLabel: "Fixed-scope SEO project",
  priceFootnote:
    "A defined audit + implementation engagement, not a monthly retainer. Ongoing optimisation available separately if you want to keep iterating, but not required.",
  signoff:
    "Happy to walk through the keyword and crawl data this is based on, or talk through which pages I'd target first. No obligation either way. — Jordan",
};

export const ACCESSIBILITY_DEFAULTS: AuditSections = {
  eyebrow: "Accessibility review",
  titleFragment: "WCAG compliance",
  lede:
    "A no-obligation review of how {url} performs against accessibility standards. Yours to keep regardless of whether we work together.",
  callout: {
    heading: "The situation.",
    para1:
      "{client}'s site has accessibility barriers that exclude a meaningful share of visitors — people using screen readers, keyboard navigation, or with low vision. In Australia, accessibility failures also carry concrete legal risk under the Disability Discrimination Act.",
    para2:
      "Most issues are fixable without a rebuild: contrast, focus indicators, semantic HTML, image alt text, form labels. The site currently scores around {score}/100 on an automated audit — a meaningful starting point but not the full picture, since automated tools catch maybe a third of real issues.",
  },
  section1Title: "Where the site fails today",
  section2Title: "What I'd do",
  section2Intro: "A focused accessibility remediation pass:",
  section2Outro:
    "Visual design, layout, and brand voice stay the same. Most fixes are invisible to sighted, mouse-using visitors — they just make the site work for everyone else too. Changes are tested against real screen readers (NVDA, VoiceOver) before going live.",
  section3Title: "Honest expectations",
  section3Paras: [
    "After the work, the site will meet WCAG 2.1 AA on the audited templates and pass automated tools cleanly. Full WCAG 2.2 AAA conformance is a larger project — happy to scope that separately if it matters for your sector.",
    "I commit to a target — WCAG 2.1 AA on the in-scope pages plus a clean automated scan — rather than guaranteeing zero issues forever. Accessibility is an ongoing practice; this gets the site to a defensible baseline.",
  ],
  section4Title: "Commercials",
  priceLabel: "Fixed-scope accessibility remediation",
  priceFootnote:
    "A defined remediation project with before/after testing. Ongoing accessibility QA on new features is available separately if you ship frequently.",
  signoff:
    "Happy to walk through the audit findings, or run through the site live on a screen reader if that's useful. No obligation either way. — Jordan",
};

export const CONVERSION_DEFAULTS: AuditSections = {
  eyebrow: "Conversion review",
  titleFragment: "checkout & funnel",
  lede:
    "A no-obligation review of {url}'s purchase funnel and conversion fundamentals. Yours to keep regardless of whether we work together.",
  callout: {
    heading: "The situation.",
    para1:
      "{client}'s site is generating traffic but losing buyers somewhere between landing and purchase. The friction is specific and locatable — it shows up in the funnel data, the checkout flow, and the product page details that nudge intent into action.",
    para2:
      "Conversion work isn't a redesign. The biggest moves are usually copy on key pages, form simplification, trust signals, and removing friction in the cart-to-confirm steps. Most of these ship within a sprint, not a quarter.",
  },
  section1Title: "Where the funnel leaks",
  section2Title: "What I'd do",
  section2Intro:
    "A focused conversion pass on the highest-impact pages and steps:",
  section2Outro:
    "Brand, layout, and core navigation stay the same. This is targeted optimisation of the pages that touch buying decisions, not a redesign. Changes are A/B'd or held against pre-change metrics so we know what actually moved the needle.",
  section3Title: "Honest expectations",
  section3Paras: [
    "Conversion lift varies by starting point and traffic mix. I'll be straight about realistic ranges based on your baseline — not promising 30% lifts because the case-study screenshot says so.",
    "I commit to a target — measurable improvements on the funnel steps we're working on, with proper before/after measurement — rather than a flat percentage guarantee. Conversion work compounds; the first pass sets up the next.",
  ],
  section4Title: "Commercials",
  priceLabel: "Fixed-scope conversion project",
  priceFootnote:
    "A defined audit + implementation engagement, not a retainer. Ongoing CRO testing available separately if you want to keep iterating after the initial work lands.",
  signoff:
    "Happy to walk through the funnel data and which pages I'd touch first, or run through the checkout flow on a call. No obligation either way. — Jordan",
};

export const CUSTOM_DEFAULTS: AuditSections = {
  eyebrow: "Audit",
  titleFragment: "review",
  lede: "A no-obligation review of {url}. Yours to keep regardless of whether we work together.",
  callout: {
    heading: "The situation.",
    para1: "",
    para2: "",
  },
  section1Title: "Findings",
  section2Title: "What I'd do",
  section2Intro: "",
  section2Outro: "",
  section3Title: "Honest expectations",
  section3Paras: [""],
  section4Title: "Commercials",
  priceLabel: "Fixed-scope project",
  priceFootnote: "",
  signoff: "Happy to walk through any of this on a call. No obligation either way. — Jordan",
};

export const TEMPLATE_PRESETS: Record<TemplateKey, AuditSections> = {
  performance: PERFORMANCE_DEFAULTS,
  seo: SEO_DEFAULTS,
  accessibility: ACCESSIBILITY_DEFAULTS,
  conversion: CONVERSION_DEFAULTS,
  custom: CUSTOM_DEFAULTS,
};

export function defaultSectionsFor(template: string): AuditSections {
  return (
    TEMPLATE_PRESETS[template as TemplateKey] ?? PERFORMANCE_DEFAULTS
  );
}
