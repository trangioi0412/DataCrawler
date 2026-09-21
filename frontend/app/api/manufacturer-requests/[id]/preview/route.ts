import { NextResponse } from "next/server";
import { previewManufacturerRequest, PythonApiError } from "@/lib/pythonApi";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const requestId = Number(id);
  if (!Number.isInteger(requestId)) {
    return NextResponse.json({ detail: "Invalid request id" }, { status: 400 });
  }

  try {
    const result = await previewManufacturerRequest(requestId);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof PythonApiError) {
      return NextResponse.json(error.body, { status: error.status });
    }
    return NextResponse.json({ detail: "Python API is unreachable" }, { status: 502 });
  }
}
