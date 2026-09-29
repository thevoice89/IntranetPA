import { NextResponse } from "next/server";
import { getServizi } from "@/lib/data";
import type { ApiResponse, Servizio } from "@/types";

export const dynamic = "force-dynamic";

// API: Dashboard Strumenti
export async function GET() {
  const body: ApiResponse<Servizio[]> = { data: await getServizi() };
  return NextResponse.json(body);
}
