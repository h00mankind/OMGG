import Image from "next/image";
import { cn } from "@/lib/utils";

export type PageHeaderProps = {
  title: string;
  subtitle?: string;
  banner?: string;
  bannerAlt?: string;
  eyebrow?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
};

export function PageHeader({
  title,
  subtitle,
  banner,
  bannerAlt = "",
  eyebrow,
  actions,
  children,
  className,
}: PageHeaderProps) {
  return (
    <section
      className={cn(
        "relative overflow-hidden surface-card",
        "px-8 pt-10 pb-12",
        className
      )}
    >
      {banner && (
        <div className="pointer-events-none absolute inset-0">
          <Image
            src={banner}
            alt={bannerAlt}
            fill
            priority
            className="object-cover object-right opacity-90"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-card via-card/85 to-card/10" />
          <div className="absolute inset-y-0 right-0 w-1/3 bg-gradient-to-l from-card/0 to-transparent" />
        </div>
      )}
      <div className="relative flex items-start justify-between gap-6">
        <div className="min-w-0 flex-1">
          {eyebrow && (
            <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-primary">
              {eyebrow}
            </div>
          )}
          <h1 className="font-display text-4xl font-bold uppercase tracking-[0.08em] text-foreground sm:text-5xl">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-3 max-w-xl text-sm text-muted-foreground">
              {subtitle}
            </p>
          )}
          {children && <div className="mt-5">{children}</div>}
        </div>
        {actions && (
          <div className="hidden shrink-0 items-center gap-3 lg:flex">
            {actions}
          </div>
        )}
      </div>
    </section>
  );
}
