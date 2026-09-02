import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth/config";

const { auth } = NextAuth(authConfig);

const PUBLIC_ADMIN_PATHS = [
  "/admin/login",
  "/admin/connexion",
  "/admin/mot-de-passe-oublie",
  "/admin/reinitialiser",
];

export default auth((request) => {
  const { pathname, search } = request.nextUrl;
  const isPublic = PUBLIC_ADMIN_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
  const isLoggedIn = Boolean(request.auth?.user?.id);

  if (!isLoggedIn && !isPublic) {
    const loginUrl = new URL("/admin/login", request.nextUrl);
    loginUrl.searchParams.set("callbackUrl", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }
  if (isLoggedIn && pathname === "/admin/login") {
    return NextResponse.redirect(new URL("/admin", request.nextUrl));
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/admin/:path*"],
};
