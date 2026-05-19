"use client";

import type { ReactElement } from "react";

import Link from "next/link";

import { ErrorState } from "@/components/shared/ErrorState";
import { Button } from "@/components/ui/button";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({
  error,
  reset,
}: ErrorPageProps): ReactElement {
  return (
    <ErrorState
      title="Interview session failed to load"
      message={error.message}
      action={
        <div className="flex items-center gap-element">
          <Button onClick={reset}>Try again</Button>
          <Button variant="secondary" asChild>
            <Link href="/session/new">Back to session setup</Link>
          </Button>
        </div>
      }
    />
  );
}
