const TOKEN_KEY = "moments.device.token";
const NAME_KEY = "moments.guest.name";
const QUEUE_KEY = "moments.pending.caption";

function randomToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function getDeviceToken(): string {
  if (typeof window === "undefined") return "";
  let token = window.localStorage.getItem(TOKEN_KEY);
  if (!token || token.length < 20) {
    token = randomToken();
    window.localStorage.setItem(TOKEN_KEY, token);
    document.cookie = `moments_token=${token}; path=/; max-age=31536000; SameSite=Lax`;
  }
  return token;
}

export function resetDeviceToken() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(NAME_KEY);
  getDeviceToken();
}

export function cacheGuestName(name: string) {
  if (typeof window !== "undefined") window.localStorage.setItem(NAME_KEY, name);
}

export function cachedGuestName(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(NAME_KEY);
}

export function saveDraftCaption(text: string) {
  if (typeof window !== "undefined") window.localStorage.setItem(QUEUE_KEY, text);
}

export function readDraftCaption(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(QUEUE_KEY) ?? "";
}

export function clearDraftCaption() {
  if (typeof window !== "undefined") window.localStorage.removeItem(QUEUE_KEY);
}

const STORY_VIEWED_KEY = "moments.stories.viewed";
const STORY_MUTE_KEY = "moments.stories.muted";

export function readLocalStoryViews(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORY_VIEWED_KEY) ?? "[]") as unknown;
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function markLocalStoryViewed(storyId: string) {
  if (typeof window === "undefined") return;
  const next = [...new Set([...readLocalStoryViews(), storyId])];
  window.localStorage.setItem(STORY_VIEWED_KEY, JSON.stringify(next));
}

export function getStoryMutePref(): boolean {
  if (typeof window === "undefined") return true;
  const value = window.sessionStorage.getItem(STORY_MUTE_KEY);
  if (value === "0") return false;
  return true;
}

export function setStoryMutePref(muted: boolean) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(STORY_MUTE_KEY, muted ? "1" : "0");
}
