import { headers } from "next/headers";

export async function getClientId(): Promise<string> {
  const headerList = await headers();
  const forwardedFor = headerList.get("x-forwarded-for");
  const realIp = headerList.get("x-real-ip");

  return forwardedFor?.split(",")[0]?.trim() || realIp || "local";
}
