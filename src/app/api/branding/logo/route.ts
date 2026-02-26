import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

const LOGO_FILE_PATH = path.join(process.cwd(), "Neils Forms", "holcim.png");

export async function GET() {
  try {
    const buffer = await fs.readFile(LOGO_FILE_PATH);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch {
    return new NextResponse("Logo not found", { status: 404 });
  }
}
