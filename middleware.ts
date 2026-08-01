import { NextResponse, type NextRequest } from "next/server";
import { auth0 } from "@/lib/auth0";

export async function middleware(request: NextRequest) {
  const authResponse = await auth0().middleware(request);
  const { pathname } = request.nextUrl;

  // Routes gérées par Auth0 (/auth/login, /auth/logout, /auth/callback…)
  if (pathname.startsWith("/auth")) {
    return authResponse;
  }

  const session = await auth0().getSession(request);
  if (!session) {
    // Les routes d'API répondent en JSON, pas par une redirection HTML.
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    const loginUrl = new URL("/auth/login", request.nextUrl.origin);
    loginUrl.searchParams.set("returnTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return authResponse;
}

export const config = {
  matcher: [
    // Tout sauf les fichiers statiques Next.js
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|ico|css|js|woff2?)$).*)",
  ],
};
