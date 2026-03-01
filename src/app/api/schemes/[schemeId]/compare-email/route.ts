import { createSupabaseServerClient } from "@/lib/supabase-server";
import nodemailer from "nodemailer";
import { DEFAULT_SECTIONS, generateComparePdfExport } from "../compare-pdf/route";
import { generateComparePptxExport } from "../compare-pptx/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ schemeId: string }>;
};

type EmailPayload = {
  to?: string;
  items?: string[];
  sections?: string[];
  attachments?: {
    pdf?: boolean;
    pptx?: boolean;
  };
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

const parseRecipients = (value: string) =>
  value
    .split(/[;,]/)
    .map((entry) => entry.trim())
    .filter(Boolean);

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

  let payload: EmailPayload;
  try {
    payload = (await request.json()) as EmailPayload;
  } catch {
    return new Response("Invalid request body", { status: 400 });
  }

  const recipientInput = payload.to?.trim() ?? "";
  const recipients = parseRecipients(recipientInput);
  if (!recipients.length || recipients.some((email) => !EMAIL_RE.test(email))) {
    return new Response("Enter a valid email address, or comma-separated addresses.", {
      status: 400,
    });
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

  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = Number(process.env.SMTP_PORT ?? 587);
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpFrom = process.env.SMTP_FROM;
  const smtpFromName = process.env.SMTP_FROM_NAME ?? "Holcim Carbon Calculator Portal";

  if (!smtpHost || !smtpPort || !smtpFrom || !smtpUser || !smtpPass) {
    return new Response(
      "Missing email configuration. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and SMTP_FROM.",
      { status: 500 }
    );
  }

  const attachments: Array<{ filename: string; content: Buffer }> = [];
  let schemeName = "Carbon Comparison";

  if (includePdf) {
    const pdfResult = await generateComparePdfExport(schemeId, selected, selectedSections);
    if ("error" in pdfResult) {
      return new Response(pdfResult.error, { status: pdfResult.status });
    }
    schemeName = pdfResult.schemeName;
    attachments.push({
      filename: pdfResult.fileName,
      content: Buffer.from(pdfResult.bytes),
    });
  }

  if (includePptx) {
    const pptxResult = await generateComparePptxExport(schemeId, selected, selectedSections);
    if ("error" in pptxResult) {
      return new Response(pptxResult.error, { status: pptxResult.status });
    }
    schemeName = pptxResult.schemeName;
    attachments.push({
      filename: pptxResult.fileName,
      content: Buffer.isBuffer(pptxResult.buffer)
        ? pptxResult.buffer
        : Buffer.from(pptxResult.buffer as Uint8Array),
    });
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: process.env.SMTP_SECURE === "true" || smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  const attachmentNames = attachments.map((attachment) => attachment.filename).join(", ");

  await transporter.verify();

  const info = await transporter.sendMail({
    from: smtpFromName ? `"${smtpFromName}" <${smtpFrom}>` : smtpFrom,
    to: recipients.join(", "),
    replyTo: user.email ?? undefined,
    subject: `${schemeName} Carbon Comparison report`,
    text: `Please find attached: ${attachmentNames}`,
    html: `<p>Please find attached: ${attachmentNames}</p>`,
    attachments,
  });

  if (!info.accepted?.length) {
    return new Response(
      info.response || "SMTP accepted no recipients. Check the email address and provider response.",
      { status: 502 }
    );
  }

  return Response.json({
    success: true,
    accepted: info.accepted,
    rejected: info.rejected,
    response: info.response,
    messageId: info.messageId,
  });
}
