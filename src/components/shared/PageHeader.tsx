import type { ReactElement, ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
};

export function PageHeader({
  title,
  description,
  actions,
}: PageHeaderProps): ReactElement {
  return (
    <div className="flex flex-col gap-element md:flex-row md:items-center md:justify-between">
      <div className="space-y-2">
        <h1 className="text-heading">{title}</h1>
        {description ? (
          <p className="text-body text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex items-center gap-element">{actions}</div>
      ) : null}
    </div>
  );
}
