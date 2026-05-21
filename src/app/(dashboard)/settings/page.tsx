import type { ReactElement } from "react";
import { listProviderStatuses, getDefaultUserId } from "@/features/llm";
import { ProviderSettings } from "@/features/llm/components/ProviderSettings";
import { prisma } from "@/lib/db";

export default async function SettingsPage(): Promise<ReactElement> {
  const providers = await listProviderStatuses();
  const userId = await getDefaultUserId();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { defaultLlmProvider: true },
  });
  const defaultLlmProvider = user?.defaultLlmProvider ?? null;

  return (
    <>
      {/* Header Section */}
      <header className="flex justify-between items-end border-b border-border pb-stack-md shrink-0">
        <div className="flex flex-col gap-1">
          <p className="font-label-sm text-label-sm text-muted-foreground/80 uppercase tracking-wider">System</p>
          <h2 className="font-display text-4xl font-bold text-foreground">Settings</h2>
        </div>
      </header>

      {/* Main Settings Panel */}
      <div className="flex flex-col gap-stack-lg flex-1">
        <ProviderSettings initialProviders={providers} defaultLlmProvider={defaultLlmProvider} />
      </div>
    </>
  );
}

