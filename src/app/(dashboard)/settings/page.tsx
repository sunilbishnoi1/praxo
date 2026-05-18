import type { ReactElement } from "react";

import { PageHeader } from "@/components/shared/PageHeader";
import { listProviderStatuses } from "@/features/llm";
import { ProviderSettings } from "@/features/llm/components/ProviderSettings";

export default async function SettingsPage(): Promise<ReactElement> {
  const providers = await listProviderStatuses();

  return (
    <div className="flex flex-col gap-section">
      <PageHeader
        title="Settings"
        description="Manage your AI providers and test connectivity."
      />
      <ProviderSettings initialProviders={providers} />
    </div>
  );
}
