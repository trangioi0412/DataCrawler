import { NextRequest, NextResponse } from "next/server";
import { createManufacturerRequest, listManufacturerRequests, PythonApiError } from "@/lib/pythonApi";

export async function GET() {
  try {
    const requests = await listManufacturerRequests();
    return NextResponse.json(requests);
  } catch (error) {
    if (error instanceof PythonApiError) {
      return NextResponse.json(error.body, { status: error.status });
    }
    return NextResponse.json({ detail: "Python API is unreachable" }, { status: 502 });
  }
}

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => null);
  const name = payload?.name;
  const websiteUrl = payload?.website_url ?? "";

  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ detail: "'name' is required" }, { status: 400 });
  }

  try {
    const result = await createManufacturerRequest(name.trim(), websiteUrl);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof PythonApiError) {
      return NextResponse.json(error.body, { status: error.status });
    }
    return NextResponse.json({ detail: "Python API is unreachable" }, { status: 502 });
  }
}
