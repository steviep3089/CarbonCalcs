import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const LOGO_FILE_PATH = path.join(process.cwd(), "Neils Forms", "holcim.png");

export async function GET() {
  try {
    const buffer = await fs.readFile(LOGO_FILE_PATH);
    const extension = path.extname(LOGO_FILE_PATH).toLowerCase();
    const contentType = extension === ".jpg" || extension === ".jpeg"
      ? "image/jpeg"
      : extension === ".webp"
        ? "image/webp"
        : "image/png";

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch {
    return new NextResponse("Logo not found", { status: 404 });
  }
}
