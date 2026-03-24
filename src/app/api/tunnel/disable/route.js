import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/serverAuth";
import { disableTunnel } from "@/lib/tunnel/tunnelManager";

export async function POST(request) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await disableTunnel();
    return NextResponse.json(result);
  } catch (error) {
    console.error("Tunnel disable error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
