/**
 * PromoCraft spot illustrations — ink line-art with pastel fills and violet accents.
 * Used sparingly: dashboard quick actions and empty states. Purely decorative (aria-hidden).
 */
import type { SVGProps } from "react";

const INK = "#202b3c";
const VIOLET = "#0062ff";
const LAV = "#eaf2ff";
const PEACH = "#d6ecfb"; // secondary accent tint (#0062ff family)
const MINT = "#d9f2e7";
const SKY = "#e4f5fd";

type P = SVGProps<SVGSVGElement>;
const base = { stroke: INK, strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" } as const;

/** Project board with pinned cards — "New project". */
export function ProjectIllustration(props: P) {
  return (
    <svg viewBox="0 0 120 96" fill="none" aria-hidden {...props}>
      <ellipse cx="60" cy="88" rx="42" ry="4" fill={LAV} />
      <rect x="20" y="16" width="72" height="62" rx="8" fill="#fff" {...base} />
      <path d="M20 30h72" {...base} />
      <circle cx="28" cy="23" r="1.6" fill={INK} />
      <circle cx="34" cy="23" r="1.6" fill={INK} />
      <rect x="28" y="38" width="24" height="30" rx="4" fill={LAV} {...base} />
      <path d="M33 46h14M33 52h10" {...base} />
      <rect x="58" y="38" width="26" height="16" rx="4" fill={PEACH} {...base} />
      <rect x="58" y="58" width="26" height="12" rx="4" fill={MINT} {...base} />
      <path d="M96 22l6-6m0 0l3 9m-3-9l-9 3" stroke={VIOLET} strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <circle cx="100" cy="64" r="9" fill={VIOLET} />
      <path d="M100 60v8M96 64h8" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/** Contact card with handshake sparkle — "Add client". */
export function ClientIllustration(props: P) {
  return (
    <svg viewBox="0 0 120 96" fill="none" aria-hidden {...props}>
      <ellipse cx="60" cy="88" rx="42" ry="4" fill={LAV} />
      <rect x="18" y="24" width="64" height="48" rx="8" fill="#fff" {...base} transform="rotate(-6 50 48)" />
      <circle cx="38" cy="46" r="8" fill={PEACH} {...base} />
      <path d="M28 64c2-6 7-8 10-8s8 2 10 8" {...base} />
      <path d="M54 40h18M54 47h14M54 54h10" {...base} />
      <rect x="62" y="34" width="44" height="40" rx="8" fill={SKY} {...base} transform="rotate(8 84 54)" />
      <path d="M74 50h20M74 57h14" {...base} transform="rotate(8 84 54)" />
      <path d="M96 16l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill={VIOLET} />
      <path d="M22 14l1.4 3 3 1.4-3 1.4L22 23l-1.4-3-3-1.4 3-1.4z" fill={VIOLET} opacity=".6" />
    </svg>
  );
}

/** Checklist clipboard with pencil — "Create task". */
export function TaskIllustration(props: P) {
  return (
    <svg viewBox="0 0 120 96" fill="none" aria-hidden {...props}>
      <ellipse cx="60" cy="88" rx="42" ry="4" fill={LAV} />
      <rect x="30" y="14" width="56" height="68" rx="8" fill="#fff" {...base} />
      <rect x="46" y="9" width="24" height="10" rx="4" fill={LAV} {...base} />
      <rect x="38" y="30" width="9" height="9" rx="2.5" fill={VIOLET} stroke={VIOLET} />
      <path d="M40 34.5l2 2 3.5-4" stroke="#fff" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <path d="M53 34h24" {...base} />
      <rect x="38" y="46" width="9" height="9" rx="2.5" fill={MINT} {...base} />
      <path d="M53 50h18" {...base} />
      <rect x="38" y="62" width="9" height="9" rx="2.5" fill="#fff" {...base} />
      <path d="M53 66h20" {...base} />
      <path d="M92 40l10-10 5 5-10 10-7 2z" fill={PEACH} {...base} />
      <path d="M99 33l5 5" {...base} />
    </svg>
  );
}

/** Empty inbox tray — generic empty state. */
export function EmptyIllustration(props: P) {
  return (
    <svg viewBox="0 0 120 96" fill="none" aria-hidden {...props}>
      <ellipse cx="60" cy="86" rx="38" ry="4" fill={LAV} />
      <path d="M26 52l10-26h48l10 26v22a6 6 0 01-6 6H32a6 6 0 01-6-6z" fill="#fff" {...base} />
      <path d="M26 52h20l4 8h20l4-8h20" fill={LAV} {...base} />
      <path d="M48 36h24M52 43h16" {...base} />
      <circle cx="96" cy="22" r="6" fill={PEACH} {...base} />
      <path d="M18 26l2 4 4 2-4 2-2 4-2-4-4-2 4-2z" fill={VIOLET} />
    </svg>
  );
}

/** Rising chart on a sheet — reports. */
export function ReportIllustration(props: P) {
  return (
    <svg viewBox="0 0 120 96" fill="none" aria-hidden {...props}>
      <ellipse cx="60" cy="88" rx="42" ry="4" fill={LAV} />
      <rect x="22" y="14" width="76" height="66" rx="8" fill="#fff" {...base} />
      <rect x="32" y="52" width="10" height="18" rx="2" fill={LAV} {...base} />
      <rect x="48" y="42" width="10" height="28" rx="2" fill={PEACH} {...base} />
      <rect x="64" y="32" width="10" height="38" rx="2" fill={VIOLET} stroke={INK} strokeWidth="1.6" />
      <path d="M32 30l12-6 10 5 14-9" stroke={VIOLET} strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <circle cx="86" cy="26" r="6" fill={MINT} {...base} />
    </svg>
  );
}

/** Bell with sparkles — notifications. */
export function BellIllustration(props: P) {
  return (
    <svg viewBox="0 0 120 96" fill="none" aria-hidden {...props}>
      <ellipse cx="60" cy="88" rx="34" ry="4" fill={LAV} />
      <path d="M40 66V46a20 20 0 0140 0v20l6 6H34z" fill="#fff" {...base} />
      <path d="M54 76a6 6 0 0012 0" {...base} />
      <path d="M48 46a12 12 0 0112-12" stroke={VIOLET} strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <circle cx="80" cy="30" r="7" fill={PEACH} {...base} />
      <path d="M26 30l2 4 4 2-4 2-2 4-2-4-4-2 4-2z" fill={VIOLET} />
    </svg>
  );
}

/** Calendar page — meetings. */
export function CalendarIllustration(props: P) {
  return (
    <svg viewBox="0 0 120 96" fill="none" aria-hidden {...props}>
      <ellipse cx="60" cy="88" rx="42" ry="4" fill={LAV} />
      <rect x="24" y="20" width="72" height="60" rx="8" fill="#fff" {...base} />
      <path d="M24 34h72" {...base} />
      <rect x="24" y="20" width="72" height="14" rx="8" fill={LAV} {...base} />
      <path d="M40 14v12M80 14v12" {...base} />
      {[0, 1, 2, 3].map((c) =>
        [0, 1].map((r) => (
          <rect key={`${c}${r}`} x={34 + c * 14} y={44 + r * 14} width="8" height="8" rx="2" fill={c === 2 && r === 0 ? VIOLET : r === 1 && c === 0 ? PEACH : "#fff"} {...(c === 2 && r === 0 ? {} : base)} />
        )),
      )}
    </svg>
  );
}
