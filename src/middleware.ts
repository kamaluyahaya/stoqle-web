import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Specify the routes that require authentication
const protectedRoutes = [
  "/profile",
  "/settings",
  "/order",
  "/cart",
  "/messages"
];

export function middleware(request: NextRequest) {
  const token = request.cookies.get("token")?.value;
  const { pathname } = request.nextUrl;

  // Check if the current route is in the protected list
  const isProtected = protectedRoutes.some((route) => 
    pathname === route || pathname.startsWith(`${route}/`)
  );

  if (isProtected && !token) {
    // If trying to access a protected route without a token, redirect to home
    // The Shell component handles showing the login modal if needed
    const url = new URL("/", request.url);
    // Optional: Pass a query parameter to automatically trigger the login modal on the home page
    url.searchParams.set("auth", "required");
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

// Ensure the middleware runs on the correct paths
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - assets (public assets)
     */
    "/((?!api|_next/static|_next/image|assets|favicon.ico).*)",
  ],
};
