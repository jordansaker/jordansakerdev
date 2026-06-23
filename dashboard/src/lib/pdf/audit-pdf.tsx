import {
  Document,
  Page,
  StyleSheet,
  Svg,
  Rect,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";

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

export async function renderAuditPdf(data: AuditPdfData): Promise<Buffer> {
  const year = data.date ?? String(new Date().getFullYear());
  const scoreNode = data.score == null ? (
    <Text style={styles.token}>[ score ]</Text>
  ) : (
    <Text style={styles.strong}>{data.score}</Text>
  );
  const feeNode = data.fee == null || data.fee === "" ? (
    <Text style={styles.token}>[ fee ]</Text>
  ) : (
    <Text>{data.fee}</Text>
  );

  return renderToBuffer(
    <Document
      title={`Performance review — ${data.url}`}
      author="Jordan Saker"
    >
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
            <Text style={styles.meta}>Performance review</Text>
            <Text style={styles.meta}>Mareeba, QLD</Text>
            <Text style={styles.meta}>{year}</Text>
          </View>
        </View>

        <View style={styles.rule} />

        <Text style={styles.eyebrow}>Site performance review</Text>
        <Text style={styles.h1}>
          {data.url} — <Text style={styles.h1Accent}>mobile speed</Text>
        </Text>
        <Text style={styles.lede}>
          A no-obligation review of your storefront&apos;s mobile performance.
          Yours to keep regardless of whether we work together.
        </Text>

        <View style={styles.callout}>
          <Text style={[styles.p]}>
            <Text style={styles.strong}>The situation. </Text>
            {data.client}&apos;s site is currently loading slowly enough on
            mobile to <Text style={styles.strong}>fail Google&apos;s Core Web Vitals</Text>
            {" "}— the real-user speed metric that affects both the buying
            experience and search visibility. For a store taking orders online,
            that&apos;s a measurable drag on conversion, especially on phones.
          </Text>
          <Text style={[styles.muted, { marginBottom: 0 }]}>
            The encouraging part: the causes are specific, and none of them
            require changing your theme, your setup, your apps, or how the site
            looks. This is optimisation, not a rebuild. A current Google
            PageSpeed test scores the mobile homepage at {scoreNode}/100.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.secNum}>01</Text>
          <Text style={styles.h2}>What&apos;s slowing it down</Text>
          {data.findings.map((f, i) => (
            <View key={i}>
              <Text style={styles.h3}>{f.title}</Text>
              {f.paras.map((p, j) => (
                <Text key={j} style={[styles.p, styles.muted]}>
                  {p}
                </Text>
              ))}
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.secNum}>02</Text>
          <Text style={styles.h2}>What I&apos;d do</Text>
          <Text style={[styles.p, styles.muted]}>
            A fixed-scope performance pass on the homepage and key templates:
          </Text>
          <View>
            {data.scope.map((s, i) => (
              <View key={i} style={styles.bulletRow}>
                <View style={styles.bulletDot} />
                <Text style={styles.bulletText}>{s}</Text>
              </View>
            ))}
          </View>
          <Text style={[styles.p, styles.muted, { marginTop: 10 }]}>
            <Text style={styles.strong}>
              What stays exactly as it is:
            </Text>{" "}
            your theme, your setup, your apps, your checkout, and the entire
            look and content of the site. Nothing customer-facing changes
            except the speed. Work is done on an unpublished copy and shared
            for review before anything goes live — your live store is never
            touched mid-build.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.secNum}>03</Text>
          <Text style={styles.h2}>Honest expectations</Text>
          <Text style={[styles.p, styles.muted]}>
            The lab test score improves as soon as the work ships. Google&apos;s
            official Core Web Vitals status — the one in Search Console — is
            based on a rolling ~28-day window of real visitor data, so the
            &quot;passing&quot; status follows about a month later. The fix is
            immediate; Google&apos;s confirmation lags.
          </Text>
          <Text style={[styles.p, styles.muted]}>
            I commit to a <Text style={styles.strong}>target</Text> — passing
            Core Web Vitals and a materially better mobile score — rather than
            a precise final number, confirmed on the working copy rather than
            over-promised here.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.secNum}>04</Text>
          <Text style={styles.h2}>Commercials</Text>
          <View style={styles.priceBox}>
            <Text style={styles.priceLabel}>
              Fixed-scope optimisation project
            </Text>
            <Text style={styles.priceFig}>${feeNode}</Text>
            <Text style={[styles.muted, { marginBottom: 0 }]}>
              A defined piece of work with a clear before/after — not an
              open-ended engagement. Optional ongoing maintenance available
              separately at a monthly rate, but not required.
            </Text>
          </View>
        </View>

        <Text style={styles.signoff}>
          Happy to walk through any of this on a call, or send the full
          PageSpeed report it&apos;s based on. No obligation either way. — Jordan
        </Text>

        <View style={styles.footer} fixed>
          <Text>Jordan Saker · Performance review · {data.url}</Text>
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
