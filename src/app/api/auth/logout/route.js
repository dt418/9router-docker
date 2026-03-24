import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(request) {
  const cookieStore = await cookies();
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const isHttpsRequest = forwardedProto === "https";
  const forceSecureCookie = process.env.AUTH_COOKIE_SECURE === "true";
  const useSecureCookie = forceSecureCookie || isHttpsRequest;

  cookieStore.delete("auth_token");
  cookieStore.set("auth_token", "", {
    httpOnly: true,
    secure: useSecureCookie,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return NextResponse.json({ success: true });
}
