import { NextResponse } from "next/server";
import { getSyncStatus, PythonApiError } from "@/lib/pythonApi";

export async function GET(_request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;

  try {
    const status = await getSyncStatus(jobId);
    return NextResponse.json(status);
  } catch (error) {
    if (error instanceof PythonApiError) {
      return NextResponse.json(error.body, { status: error.status });
    }
    return NextResponse.json({ detail: "Python API is unreachable" }, { status: 502 });
  }
}
