import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function PageHead({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-5 mb-8 flex-wrap">
      <div>
        <h1 className="font-serif font-light text-[2.1rem] tracking-tight">{title}</h1>
        {subtitle ? <p className="text-muted mt-1 text-[0.95rem]">{subtitle}</p> : null}
      </div>
      {right ? <div className="flex items-center gap-2">{right}</div> : null}
    </div>
  );
}

export function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="bg-surface border border-line-soft rounded-2xl p-5">
      <div className="font-mono text-[0.66rem] tracking-[0.12em] uppercase text-muted">
        {label}
      </div>
      <div
        className={`font-serif font-normal text-[1.9rem] mt-2.5 leading-none ${
          accent ? "text-accent" : ""
        }`}
      >
        {value}
      </div>
      {sub ? <div className="text-[0.8rem] text-muted mt-2">{sub}</div> : null}
    </div>
  );
}

export function Panel({
  title,
  meta,
  right,
  children,
}: {
  title?: string;
  meta?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="bg-surface border border-line-soft rounded-2xl overflow-hidden">
      {(title || right || meta) && (
        <div className="flex items-center justify-between px-5 py-4 border-b border-line-soft">
          <h2 className="font-serif font-medium text-[1.15rem]">{title}</h2>
          {meta ? (
            <span className="font-mono text-[0.7rem] tracking-[0.1em] uppercase text-muted">
              {meta}
            </span>
          ) : null}
          {right}
        </div>
      )}
      {children}
    </div>
  );
}

export type TagVariant =
  | "paid"
  | "sent"
  | "overdue"
  | "draft"
  | "accepted"
  | "pending"
  | "declined";

const tagStyles: Record<TagVariant, string> = {
  paid: "bg-green-soft text-green",
  accepted: "bg-green-soft text-green",
  sent: "bg-accent-2-soft text-accent-2",
  overdue: "bg-red-soft text-red",
  declined: "bg-red-soft text-red",
  draft: "bg-[rgba(168,156,139,0.14)] text-muted",
  pending: "bg-amber-soft text-amber",
};

export function Tag({ children, variant }: { children: ReactNode; variant: TagVariant }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono text-[0.74rem] font-semibold tracking-wide ${tagStyles[variant]}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}

type BtnProps = ComponentProps<"button"> & {
  variant?: "primary" | "ghost";
  size?: "sm" | "md";
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...rest
}: BtnProps) {
  const base =
    "inline-flex items-center gap-2 rounded-full font-semibold transition-all border";
  const sizes = {
    sm: "px-3 py-1.5 text-[0.8rem] rounded-lg",
    md: "px-4 py-2.5 text-[0.88rem]",
  };
  const variants = {
    primary:
      "bg-accent text-bg border-accent hover:-translate-y-px hover:shadow-[0_8px_22px_rgba(232,116,59,0.3)]",
    ghost:
      "bg-transparent border-line text-text hover:border-text",
  };
  return (
    <button
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      {...rest}
    />
  );
}

export function LinkButton({
  variant = "primary",
  size = "md",
  className = "",
  ...rest
}: ComponentProps<typeof Link> & {
  variant?: "primary" | "ghost";
  size?: "sm" | "md";
}) {
  const base =
    "inline-flex items-center gap-2 rounded-full font-semibold transition-all border";
  const sizes = {
    sm: "px-3 py-1.5 text-[0.8rem] rounded-lg",
    md: "px-4 py-2.5 text-[0.88rem]",
  };
  const variants = {
    primary:
      "bg-accent text-bg border-accent hover:-translate-y-px hover:shadow-[0_8px_22px_rgba(232,116,59,0.3)]",
    ghost:
      "bg-transparent border-line text-text hover:border-text",
  };
  return (
    <Link
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      {...rest}
    />
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="p-10 text-center text-muted-2 text-[0.9rem]">{children}</div>;
}

export function Th({
  children,
  className = "",
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`text-left font-mono text-[0.66rem] tracking-[0.1em] uppercase text-muted-2 px-5 py-3 border-b border-line-soft font-medium ${className}`}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  className = "",
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <td className={`px-5 py-3.5 border-b border-line-soft text-[0.92rem] ${className}`}>
      {children}
    </td>
  );
}
