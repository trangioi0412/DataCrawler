import { NextRequest, NextResponse } from "next/server";
import { startSync, PythonApiError } from "@/lib/pythonApi";

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => null);
  const manufacturer = payload?.manufacturer;
  const mode = payload?.mode ?? "full";

  if (!manufacturer || typeof manufacturer !== "string") {
    return NextResponse.json({ detail: "'manufacturer' is required" }, { status: 400 });
  }

  try {
    const result = await startSync(manufacturer, mode);
    return NextResponse.json(result, { status: 202 });
  } catch (error) {
    if (error instanceof PythonApiError) {
      return NextResponse.json(error.body, { status: error.status });
    }
    return NextResponse.json({ detail: "Python API is unreachable" }, { status: 502 });
  }
}
