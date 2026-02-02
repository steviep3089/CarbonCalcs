import type { Metadata } from "next";
import { Fraunces, Manrope } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";

const bodyFont = Manrope({
  variable: "--font-body",
  subsets: ["latin"],
});

const displayFont = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Carbon Calculator",
  description: "Embodied carbon tracking and scheme review portal.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const cookieTheme = cookieStore.get("theme")?.value;
  const theme =
    cookieTheme === "dark" || cookieTheme === "mid" || cookieTheme === "light"
      ? cookieTheme
      : undefined;
  const themeScript = `(function(){try{var t=localStorage.getItem('theme');if(!t){var m=document.cookie.match(/(?:^|; )theme=([^;]+)/);t=m?decodeURIComponent(m[1]):null;}if(t){document.documentElement.dataset.theme=t;}}catch(e){}})();`;
  return (
    <html lang="en" data-theme={theme} suppressHydrationWarning>
      <body className={`${bodyFont.variable} ${displayFont.variable} antialiased`}>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {children}
      </body>
    </html>
  );
}
