import { prisma } from "@/lib/prisma";
import { appOrigin } from "@/lib/app-url";
import { GMAIL_SCOPE, getOAuthClient, redirectUri } from "./oauth";

/** What the setup wizard shows. Never includes the client secret. */
export async function getGmailSetup() {
  const client = await getOAuthClient();
  const row = client?.source === "app" ? await prisma.gmailSettings.findUnique({ where: { id: "default" } }) : null;
  const updatedBy = row?.updatedById
    ? await prisma.user.findUnique({ where: { id: row.updatedById }, select: { firstName: true, lastName: true } })
    : null;
  return {
    configured: !!client,
    source: client?.source ?? null,
    clientId: client?.clientId ?? null,
    redirectUri: redirectUri(),
    appOrigin: appOrigin(),
    scope: GMAIL_SCOPE,
    updatedAt: row?.updatedAt.toISOString() ?? null,
    updatedByName: updatedBy ? `${updatedBy.firstName} ${updatedBy.lastName}` : null,
  };
}

export type GmailSetup = Awaited<ReturnType<typeof getGmailSetup>>;
