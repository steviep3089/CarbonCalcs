import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function proxy(request: NextRequest) {
  const response = NextResponse.next();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  let user = null as Awaited<ReturnType<typeof supabase.auth.getUser>>["data"]["user"] | null;
  try {
    const result = await supabase.auth.getUser();
    user = result.data.user ?? null;
  } catch {
    return response;
  }

  const path = request.nextUrl.pathname;
  const isPublic =
    path === "/" ||
    path.startsWith("/reset") ||
    path.startsWith("/api/branding/");

  if (path.startsWith("/api/branding/")) {
    console.info("[proxy] branding request", {
      path,
      isPublic,
      hasUser: Boolean(user),
    });
  }

  if (!user && !isPublic) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/";
    redirectUrl.searchParams.set("redirect", path);
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|carbon-hero.svg|.*\\.(?:png|jpg|jpeg|svg|webp)$).*)",
  ],
};
