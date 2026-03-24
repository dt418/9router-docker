import { NextResponse } from "next/server";
import { jwtVerify } from "jose";

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "9router-default-secret-change-me"
);

export async function GET(request) {
  const token = request.cookies.get("auth_token")?.value;

  if (!token) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  try {
    await jwtVerify(token, SECRET);
    return NextResponse.json({ authenticated: true });
  } catch (err) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
}
