import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-badge border px-2 py-1 text-caption font-medium",
  {
    variants: {
      variant: {
        default: "border-border bg-surface text-foreground",
        success:
          "border-score-excellent/20 bg-score-excellent/10 text-score-excellent",
        warning:
          "border-score-average/20 bg-score-average/10 text-score-average",
        muted: "border-border bg-muted text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends
    React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({
  className,
  variant,
  ...props
}: BadgeProps): React.ReactElement {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { badgeVariants };
