import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SchemeRow = {
  id: string;
  name: string | null;
  created_at: string | null;
};

type CarbonSummaryRow = {
  scheme_id: string;
  kgco2e_per_tonne: number | null;
  created_at: string | null;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

const parseRecipients = (value: string) =>
  value
    .split(/[;,]/)
    .map((entry) => entry.trim())
    .filter(Boolean);

const getZonedParts = (date: Date, timeZone: string) => {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const parts = formatter.formatToParts(date);
  const byType = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    weekday: byType("weekday"),
    hour: Number(byType("hour")),
    minute: Number(byType("minute")),
    dateLabel: `${byType("day")} ${byType("month")} ${byType("year")}`,
  };
};

const formatKgCo2ePerT = (value: number | null) => {
  if (value === null || Number.isNaN(value)) return "Not calculated";
  return `${new Intl.NumberFormat("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)} kgCO2e/t`;
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");

async function resolveRecipients(
  supabaseAdmin: ReturnType<typeof createClient<any>>
): Promise<string[]> {
  const configured = process.env.WEEKLY_PROJECT_SUMMARY_TO?.trim() ?? "";
  if (configured) {
    return Array.from(
      new Set(parseRecipients(configured).filter((email) => EMAIL_RE.test(email)))
    );
  }

  const { data, error } = await supabaseAdmin
    .from("user_report_preferences")
    .select("default_report_email")
    .not("default_report_email", "is", null);

  if (error) {
    return [];
  }

  const rows = (data ?? []) as Array<{ default_report_email: string | null }>;
  const recipients = rows
    .map((row) => row.default_report_email?.trim() ?? "")
    .filter((email) => EMAIL_RE.test(email));

  return Array.from(new Set(recipients));
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization") ?? "";

  if (!cronSecret) {
    return new Response("Missing CRON_SECRET environment variable.", { status: 500 });
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "";
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = Number(process.env.SMTP_PORT ?? 587);
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpFrom = process.env.SMTP_FROM;
  const smtpFromName = process.env.SMTP_FROM_NAME ?? "Holcim Carbon Calculator Portal";
  const summaryTimeZone = process.env.WEEKLY_PROJECT_SUMMARY_TZ ?? "Europe/London";
  const summaryHour = Number(process.env.WEEKLY_PROJECT_SUMMARY_HOUR ?? 8);

  if (!smtpHost || !smtpPort || !smtpFrom || !smtpUser || !smtpPass) {
    return new Response(
      "Missing email configuration. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and SMTP_FROM.",
      { status: 500 }
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(
      "Missing Supabase admin configuration. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
      { status: 500 }
    );
  }

  const url = new URL(request.url);
  const force = url.searchParams.get("force") === "1";
  const now = new Date();
  const nowParts = getZonedParts(now, summaryTimeZone);
  const inWindow = nowParts.weekday.toLowerCase().startsWith("mon") && nowParts.hour === summaryHour;

  if (!force && !inWindow) {
    return Response.json({
      skipped: true,
      reason: `Outside scheduled window (${summaryTimeZone} Monday ${summaryHour}:00).`,
      now: nowParts,
    });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const recipients = await resolveRecipients(supabaseAdmin);
  if (!recipients.length) {
    return new Response(
      "No recipient emails found. Set WEEKLY_PROJECT_SUMMARY_TO or configure user_report_preferences.default_report_email.",
      { status: 400 }
    );
  }

  const [{ data: schemes, error: schemesError }, { data: summaries, error: summariesError }] =
    await Promise.all([
      supabaseAdmin
        .from("schemes")
        .select("id, name, created_at")
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("scheme_carbon_summaries")
        .select("scheme_id, kgco2e_per_tonne, created_at"),
    ]);

  if (schemesError) {
    return new Response(`Failed to load schemes: ${schemesError.message}`, { status: 500 });
  }

  if (summariesError) {
    return new Response(`Failed to load carbon summaries: ${summariesError.message}`, { status: 500 });
  }

  const latestSummaryByScheme = new Map<string, CarbonSummaryRow>();
  (summaries as CarbonSummaryRow[] | null)?.forEach((row) => {
    const existing = latestSummaryByScheme.get(row.scheme_id);
    if (!existing) {
      latestSummaryByScheme.set(row.scheme_id, row);
      return;
    }

    const existingTime = existing.created_at ? Date.parse(existing.created_at) : 0;
    const rowTime = row.created_at ? Date.parse(row.created_at) : 0;
    if (rowTime >= existingTime) {
      latestSummaryByScheme.set(row.scheme_id, row);
    }
  });

  const schemeRows = (schemes as SchemeRow[] | null) ?? [];
  const rowHtml = schemeRows
    .map((scheme) => {
      const value = latestSummaryByScheme.get(scheme.id)?.kgco2e_per_tonne ?? null;
      const name = scheme.name?.trim() || "Untitled project";
      return `<tr><td style=\"padding:8px 10px;border:1px solid #d9d9d9;\">${escapeHtml(name)}</td><td style=\"padding:8px 10px;border:1px solid #d9d9d9;text-align:right;\">${formatKgCo2ePerT(value)}</td></tr>`;
    })
    .join("");

  const textRows = schemeRows
    .map((scheme) => {
      const value = latestSummaryByScheme.get(scheme.id)?.kgco2e_per_tonne ?? null;
      const name = scheme.name?.trim() || "Untitled project";
      return `- ${name}: ${formatKgCo2ePerT(value)}`;
    })
    .join("\n");

  const subjectDate = getZonedParts(now, summaryTimeZone).dateLabel;
  const subject = `Weekly project kgCO2e/t summary - ${subjectDate}`;
  const portalUrl = siteUrl ? `${siteUrl.replace(/\/$/, "")}/schemes` : "";

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.45;color:#202124;">
      <h2 style="margin-bottom:8px;">Weekly project summary</h2>
      <p style="margin-top:0;">Here is the latest kgCO2e/t for each project.</p>
      ${
        portalUrl
          ? `<p><a href="${portalUrl}" style="color:#0f766e;text-decoration:none;">Open projects in portal</a></p>`
          : ""
      }
      <table style="border-collapse:collapse;width:100%;max-width:860px;">
        <thead>
          <tr>
            <th style="text-align:left;padding:8px 10px;border:1px solid #d9d9d9;background:#f5f5f5;">Project</th>
            <th style="text-align:right;padding:8px 10px;border:1px solid #d9d9d9;background:#f5f5f5;">kgCO2e/t</th>
          </tr>
        </thead>
        <tbody>
          ${
            rowHtml ||
            '<tr><td colspan="2" style="padding:8px 10px;border:1px solid #d9d9d9;">No projects found.</td></tr>'
          }
        </tbody>
      </table>
    </div>
  `;

  const text = [
    "Weekly project summary",
    "",
    "Latest kgCO2e/t for each project:",
    textRows || "No projects found.",
    portalUrl ? `\nOpen projects: ${portalUrl}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: process.env.SMTP_SECURE === "true" || smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  await transporter.verify();

  const info = await transporter.sendMail({
    from: smtpFromName ? `"${smtpFromName}" <${smtpFrom}>` : smtpFrom,
    to: recipients.join(", "),
    subject,
    text,
    html,
  });

  if (!info.accepted?.length) {
    return new Response(
      info.response || "SMTP accepted no recipients. Check configured recipient addresses.",
      { status: 502 }
    );
  }

  return Response.json({
    success: true,
    messageId: info.messageId,
    accepted: info.accepted,
    rejected: info.rejected,
    projectCount: schemeRows.length,
    timeZone: summaryTimeZone,
    hour: summaryHour,
  });
}
