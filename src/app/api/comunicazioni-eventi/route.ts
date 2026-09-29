import { NextResponse } from "next/server";
import { getComunicazioni } from "@/lib/data";
import type { ApiResponse, Comunicazione } from "@/types";

export const dynamic = "force-dynamic";

// API: Comunicazioni Eventi
export async function GET() {
  const body: ApiResponse<Comunicazione[]> = {
    data: await getComunicazioni("eventi"),
  };
  return NextResponse.json(body);
}
