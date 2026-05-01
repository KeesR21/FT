import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  getEngagementSnapshot,
  trackViewAndGetSnapshot,
  toggleLike,
  viewCookieName
} from "@/lib/news-engagement-store";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const postId = decodeURIComponent(id);
  const clientId = req.nextUrl.searchParams.get("clientId");
  return NextResponse.json(getEngagementSnapshot(postId, clientId));
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const postId = decodeURIComponent(id);
  const body = (await req.json()) as {
    kind?: string;
    clientId?: string;
    like?: boolean;
  };

  if (body.kind === "track") {
    const cookieStore = await cookies();
    const snapshot = trackViewAndGetSnapshot(
      postId,
      cookieStore,
      body.clientId?.trim() ?? null
    );
    const res = NextResponse.json({
      views: snapshot.views,
      likes: snapshot.likes,
      liked: snapshot.liked
    });
    if (snapshot.setViewCookie) {
      res.cookies.set(viewCookieName(postId), "1", {
        maxAge: 60 * 60 * 24 * 400,
        path: "/",
        sameSite: "lax"
      });
    }
    return res;
  }

  if (body.kind === "like") {
    const clientId = body.clientId?.trim() ?? "";
    if (!clientId) {
      return NextResponse.json({ error: "Missing clientId" }, { status: 400 });
    }
    const like = body.like === true;
    const result = toggleLike(postId, clientId, like);
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: "Invalid body" }, { status: 400 });
}
