import * as React from "react";

import { cn } from "@/lib/utils";

type SkeletonProps = React.HTMLAttributes<HTMLDivElement>;

export function Skeleton({
  className,
  ...props
}: SkeletonProps): React.ReactElement {
  return (
    <div
      className={cn("animate-pulse rounded-button bg-muted", className)}
      {...props}
    />
  );
}
