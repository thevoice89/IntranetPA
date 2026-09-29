import { NextResponse } from "next/server";
import { getComunicazioni } from "@/lib/data";
import type { ApiResponse, Comunicazione } from "@/types";

export const dynamic = "force-dynamic";

// API: Comunicazioni Non Ufficiali
export async function GET() {
  const body: ApiResponse<Comunicazione[]> = {
    data: await getComunicazioni("non_ufficiale"),
  };
  return NextResponse.json(body);
}
