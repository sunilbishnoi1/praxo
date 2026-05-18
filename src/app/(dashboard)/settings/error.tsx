"use client";

import type { ReactElement } from "react";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/shared/ErrorState";

type SettingsErrorProps = {
  error: Error;
  reset: () => void;
};

export default function SettingsError({
  error,
  reset,
}: SettingsErrorProps): ReactElement {
  return (
    <ErrorState
      title="Unable to load settings"
      message={error.message}
      action={
        <Button variant="secondary" onClick={reset}>
          Try again
        </Button>
      }
    />
  );
}
