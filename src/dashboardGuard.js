import { NextResponse } from "next/server";
import { jwtVerify, SignJWT } from "jose";

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "9router-default-secret-change-me"
);

const AUTHELIA_HEADERS = [
  "x-authelia-user",
  "x-authelia-username",
  "remote-user",
  "x-remote-user",
];

async function generateToken(username) {
  const token = await new SignJWT({ 
    authenticated: true, 
    username: username || "authelia-user" 
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("24h")
    .sign(SECRET);
  return token;
}

async function handleAutheliaAuth(request) {
  const autheliaUser = AUTHELIA_HEADERS
    .map((header) => request.headers.get(header))
    .find((val) => val);

  if (autheliaUser) {
    const token = await generateToken(autheliaUser);
    const response = NextResponse.next();
    response.cookies.set("auth_token", token, {
      httpOnly: true,
      secure: process.env.AUTH_COOKIE_SECURE !== "false",
      sameSite: "lax",
      path: "/",
    });
    return response;
  }
  return null;
}

export async function proxy(request) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/dashboard")) {
    const token = request.cookies.get("auth_token")?.value;

    if (token) {
      try {
        await jwtVerify(token, SECRET);
        return NextResponse.next();
      } catch (err) {
        const autheliaResponse = await handleAutheliaAuth(request);
        if (autheliaResponse) return autheliaResponse;
        return NextResponse.redirect(new URL("/login", request.url));
      }
    }

    const autheliaResponse = await handleAutheliaAuth(request);
    if (autheliaResponse) return autheliaResponse;

    const origin = request.nextUrl.origin;
    try {
      const res = await fetch(`${origin}/api/settings/require-login`);
      const data = await res.json();
      if (data.requireLogin === false) {
        return NextResponse.next();
      }
    } catch (err) {
      // On error, require login
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Redirect / to /dashboard if logged in, or /dashboard if it's the root
  if (pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/dashboard/:path*"],
};
