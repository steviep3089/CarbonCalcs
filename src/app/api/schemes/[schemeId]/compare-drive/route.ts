import { createSupabaseServerClient } from "@/lib/supabase-server";
import { google } from "googleapis";
import { Readable } from "node:stream";
import { DEFAULT_SECTIONS, generateComparePdfExport } from "../compare-pdf/route";
import { generateComparePptxExport } from "../compare-pptx/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ schemeId: string }>;
};

type DrivePayload = {
  folder?: string;
  items?: string[];
  sections?: string[];
  attachments?: {
    pdf?: boolean;
    pptx?: boolean;
  };
};

type DriveClient = ReturnType<typeof google.drive>;

const extractDriveFolderId = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    const folderMatch = url.pathname.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    if (folderMatch?.[1]) {
      return folderMatch[1];
    }
    const id = url.searchParams.get("id");
    if (id) {
      return id;
    }
  } catch {
    // Not a URL. Fall through to raw ID handling.
  }

  return /^[a-zA-Z0-9_-]{10,}$/.test(trimmed) ? trimmed : null;
};

const createDriveClient = () => {
  const oauthClientId =
    process.env.GOOGLE_DRIVE_OAUTH_CLIENT_ID?.trim() ||
    process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const oauthClientSecret =
    process.env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET?.trim() ||
    process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  const oauthRefreshToken =
    process.env.GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN?.trim() ||
    process.env.GOOGLE_OAUTH_REFRESH_TOKEN?.trim();
  const hasAnyOauthConfig = Boolean(
    oauthClientId || oauthClientSecret || oauthRefreshToken
  );

  if (hasAnyOauthConfig) {
    if (!oauthClientId || !oauthClientSecret || !oauthRefreshToken) {
      throw new Error(
        "Missing Google Drive OAuth configuration. Set GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, and GOOGLE_OAUTH_REFRESH_TOKEN."
      );
    }

    const auth = new google.auth.OAuth2(oauthClientId, oauthClientSecret);
    auth.setCredentials({ refresh_token: oauthRefreshToken });
    return google.drive({ version: "v3", auth });
  }

  const clientEmail = process.env.GOOGLE_DRIVE_CLIENT_EMAIL?.trim();
  const privateKey = process.env.GOOGLE_DRIVE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const hasAnyServiceAccountConfig = Boolean(clientEmail || privateKey);

  if (hasAnyServiceAccountConfig) {
    if (!clientEmail || !privateKey) {
      throw new Error(
        "Missing Google Drive service account configuration. Set GOOGLE_DRIVE_CLIENT_EMAIL and GOOGLE_DRIVE_PRIVATE_KEY."
      );
    }

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: clientEmail,
        private_key: privateKey,
      },
      scopes: ["https://www.googleapis.com/auth/drive"],
    });

    return google.drive({ version: "v3", auth });
  }

  throw new Error(
    "Missing Google Drive configuration. Set GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, and GOOGLE_OAUTH_REFRESH_TOKEN, or use the service-account fallback GOOGLE_DRIVE_CLIENT_EMAIL and GOOGLE_DRIVE_PRIVATE_KEY."
  );
};

const getDriveAccountLabel = async (drive: DriveClient) => {
  try {
    const about = await drive.about.get({
      fields: "user(displayName,emailAddress)",
    });
    const displayName = about.data.user?.displayName?.trim();
    const email = about.data.user?.emailAddress?.trim();

    if (displayName && email) {
      return `${displayName} <${email}>`;
    }
    return email || displayName || null;
  } catch {
    return null;
  }
};

const getGoogleErrorStatus = (error: unknown) => {
  if (
    typeof error === "object" &&
    error &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "number"
  ) {
    return (error as { code: number }).code;
  }
  return null;
};

export async function POST(request: Request, context: RouteContext) {
  const { schemeId } = await context.params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return new Response("Unauthorized", { status: 401 });
  }

  let payload: DrivePayload;
  try {
    payload = (await request.json()) as DrivePayload;
  } catch {
    return new Response("Invalid request body", { status: 400 });
  }

  const { data: preferences } = await supabase
    .from("user_report_preferences")
    .select("google_drive_folder")
    .eq("user_id", user.id)
    .maybeSingle();

  const folderInput = payload.folder?.trim() || preferences?.google_drive_folder?.trim() || "";
  const folderId = extractDriveFolderId(folderInput);
  if (!folderId) {
    return new Response("Enter a valid Google Drive folder URL or folder ID.", { status: 400 });
  }

  const selected = (payload.items ?? []).map((item) => item.trim()).filter(Boolean);
  if (!selected.length) selected.push("live");

  const selectedSections = new Set(
    (payload.sections?.length ? payload.sections : DEFAULT_SECTIONS.split(","))
      .map((item) => item.trim())
      .filter(Boolean)
  );

  const includePdf = Boolean(payload.attachments?.pdf);
  const includePptx = Boolean(payload.attachments?.pptx);
  if (!includePdf && !includePptx) {
    return new Response("Select at least one attachment format.", { status: 400 });
  }

  try {
    const drive = createDriveClient();
    const driveAccount = await getDriveAccountLabel(drive);

    let folderCheck;
    try {
      folderCheck = await drive.files.get({
        fileId: folderId,
        fields: "id,name,mimeType,webViewLink",
        supportsAllDrives: true,
      });
    } catch (error) {
      const status = getGoogleErrorStatus(error);
      if (status === 404) {
        const accountNote = driveAccount
          ? ` Google Drive is authenticated as ${driveAccount}.`
          : "";
        return new Response(
          `File not found: ${folderId}.${accountNote}`,
          { status: 404 }
        );
      }
      throw error;
    }

    if (folderCheck.data.mimeType !== "application/vnd.google-apps.folder") {
      return new Response("The Google Drive target must be a folder.", { status: 400 });
    }

    const uploadedFiles: Array<{ id: string; name: string; webViewLink: string | null }> = [];

    if (includePdf) {
      const pdfResult = await generateComparePdfExport(schemeId, selected, selectedSections);
      if ("error" in pdfResult) {
        return new Response(pdfResult.error, { status: pdfResult.status });
      }

      const upload = await drive.files.create({
        supportsAllDrives: true,
        requestBody: {
          name: pdfResult.fileName,
          parents: [folderId],
        },
        media: {
          mimeType: "application/pdf",
          body: Readable.from(Buffer.from(pdfResult.bytes)),
        },
        fields: "id,name,webViewLink",
      });

      uploadedFiles.push({
        id: upload.data.id ?? "",
        name: upload.data.name ?? pdfResult.fileName,
        webViewLink: upload.data.webViewLink ?? null,
      });
    }

    if (includePptx) {
      const pptxResult = await generateComparePptxExport(schemeId, selected, selectedSections);
      if ("error" in pptxResult) {
        return new Response(pptxResult.error, { status: pptxResult.status });
      }

      const pptxBuffer = Buffer.isBuffer(pptxResult.buffer)
        ? pptxResult.buffer
        : Buffer.from(pptxResult.buffer as Uint8Array);

      const upload = await drive.files.create({
        supportsAllDrives: true,
        requestBody: {
          name: pptxResult.fileName,
          parents: [folderId],
        },
        media: {
          mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          body: Readable.from(pptxBuffer),
        },
        fields: "id,name,webViewLink",
      });

      uploadedFiles.push({
        id: upload.data.id ?? "",
        name: upload.data.name ?? pptxResult.fileName,
        webViewLink: upload.data.webViewLink ?? null,
      });
    }

    return Response.json({
      success: true,
      folderId,
      folderName: folderCheck.data.name ?? null,
      folderUrl:
        folderCheck.data.webViewLink ?? `https://drive.google.com/drive/folders/${folderId}`,
      files: uploadedFiles,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to save files to Google Drive.";
    return new Response(message, { status: 500 });
  }
}
