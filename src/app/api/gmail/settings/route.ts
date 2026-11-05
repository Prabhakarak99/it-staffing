import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageUsers } from "@/lib/user-safe";
import { encrypt } from "@/lib/gmail/crypto";
import { clearOAuthClientCache, getOAuthClient, redirectUri, verifyClient } from "@/lib/gmail/oauth";
import { getGmailSetup } from "@/lib/gmail/setup";

// Setting up the Google OAuth client is an admin job: Super Admin or anyone who can manage users.
async function adminSession() {
  const session = await getSession();
  if (!session) return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!canManageUsers(session)) return { response: NextResponse.json({ error: "Only administrators can set up Gmail" }, { status: 403 }) };
  return { session };
}

export async function GET() {
  const { response } = await adminSession();
  if (response) return response;
  return NextResponse.json(await getGmailSetup());
}

export async function PUT(req: NextRequest) {
  const { session, response } = await adminSession();
  if (response) return response;

  if ((await getOAuthClient())?.source === "env") {
    return NextResponse.json({ error: "The Google keys are set on the server, so they can't be changed here" }, { status: 409 });
  }

  const body = (await req.json()) as { clientId?: string; clientSecret?: string };
  const clientId = body.clientId?.trim() ?? "";
  let clientSecret = body.clientSecret?.trim() ?? "";

  if (!/^[\w-]+\.apps\.googleusercontent\.com$/.test(clientId)) {
    return NextResponse.json({ error: "The Client ID should end with .apps.googleusercontent.com" }, { status: 400 });
  }
  // Updating only the Client ID keeps the saved secret
  if (!clientSecret) {
    const current = await getOAuthClient();
    if (!current) return NextResponse.json({ error: "Client Secret is required" }, { status: 400 });
    clientSecret = current.clientSecret;
  }

  const problem = await verifyClient(clientId, clientSecret);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  const data = { clientId, clientSecretEnc: encrypt(clientSecret), updatedById: session.userId };
  await prisma.gmailSettings.upsert({ where: { id: "default" }, create: { id: "default", ...data }, update: data });
  clearOAuthClientCache();
  console.log(`[gmail] OAuth client saved by ${session.email} (redirect ${redirectUri()})`);

  return NextResponse.json(await getGmailSetup());
}

export async function DELETE() {
  const { session, response } = await adminSession();
  if (response) return response;
  await prisma.gmailSettings.deleteMany({});
  clearOAuthClientCache();
  console.log(`[gmail] OAuth client removed by ${session.email}`);
  return NextResponse.json(await getGmailSetup());
}
