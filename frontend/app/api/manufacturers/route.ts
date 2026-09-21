import { NextResponse } from "next/server";
import { listManufacturers, PythonApiError } from "@/lib/pythonApi";

export async function GET() {
  try {
    const manufacturers = await listManufacturers();
    return NextResponse.json(manufacturers);
  } catch (error) {
    if (error instanceof PythonApiError) {
      return NextResponse.json(error.body, { status: error.status });
    }
    return NextResponse.json({ detail: "Python API is unreachable" }, { status: 502 });
  }
}
