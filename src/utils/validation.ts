import { auth } from '../firebase';

export const ID_PATTERN = /^[a-zA-Z0-9_\-]+$/;

export const LIMITS = {
  id: 128,
  displayName: 120,
  email: 200,
  photoURL: 500,
  role: 80,
  company: 120,
  projectName: 120,
  tagline: 120,
  websiteUrl: 300,
  category: 80,
  targetAudience: 500,
  mainProblem: 1000,
  usp: 800,
  projectDescription: 2500,
  versionName: 80,
  draftDescription: 3000,
  makerComment: 4000,
  demoVideoScript: 5000,
  launchAnnouncement: 3000,
  draftTitle: 120,
  summary: 2000,
  disclaimer: 600,
  chatContent: 8000,
  researchQuery: 200,
  researchSummary: 3000,
  activityTitle: 160,
  activityDetail: 400,
  username: 120,
  profileUrl: 500,
  lastConnectedAt: 80,
  launchDate: 20,
  liveUrl: 500,
  scheduleNotes: 600,
  slugOrKey: 160,
  intelTitle: 160,
  intelSubtitle: 300,
  periodKey: 30,
  intelNotes: 600,
  maxKeyFeatures: 10,
  maxTaglines: 10,
  maxTopics: 10,
  maxGalleryIdeas: 10,
  maxReportArray: 12,
  maxCompletedLessons: 60,
  maxCompletedChecklist: 80,
  maxCompetitors: 10,
} as const;

export function generateSafeId(prefix = 'id'): string {
  const cleanPrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 16) || 'id';
  const rand =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
      : Math.random().toString(36).slice(2, 14);
  return `${cleanPrefix}_${Date.now().toString(36)}_${rand}`;
}

export function clampString(value: string | undefined | null, maxLen: number): string {
  if (!value) return '';
  return value.trim().slice(0, maxLen);
}

export function clampStringArray(items: string[], maxItems: number, maxItemLen = 240): string[] {
  return items
    .map((item) => item.trim().slice(0, maxItemLen))
    .filter(Boolean)
    .slice(0, maxItems);
}

export function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function isValidHttpUrl(raw: string): boolean {
  if (!raw.trim()) return true;
  try {
    const parsed = new URL(raw.trim());
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function formatTimestamp(ts: unknown): string {
  if (!ts) return 'Just now';
  try {
    if (typeof ts === 'object' && ts !== null && 'toDate' in ts && typeof (ts as { toDate: () => Date }).toDate === 'function') {
      return (ts as { toDate: () => Date }).toDate().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    }
    if (typeof ts === 'string' || typeof ts === 'number') {
      return new Date(ts).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    }
  } catch {
    return 'Recently';
  }
  return 'Recently';
}

export async function authorizedFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Please sign in to continue.');
  }
  const token = await user.getIdToken();
  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${token}`);
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  const data = (await res.json().catch(() => ({}))) as { error?: string } & T;
  if (!res.ok) {
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }
  return data;
}
