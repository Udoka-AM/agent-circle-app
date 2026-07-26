import type { ReactNode } from "react";

type PageHeaderProps = {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  className?: string;
};

export function PageHeader({ eyebrow, title, description, className = "" }: PageHeaderProps) {
  return (
    <div className={className}>
      <p
        className="text-xs font-semibold uppercase tracking-widest"
        style={{ color: "var(--muted)" }}
      >
        {eyebrow}
      </p>
      <h1 className="display-heading mt-3 text-4xl font-semibold tracking-tight">{title}</h1>
      {description ? (
        <p className="mt-3 max-w-xl" style={{ color: "var(--muted)" }}>
          {description}
        </p>
      ) : null}
    </div>
  );
}
