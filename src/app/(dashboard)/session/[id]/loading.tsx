import type { ReactElement } from "react";

import { Loader2 } from "lucide-react";

export default function Loading(): ReactElement {
  return (
    <div className="flex min-h-[60vh] items-center justify-center gap-element text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin text-brand-500" aria-hidden />
      <p className="text-body">Loading interview session...</p>
    </div>
  );
}
