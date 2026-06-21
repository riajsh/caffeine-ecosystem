import { NextResponse } from "next/server";

import { syncAllCalendarAccounts } from "@/lib/integrations/calendar/sync";

function authoriseCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return false;
  }

  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authoriseCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncAllCalendarAccounts();
    const hasErrors = result.stats.errors.length > 0;
    return NextResponse.json(
      {
        ok: !hasErrors,
        accountsProcessed: result.accountsProcessed,
        stats: result.stats,
      },
      { status: hasErrors ? 500 : 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Calendar sync failed";
    console.error("Calendar sync cron failed:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
