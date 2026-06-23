import { Fragment } from "react";
import {
  Document,
  Page,
  Rect,
  StyleSheet,
  Svg,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { AuditSections } from "../audit-templates";

const ACCENT = "#E7743D";
const INK = "#1C1B19";
const HEADING = "#15140F";
const MUTED = "#555555";
const FAINT = "#9A9A9A";
const RULE = "#E6E4DF";
const CALLOUT_BG = "#FAF4EF";

const styles = StyleSheet.create({
  page: {
    paddingHorizontal: 56,
    paddingTop: 48,
    paddingBottom: 64,
    fontSize: 10.2,
    color: INK,
    fontFamily: "Helvetica",
    lineHeight: 1.55,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  logoBox: { width: 42, height: 42, marginRight: 12 },
  brandWrap: { flex: 1 },
  brandName: {
    fontFamily: "Times-Roman",
    fontSize: 13,
    fontWeight: 600,
    color: HEADING,
  },
  brandSub: {
    fontSize: 7.8,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: FAINT,
    marginTop: 2,
  },
  meta: {
    fontSize: 8,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: FAINT,
    textAlign: "right",
    lineHeight: 1.7,
  },
  rule: {
    height: 2.5,
    backgroundColor: ACCENT,
    marginBottom: 24,
  },
  eyebrow: {
    fontSize: 8,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: ACCENT,
    fontWeight: 700,
    marginBottom: 10,
  },
  h1: {
    fontFamily: "Times-Roman",
    fontSize: 21,
    fontWeight: 600,
    color: HEADING,
    lineHeight: 1.15,
    marginBottom: 6,
  },
  h1Accent: { color: ACCENT },
  lede: {
    fontSize: 9.6,
    color: MUTED,
    marginBottom: 24,
  },
  section: { marginBottom: 22 },
  secNum: {
    fontFamily: "Times-Roman",
    fontSize: 9,
    color: ACCENT,
    fontWeight: 600,
  },
  h2: {
    fontFamily: "Times-Roman",
    fontSize: 13.5,
    fontWeight: 600,
    color: HEADING,
    marginTop: 2,
    marginBottom: 10,
    paddingBottom: 6,
    borderBottomWidth: 0.7,
    borderBottomColor: RULE,
  },
  h3: {
    fontFamily: "Times-Roman",
    fontSize: 11,
    fontWeight: 600,
    color: "#2A2823",
    marginTop: 14,
    marginBottom: 5,
  },
  p: { marginBottom: 8 },
  muted: { color: MUTED },
  strong: { color: HEADING, fontWeight: 600 },
  token: { color: ACCENT, fontWeight: 700 },
  callout: {
    backgroundColor: CALLOUT_BG,
    borderLeftWidth: 3,
    borderLeftColor: ACCENT,
    padding: 14,
    paddingLeft: 16,
    marginBottom: 22,
  },
  bulletRow: { flexDirection: "row", marginBottom: 6 },
  bulletDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: ACCENT,
    marginRight: 9,
    marginTop: 5,
  },
  bulletText: { flex: 1, color: MUTED, lineHeight: 1.55 },
  priceBox: {
    borderWidth: 0.8,
    borderColor: RULE,
    borderTopWidth: 2.5,
    borderTopColor: ACCENT,
    padding: 18,
    paddingHorizontal: 22,
    marginTop: 10,
    marginBottom: 18,
  },
  priceLabel: {
    fontSize: 8.5,
    color: MUTED,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 6,
  },
  priceFig: {
    fontFamily: "Times-Roman",
    fontSize: 18,
    fontWeight: 600,
    color: ACCENT,
    marginBottom: 6,
  },
  signoff: {
    fontSize: 9,
    color: "#777777",
    fontStyle: "italic",
    marginTop: 24,
    paddingTop: 14,
    borderTopWidth: 0.7,
    borderTopColor: RULE,
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 56,
    right: 56,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7.5,
    color: FAINT,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
});

export type AuditPdfData = {
  client: string;
  url: string;
  date?: string;
  score: number | null;
  fee: string | null;
  sections: AuditSections;
  findings: Array<{ title: string; paras: string[] }>;
  scope: string[];
};

function Logo() {
  return (
    <Svg width={42} height={42} viewBox="0 0 80 80">
      <Rect width={80} height={80} rx={18} ry={18} fill={ACCENT} />
      <Text
        x={40}
        y={56}
        style={{ fontFamily: "Times-Roman", fontSize: 38, fontWeight: 600 }}
        fill="#0E0D0B"
        textAnchor="middle"
      >
        JS
      </Text>
    </Svg>
  );
}

type TokenRender = (key: string) => React.ReactNode | null;

/**
 * Splits a string on {tokens} and renders each token via the lookup. Strings
 * outside of token braces are passed through. Unknown tokens render as the
 * original "{key}" substring so authors notice them in the PDF.
 */
function Interpolate({
  text,
  render,
}: {
  text: string;
  render: TokenRender;
}) {
  if (!text) return null;
  const parts: React.ReactNode[] = [];
  const re = /\{(\w+)\}/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const key = m[1];
    const rendered = render(key);
    parts.push(rendered ?? `{${key}}`);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return (
    <>
      {parts.map((p, i) => (
        <Fragment key={i}>{p}</Fragment>
      ))}
    </>
  );
}

export async function renderAuditPdf(data: AuditPdfData): Promise<Buffer> {
  const year = data.date ?? String(new Date().getFullYear());
  const s = data.sections;

  const tokenRender: TokenRender = (key) => {
    switch (key) {
      case "client":
        return data.client;
      case "url":
        return data.url;
      case "score":
        return data.score == null ? (
          <Text style={styles.token}>[ score ]</Text>
        ) : (
          <Text style={styles.strong}>{data.score}</Text>
        );
      case "fee":
        return data.fee == null || data.fee === "" ? (
          <Text style={styles.token}>[ fee ]</Text>
        ) : (
          <Text>{data.fee}</Text>
        );
      default:
        return null;
    }
  };

  return renderToBuffer(
    <Document title={`${s.eyebrow} — ${data.url}`} author="Jordan Saker">
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View style={styles.logoBox}>
            <Logo />
          </View>
          <View style={styles.brandWrap}>
            <Text style={styles.brandName}>Jordan Saker</Text>
            <Text style={styles.brandSub}>Software & site performance</Text>
          </View>
          <View>
            <Text style={styles.meta}>{s.eyebrow}</Text>
            <Text style={styles.meta}>Mareeba, QLD</Text>
            <Text style={styles.meta}>{year}</Text>
          </View>
        </View>

        <View style={styles.rule} />

        <Text style={styles.eyebrow}>{s.eyebrow}</Text>
        <Text style={styles.h1}>
          {data.url} —{" "}
          <Text style={styles.h1Accent}>{s.titleFragment}</Text>
        </Text>
        <Text style={styles.lede}>
          <Interpolate text={s.lede} render={tokenRender} />
        </Text>

        {s.callout.heading || s.callout.para1 || s.callout.para2 ? (
          <View style={styles.callout}>
            {s.callout.para1 ? (
              <Text style={styles.p}>
                {s.callout.heading ? (
                  <Text style={styles.strong}>{s.callout.heading} </Text>
                ) : null}
                <Interpolate text={s.callout.para1} render={tokenRender} />
              </Text>
            ) : null}
            {s.callout.para2 ? (
              <Text style={[styles.muted, { marginBottom: 0 }]}>
                <Interpolate text={s.callout.para2} render={tokenRender} />
              </Text>
            ) : null}
          </View>
        ) : null}

        {data.findings.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.secNum}>01</Text>
            <Text style={styles.h2}>{s.section1Title}</Text>
            {data.findings.map((f, i) => (
              <View key={i}>
                <Text style={styles.h3}>{f.title}</Text>
                {f.paras.map((p, j) => (
                  <Text key={j} style={[styles.p, styles.muted]}>
                    <Interpolate text={p} render={tokenRender} />
                  </Text>
                ))}
              </View>
            ))}
          </View>
        ) : null}

        {data.scope.length > 0 || s.section2Intro || s.section2Outro ? (
          <View style={styles.section}>
            <Text style={styles.secNum}>02</Text>
            <Text style={styles.h2}>{s.section2Title}</Text>
            {s.section2Intro ? (
              <Text style={[styles.p, styles.muted]}>
                <Interpolate text={s.section2Intro} render={tokenRender} />
              </Text>
            ) : null}
            {data.scope.length > 0 ? (
              <View>
                {data.scope.map((item, i) => (
                  <View key={i} style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.bulletText}>{item}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            {s.section2Outro ? (
              <Text style={[styles.p, styles.muted, { marginTop: 10 }]}>
                <Interpolate text={s.section2Outro} render={tokenRender} />
              </Text>
            ) : null}
          </View>
        ) : null}

        {s.section3Paras.some((p) => p) ? (
          <View style={styles.section}>
            <Text style={styles.secNum}>03</Text>
            <Text style={styles.h2}>{s.section3Title}</Text>
            {s.section3Paras
              .filter((p) => p)
              .map((p, i) => (
                <Text key={i} style={[styles.p, styles.muted]}>
                  <Interpolate text={p} render={tokenRender} />
                </Text>
              ))}
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.secNum}>04</Text>
          <Text style={styles.h2}>{s.section4Title}</Text>
          <View style={styles.priceBox}>
            <Text style={styles.priceLabel}>{s.priceLabel}</Text>
            <Text style={styles.priceFig}>
              $<Interpolate text="{fee}" render={tokenRender} />
            </Text>
            {s.priceFootnote ? (
              <Text style={[styles.muted, { marginBottom: 0 }]}>
                <Interpolate text={s.priceFootnote} render={tokenRender} />
              </Text>
            ) : null}
          </View>
        </View>

        {s.signoff ? (
          <Text style={styles.signoff}>
            <Interpolate text={s.signoff} render={tokenRender} />
          </Text>
        ) : null}

        <View style={styles.footer} fixed>
          <Text>Jordan Saker · {s.eyebrow} · {data.url}</Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `${pageNumber} / ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>,
  );
}
