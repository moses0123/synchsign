import { NextResponse } from "next/server";
import { route } from "@/lib/auth";
import { getSettings } from "@/lib/settings";

/** Public, non-sensitive configuration used by the UI. */
export const GET = route(async () => {
  const s = await getSettings();
  return NextResponse.json({
    orgName: s.branding.orgName,
    maxUploadMB: s.signing.maxUploadMB,
    registration: s.access.registration,
    allowedDomains: s.access.registration === "domains" ? s.access.allowedDomains : [],
  });
});
