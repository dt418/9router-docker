import { jwtVerify } from "jose";

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "9router-default-secret-change-me"
);

export async function verifyAuth(request) {
  const token = request.cookies.get("auth_token")?.value;
  if (!token) return null;

  try {
    await jwtVerify(token, SECRET);
    return { authenticated: true };
  } catch {
    return null;
  }
}