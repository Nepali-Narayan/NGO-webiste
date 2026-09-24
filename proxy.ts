import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  /*
   * Public root redirect
   */
  if (pathname === "/") {
    return NextResponse.redirect(
      new URL("/en", request.url)
    );
  }

  /*
   * Only protect /admin routes.
   */
  if (!pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  /*
   * Response object used for Supabase
   * session cookie synchronization.
   */
  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },

        setAll(cookiesToSet) {
          cookiesToSet.forEach(
            ({ name, value }) => {
              request.cookies.set(name, value);
            }
          );

          response = NextResponse.next({
            request,
          });

          cookiesToSet.forEach(
            ({ name, value, options }) => {
              response.cookies.set(
                name,
                value,
                options
              );
            }
          );
        },
      },
    }
  );

  /*
   * Ask Supabase to validate the authenticated user.
   *
   * Do not rely only on the presence of a cookie.
   */
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  /*
   * Authentication failure.
   */
  if (error || !user) {
    /*
     * The login page itself must remain accessible.
     */
    if (pathname === "/admin/login") {
      return response;
    }

    const loginUrl = new URL(
      "/admin/login",
      request.url
    );

    /*
     * Keep the redirect internal to this application.
     */
    const redirectPath =
      pathname +
      request.nextUrl.search;

    loginUrl.searchParams.set(
      "redirect",
      redirectPath
    );

    return NextResponse.redirect(loginUrl);
  }

  /*
   * User is authenticated.
   *
   * If an already-authenticated user visits
   * /admin/login, send them to the dashboard.
   */
  if (pathname === "/admin/login") {
    return NextResponse.redirect(
      new URL("/admin", request.url)
    );
  }

  /*
   * Authenticated request continues.
   *
   * NOTE:
   * Authentication is NOT the same as authorization.
   *
   * We will add the admin-role check separately.
   */
  return response;
}

export const config = {
  matcher: [
    "/",
    "/admin/:path*",
  ],
};
