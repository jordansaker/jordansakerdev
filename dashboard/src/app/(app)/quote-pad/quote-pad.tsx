"use client";

import { useMemo, useState } from "react";
import styles from "./quote-pad.module.css";

type State = {
  hours: number;
  rate: number;
  mult: number;
  buffer: number;
  retainer: number;
  discount: number;
  goal: number;
};

const TIERS = [
  { name: "Quick fixes", min: 150, max: 700 },
  { name: "Customization", min: 600, max: 3500 },
  { name: "Substantial", min: 2500, max: 8000 },
  { name: "From scratch", min: 8000, max: 50000 },
] as const;

const LMIN = Math.log(150);
const LMAX = Math.log(50000);

function logPos(v: number): number {
  const clamped = Math.max(150, Math.min(50000, v));
  return ((Math.log(clamped) - LMIN) / (LMAX - LMIN)) * 100;
}

function tierOf(v: number) {
  if (v < 700) return TIERS[0];
  if (v < 3500) return TIERS[1];
  if (v < 8000) return TIERS[2];
  return TIERS[3];
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString("en-AU");
}

const SEGMENT_BOUNDS = [150, 700, 3500, 8000, 50000] as const;
const SEGMENT_LABELS = ["fixes", "customization", "substantial", "scratch"] as const;
const SEGMENT_SHADES = ["#dfe3da", "#d2d8c9", "#c3cbb6", "#b3bda3"] as const;

const MARKET_SEGMENTS = SEGMENT_LABELS.map((label, i) => ({
  label,
  width: logPos(SEGMENT_BOUNDS[i + 1]) - logPos(SEGMENT_BOUNDS[i]),
  shade: SEGMENT_SHADES[i],
}));

export function QuotePad() {
  const [state, setState] = useState<State>({
    hours: 50,
    rate: 80,
    mult: 1.5,
    buffer: 15,
    retainer: 32,
    discount: 0,
    goal: 3000,
  });

  const calc = useMemo(() => {
    const effHours = state.hours * state.mult;
    const labor = effHours * state.rate;
    const recommended = labor * (1 + state.buffer / 100);
    const low = recommended * 0.9;
    const high = recommended * 1.15;
    const discounted = recommended * (1 - state.discount / 100);
    const effRate = effHours > 0 ? discounted / effHours : 0;
    const tier = tierOf(recommended);
    const mins = state.rate > 0 ? (state.retainer / state.rate) * 60 : 0;
    const months = state.retainer > 0 ? discounted / state.retainer : 0;
    const clients = state.retainer > 0 ? Math.ceil(state.goal / state.retainer) : 0;
    const yr1 = discounted + state.retainer * 12;
    const markerPos = logPos(recommended);
    const needlePos = Math.max(0, Math.min(100, (mins / 120) * 100));
    return {
      effHours,
      recommended,
      low,
      high,
      discounted,
      effRate,
      tier,
      mins,
      months,
      clients,
      yr1,
      markerPos,
      needlePos,
    };
  }, [state]);

  const set = <K extends keyof State>(k: K, v: State[K]) =>
    setState((s) => ({ ...s, [k]: v }));

  const minsColor =
    calc.mins < 30 ? "var(--bad)" : calc.mins < 60 ? "var(--warn)" : "var(--good)";
  const verdictTone: keyof typeof verdictClass =
    calc.mins < 30 ? "bad" : calc.mins < 60 ? "warn" : "good";
  const verdictClass = {
    bad: styles.verdictBad,
    warn: styles.verdictWarn,
    good: styles.verdictGood,
  };
  const verdictText =
    calc.mins < 30
      ? "This barely covers opening their email. One real support request and the month runs at a loss. Raise the retainer, cap support to a set number of requests, or automate maintenance hard."
      : calc.mins < 60
        ? "Tight. Workable only if upkeep is mostly automated — fine for a quiet client, risky for one who emails often. Watch your scope of “maintenance” carefully."
        : "There is genuine room for real monthly upkeep at this retainer. Sustainable, provided your build estimate held.";

  const effRateBad =
    state.discount > 0 && calc.effRate < state.rate * 0.6;

  return (
    <div className={styles.scope}>
      <div className={styles.pad}>
        <section className={styles.rail} aria-label="Job inputs">
          <div className={styles.brand}>
            <span className={styles.dot} aria-hidden />
            <h2>Quote Pad</h2>
          </div>
          <p className={styles.tag}>
            Scope in. Defensible quote out. No flattering yourself.
          </p>

          <div className={styles.field}>
            <label htmlFor="qp-hours">
              Estimated build hours <span className={styles.val}>{state.hours} h</span>
            </label>
            <input
              id="qp-hours"
              type="range"
              min={4}
              max={160}
              step={2}
              value={state.hours}
              onChange={(e) => set("hours", Number(e.target.value))}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="qp-rate">Your hourly rate</label>
            <div className={styles.numwrap}>
              <span className={styles.pre}>$</span>
              <input
                id="qp-rate"
                type="number"
                min={0}
                step={5}
                value={state.rate}
                onChange={(e) => set("rate", Number(e.target.value) || 0)}
              />
            </div>
          </div>

          <div className={styles.field}>
            <label>
              Store complexity <span className={styles.val}>×{state.mult}</span>
            </label>
            <div className={styles.seg} role="group" aria-label="Complexity multiplier">
              <button
                type="button"
                aria-pressed={state.mult === 1}
                onClick={() => set("mult", 1)}
              >
                Simple<span className={styles.mx}>×1.0</span>
              </button>
              <button
                type="button"
                aria-pressed={state.mult === 1.25}
                onClick={() => set("mult", 1.25)}
              >
                Standard<span className={styles.mx}>×1.25</span>
              </button>
              <button
                type="button"
                aria-pressed={state.mult === 1.5}
                onClick={() => set("mult", 1.5)}
              >
                Complex<span className={styles.mx}>×1.5</span>
              </button>
            </div>
          </div>

          <div className={styles.field}>
            <label htmlFor="qp-buffer">
              Revision buffer <span className={styles.val}>{state.buffer}%</span>
            </label>
            <input
              id="qp-buffer"
              type="range"
              min={0}
              max={40}
              step={5}
              value={state.buffer}
              onChange={(e) => set("buffer", Number(e.target.value))}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="qp-retainer">Monthly retainer</label>
            <div className={styles.numwrap}>
              <span className={styles.pre}>$</span>
              <input
                id="qp-retainer"
                type="number"
                min={0}
                step={1}
                value={state.retainer}
                onChange={(e) => set("retainer", Number(e.target.value) || 0)}
              />
            </div>
          </div>

          <div className={styles.field}>
            <label htmlFor="qp-discount">
              First-client / case-study discount{" "}
              <span className={styles.val}>{state.discount}%</span>
            </label>
            <input
              id="qp-discount"
              type="range"
              min={0}
              max={50}
              step={5}
              value={state.discount}
              onChange={(e) => set("discount", Number(e.target.value))}
            />
          </div>

          <div className={styles.field} style={{ marginBottom: 0 }}>
            <label htmlFor="qp-goal">Monthly recurring goal</label>
            <div className={styles.numwrap}>
              <span className={styles.pre}>$</span>
              <input
                id="qp-goal"
                type="number"
                min={0}
                step={100}
                value={state.goal}
                onChange={(e) => set("goal", Number(e.target.value) || 0)}
              />
            </div>
          </div>
        </section>

        <section className={styles.sheet} aria-label="Quote" aria-live="polite">
          <p className={styles.eyebrow}>Recommended build fee</p>
          <div className={styles.headline}>
            <div className={styles.big}>
              <span className={styles.cur}>$</span>
              {fmt(calc.discounted)}
            </div>
            {state.discount > 0 ? (
              <span className={styles.strike}>${fmt(calc.recommended)}</span>
            ) : null}
          </div>
          <p className={styles.rangeLine}>
            Negotiating band ${fmt(calc.low)} – ${fmt(calc.high)}
          </p>
          <p className={styles.tierLine}>
            Lands in the <b>{calc.tier.name}</b> tier of the market{" "}
            <span className={styles.pill}>
              ${fmt(calc.tier.min)}–${fmt(calc.tier.max)}
            </span>
          </p>

          <div className={styles.block}>
            <h3>
              Market position{" "}
              <span className={styles.note}>log scale · ballpark AUD</span>
            </h3>
            <div className={styles.bar}>
              {MARKET_SEGMENTS.map((s, i) => (
                <div
                  key={i}
                  className={styles.segM}
                  style={{ width: `${s.width}%`, background: s.shade }}
                >
                  {s.label}
                </div>
              ))}
              <div
                className={styles.marker}
                style={{ left: `${calc.markerPos}%` }}
                aria-hidden
              />
            </div>
            <div className={styles.scale}>
              <span>$150</span>
              <span>$1k</span>
              <span>$8k</span>
              <span>$50k</span>
            </div>
          </div>

          <div className={styles.block}>
            <h3>Retainer reality check</h3>
            <div className={styles.gaugeTop}>
              <span className={styles.mins} style={{ color: minsColor }}>
                {Math.round(calc.mins)}
              </span>
              <span className={styles.mlab}>
                minutes of your time, per client, per month — that&apos;s all this
                retainer buys
              </span>
            </div>
            <div className={styles.track}>
              <div
                className={styles.needle}
                style={{ left: `${calc.needlePos}%` }}
                aria-hidden
              />
            </div>
            <div className={styles.trackScale}>
              <span>0</span>
              <span>30m</span>
              <span>60m</span>
              <span>2h+</span>
            </div>
            <p className={`${styles.verdict} ${verdictClass[verdictTone]}`}>
              {verdictText}
            </p>
            <div className={styles.stats}>
              <div className={styles.stat}>
                <div className={styles.k}>Build fee equals</div>
                <div className={styles.v}>
                  {fmt(calc.months)} <small>months of retainer</small>
                </div>
              </div>
              <div className={styles.stat}>
                <div className={styles.k}>Clients to hit goal</div>
                <div className={styles.v}>
                  {fmt(calc.clients)} <small>sites to maintain</small>
                </div>
              </div>
              <div className={styles.stat}>
                <div className={styles.k}>Effective rate, post-discount</div>
                <div
                  className={styles.v}
                  style={{
                    color: effRateBad ? "var(--bad)" : "var(--paper-text)",
                  }}
                >
                  ${fmt(calc.effRate)}
                  <small>/h</small>
                </div>
              </div>
              <div className={styles.stat}>
                <div className={styles.k}>Year-one per client</div>
                <div className={styles.v}>${fmt(calc.yr1)}</div>
              </div>
            </div>
          </div>

          <p className={styles.foot}>
            Market tiers are 2026 freelance ranges (USD-derived, read as ballpark
            AUD): quick fixes ~$150–700, customization ~$600–3,500, substantial
            ~$2,500–8,000, from-scratch ~$8,000+. A guide for sizing a quote, not a
            law. The retainer figure is deliberately blunt: at your rate, it shows
            the literal time budget each client buys you each month before the work
            runs at a loss.
          </p>
        </section>
      </div>
    </div>
  );
}
