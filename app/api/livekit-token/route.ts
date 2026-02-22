import { AccessToken, AgentDispatchClient } from "livekit-server-sdk";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/Actions/auth.actions";

export async function GET() {
  const apiKey = process.env.LIVEKIT_API_KEY!;
  const apiSecret = process.env.LIVEKIT_API_SECRET!;
  const livekitUrl = process.env.LIVEKIT_URL!;
  const agentName = process.env.LIVEKIT_AGENT_NAME!;

  if (!apiKey || !apiSecret || !livekitUrl || !agentName) {
    return NextResponse.json(
      { error: "Missing environment variables" },
      { status: 500 }
    );
  }

  const user = await getCurrentUser();
  const roomName = "interview-room-" + Math.random().toString(36).substring(2, 9);
  const identity = "user-" + Math.random().toString(36).substring(2, 9);

  const at = new AccessToken(apiKey, apiSecret, { identity });
  if (user?.sayableId) {
    at.metadata = JSON.stringify({ sayableId: user.sayableId, userId: user.id });
  }
  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
  });
  const token = await at.toJwt();

  // 2. Dispatch agent to the same room (uses LiveKit server API, not cloud REST)
  try {
    // AgentDispatchClient needs HTTP/HTTPS URL (for API calls)
    let apiUrl = livekitUrl
    if (apiUrl.startsWith("wss://")) {
      apiUrl = apiUrl.replace("wss://", "https://")
    } else if (apiUrl.startsWith("ws://")) {
      apiUrl = apiUrl.replace("ws://", "http://")
    } else if (!apiUrl.startsWith("http://") && !apiUrl.startsWith("https://")) {
      // If no protocol, assume https:// for API
      apiUrl = `https://${apiUrl}`
    }

    const agentDispatch = new AgentDispatchClient(apiUrl, apiKey, apiSecret);
    await agentDispatch.createDispatch(roomName, agentName);
  } catch (err) {
    console.error("Agent dispatch failed:", err);
    return NextResponse.json(
      { error: "Failed to dispatch agent to room", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }

  // Return WebSocket URL for client connection
  // Convert to wss:// if needed
  let wsUrl = livekitUrl
  if (wsUrl.startsWith("https://")) {
    wsUrl = wsUrl.replace("https://", "wss://")
  } else if (wsUrl.startsWith("http://")) {
    wsUrl = wsUrl.replace("http://", "ws://")
  } else if (!wsUrl.startsWith("wss://") && !wsUrl.startsWith("ws://")) {
    // If no protocol, assume wss:// for WebSocket
    wsUrl = `wss://${wsUrl}`
  }

  return NextResponse.json({
    token,
    url: wsUrl,
    room: roomName,
  });
}
