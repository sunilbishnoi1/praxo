import type { ReactElement } from "react";

import { InterviewSession } from "@/features/voice/components/InterviewSession";

type SessionPageProps = {
  params: Promise<{ id: string }>;
};

export default async function SessionPage({
  params,
}: SessionPageProps): Promise<ReactElement> {
  const { id } = await params;
  return <InterviewSession sessionId={id} />;
}
