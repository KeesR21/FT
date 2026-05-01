import fs from "fs";
import path from "path";

/** Minimal cookie API (Next.js `cookies()`). */
type CookieStore = { get(name: string): { value: string } | undefined };

const DATA_DIR = path.join(process.cwd(), "data");
const ENGAGEMENT_FILE = path.join(DATA_DIR, "news-engagement.json");

type PostEngagement = {
  views: number;
  likes: number;
  /** Anonymous browser IDs allowed one like each (toggle unlike removes). */
  likedBy: string[];
};

type EngagementFile = Record<string, PostEngagement>;

const MAX_LIKED_BY = 8000;

function safePostKey(postId: string): string {
  return postId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 120);
}

/** Cookie name for “counted this article view” (24h+ TTL set by route). */
export function viewCookieName(postId: string): string {
  return `news_v_${safePostKey(postId)}`;
}

function readFile(): EngagementFile {
  try {
    if (!fs.existsSync(ENGAGEMENT_FILE)) return {};
    const raw = fs.readFileSync(ENGAGEMENT_FILE, "utf8");
    const parsed = JSON.parse(raw) as EngagementFile;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeFile(data: EngagementFile): void {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(ENGAGEMENT_FILE, JSON.stringify(data, null, 2), "utf8");
  } catch {
    /* e.g. read-only deploy */
  }
}

function ensureEntry(data: EngagementFile, postId: string): PostEngagement {
  if (!data[postId]) {
    data[postId] = { views: 0, likes: 0, likedBy: [] };
  }
  return data[postId];
}

export function getEngagementSnapshot(
  postId: string,
  clientId?: string | null
): { views: number; likes: number; liked: boolean } {
  const data = readFile();
  const e = data[postId];
  const views = e?.views ?? 0;
  const likes = e?.likes ?? 0;
  const liked = Boolean(clientId && e?.likedBy?.includes(clientId));
  return { views, likes, liked };
}

/**
 * Increment view once per cookie window; return latest counts + whether user liked (if clientId).
 */
export function trackViewAndGetSnapshot(
  postId: string,
  cookieStore: CookieStore,
  clientId: string | null
): { views: number; likes: number; liked: boolean; setViewCookie: boolean } {
  const data = readFile();
  const cookieName = viewCookieName(postId);
  const already = cookieStore.get(cookieName)?.value === "1";

  const entry = ensureEntry(data, postId);
  if (!already) {
    entry.views += 1;
    writeFile(data);
  }

  const fresh = readFile();
  const e = ensureEntry({ ...fresh }, postId);
  const liked = Boolean(clientId && e.likedBy.includes(clientId));
  return {
    views: e.views,
    likes: e.likes,
    liked,
    setViewCookie: !already
  };
}

export function toggleLike(
  postId: string,
  clientId: string,
  like: boolean
): { views: number; likes: number; liked: boolean } {
  if (!clientId.trim()) {
    return { ...getEngagementSnapshot(postId, null), liked: false };
  }

  const data = readFile();
  const entry = ensureEntry(data, postId);
  let likedBy = [...(entry.likedBy ?? [])];
  const has = likedBy.includes(clientId);

  if (like && !has) {
    if (likedBy.length >= MAX_LIKED_BY) {
      likedBy = likedBy.slice(-MAX_LIKED_BY + 1);
    }
    likedBy.push(clientId);
    entry.likes = Math.max(0, entry.likes + 1);
    entry.likedBy = likedBy;
  } else if (!like && has) {
    entry.likedBy = likedBy.filter((id) => id !== clientId);
    entry.likes = Math.max(0, entry.likes - 1);
  }

  writeFile(data);
  const e = readFile()[postId];
  return {
    views: e?.views ?? 0,
    likes: e?.likes ?? 0,
    liked: Boolean(e?.likedBy?.includes(clientId))
  };
}
