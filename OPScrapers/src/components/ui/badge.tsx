import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Badge({
  className,
  tone = "muted",
  ...props
}: ComponentProps<"span"> & { tone?: "muted" | "live" | "down" | "warn" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[11px] tracking-wide",
        tone === "muted" && "bg-muted text-muted-foreground",
        tone === "live" && "bg-success/15 text-success",
        tone === "down" && "bg-destructive/15 text-destructive",
        tone === "warn" && "bg-warning/15 text-warning",
        className,
      )}
      {...props}
    />
  );
}
