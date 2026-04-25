import { cn } from "@/lib/utils";
import { RightRail } from "@/components/right-rail";

export function PageLayout({
  header,
  rail,
  children,
  className,
}: {
  header?: React.ReactNode;
  rail?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-6 px-8 pt-8 pb-20", className)}>
      {header}
      <div className="flex gap-6">
        <div className="min-w-0 flex-1 space-y-5">{children}</div>
        {rail && <RightRail>{rail}</RightRail>}
      </div>
    </div>
  );
}
