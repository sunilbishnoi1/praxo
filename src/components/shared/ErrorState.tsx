import type { ReactElement, ReactNode } from "react";

import { AlertTriangle } from "lucide-react";

type ErrorStateProps = {
  title?: string;
  message?: string;
  action?: ReactNode;
};

export function ErrorState({
  title = "Something went wrong",
  message = "Please try again in a moment.",
  action,
}: ErrorStateProps): ReactElement {
  return (
    <div className="flex flex-col gap-element rounded-card border border-border bg-surface px-card py-card">
      <div className="flex items-center gap-element text-foreground">
        <span className="flex h-9 w-9 items-center justify-center rounded-button bg-score-bad/10 text-score-bad">
          <AlertTriangle className="h-4 w-4" aria-hidden />
        </span>
        <div>
          <h2 className="text-subheading">{title}</h2>
          <p className="text-body text-muted-foreground">{message}</p>
        </div>
      </div>
      {action ? (
        <div className="flex items-center gap-element">{action}</div>
      ) : null}
    </div>
  );
}
