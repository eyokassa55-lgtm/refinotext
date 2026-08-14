import { NextResponse } from "next/server";

import { APP_NAME } from "@/lib/constants";
import type { HealthResponse } from "@/types";

export async function GET() {
  const response: HealthResponse = {
    status: "ok",
    service: APP_NAME,
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(response);
}
