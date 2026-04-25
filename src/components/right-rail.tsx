import { cn } from "@/lib/utils";

export function RightRail({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <aside
      className={cn(
        "hidden w-[22rem] shrink-0 flex-col gap-5 lg:flex",
        className,
      )}
    >
      {children}
    </aside>
  );
}
