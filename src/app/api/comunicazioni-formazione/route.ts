import { NextResponse } from "next/server";
import { getComunicazioni } from "@/lib/data";
import type { ApiResponse, Comunicazione } from "@/types";

export const dynamic = "force-dynamic";

// API: Comunicazioni Formazione
export async function GET() {
  const body: ApiResponse<Comunicazione[]> = {
    data: await getComunicazioni("formazione"),
  };
  return NextResponse.json(body);
}
