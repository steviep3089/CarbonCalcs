This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Weekly Monday Project Summary Email

This portal includes a cron endpoint at `/api/cron/weekly-project-summary` that sends a weekly email with every project and its latest `kgCO2e/t` value.

### Schedule

- `vercel.json` schedules the route every Monday hour (`0 * * * 1`) in UTC.
- The route only sends when the configured local time window is reached (default: Monday 08:00 in `Europe/London`).

### Required Environment Variables

- `CRON_SECRET` (required): shared secret for cron auth (`Authorization: Bearer <CRON_SECRET>`)
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` (required): SMTP config
- `SMTP_FROM_NAME` (optional): sender display name
- `SUPABASE_SERVICE_ROLE_KEY` (required): used to query all schemes/summaries from cron route
- `NEXT_PUBLIC_SUPABASE_URL` (required): Supabase project URL

### Optional Environment Variables

- `WEEKLY_PROJECT_SUMMARY_TO`: comma/semicolon-separated recipient list. If omitted, recipients are pulled from `user_report_preferences.default_report_email`.
- `WEEKLY_PROJECT_SUMMARY_TZ`: timezone for send window check (default: `Europe/London`)
- `WEEKLY_PROJECT_SUMMARY_HOUR`: local hour for send window check (default: `8`)
- `NEXT_PUBLIC_SITE_URL` or `NEXT_PUBLIC_APP_URL`: used to include a link back to `/schemes` in the email

### Manual Test

Call the route manually with:

- `GET /api/cron/weekly-project-summary?force=1`
- Header: `Authorization: Bearer <CRON_SECRET>`

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
