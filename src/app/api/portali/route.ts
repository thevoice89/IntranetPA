import { NextResponse } from "next/server";
import { getPortali } from "@/lib/data";
import type { ApiResponse, Portale } from "@/types";

export const dynamic = "force-dynamic";

// API: Dashboard Portali
export async function GET() {
  const body: ApiResponse<Portale[]> = { data: await getPortali() };
  return NextResponse.json(body);
}
