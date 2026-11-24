export type ExperienceLevel = 'beginner' | 'experienced';
export type PlanTier = 'free';
export type ProjectStage = 'idea' | 'drafting' | 'ready' | 'launched';

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  role?: string;
  company?: string;
  experienceLevel: ExperienceLevel;
  planTier: PlanTier;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface Project {
  id: string;
  ownerId: string;
  name: string;
  tagline?: string;
  websiteUrl?: string;
  category: string;
  targetAudience?: string;
  mainProblem?: string;
  keyFeatures?: string[];
  usp?: string;
  description?: string;
  stage: ProjectStage;
  latestScore?: number;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface LaunchDraft {
  id: string;
  ownerId: string;
  projectId: string;
  versionName: string;
  productName: string;
  taglines: string[];
  selectedTagline: string;
  description: string;
  makerComment: string;
  topics: string[];
  galleryIdeas: string[];
  demoVideoScript: string;
  launchAnnouncement: string;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface CategoryScores {
  taglineClarity: number;
  descriptionQuality: number;
  positioning: number;
  uspStrength: number;
  audienceClarity: number;
  visualAssets: number;
  competitorDiff: number;
  launchPrep: number;
}

export interface AnalysisReport {
  id: string;
  ownerId: string;
  projectId: string;
  draftTitle: string;
  overallScore: number;
  categoryScores: CategoryScores;
  strengths: string[];
  weaknesses: string[];
  missingInfo: string[];
  suggestions: string[];
  nextSteps: string[];
  summary: string;
  disclaimer: string;
  createdAt: unknown;
}

export interface AcademyProgress {
  ownerId: string;
  completedLessons: string[];
  completedChecklistItems: string[];
  updatedAt: unknown;
}

export interface ChatMessage {
  id: string;
  ownerId: string;
  projectId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: unknown;
}

export interface CompetitorEntry {
  name: string;
  positioning: string;
  strength: string;
  gapToExploit: string;
  sourceNote: string;
}

export interface CompetitorResearch {
  id: string;
  ownerId: string;
  projectId: string;
  query: string;
  category: string;
  dataSource: 'mcp' | 'ai_framework';
  summary: string;
  differentiationAngles: string[];
  competitors: CompetitorEntry[];
  createdAt: unknown;
}

export type ActivityType =
  | 'project'
  | 'draft'
  | 'analysis'
  | 'academy'
  | 'research'
  | 'assistant'
  | 'launch'
  | 'intelligence';

export interface Activity {
  id: string;
  ownerId: string;
  type: ActivityType;
  title: string;
  detail?: string;
  projectId?: string;
  createdAt: unknown;
}

export interface PhConnectionRecord {
  ownerId: string;
  accountConnected: boolean;
  username?: string;
  name?: string;
  profileUrl?: string;
  lastConnectedAt?: string;
  updatedAt: unknown;
}

export type LaunchScheduleStatus = 'draft' | 'scheduled' | 'live' | 'unscheduled';

export interface LaunchScheduleRecord {
  id: string;
  ownerId: string;
  projectId: string;
  phLaunchId?: string;
  productName: string;
  launchDate?: string;
  status: LaunchScheduleStatus;
  liveUrl?: string;
  notes?: string;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface SavedIntelligenceItem {
  id: string;
  ownerId: string;
  kind: 'product' | 'hunter' | 'snapshot';
  slugOrKey: string;
  title: string;
  subtitle?: string;
  periodKey?: string;
  notes?: string;
  url?: string;
  createdAt: unknown;
}

export interface IntelligenceMakerEntry {
  name: string;
  username?: string;
  url?: string;
  headline?: string;
}

export interface EnrichedLeaderboardEntry {
  slug: string;
  name: string;
  tagline: string;
  url: string | null;
  websiteUrl: string | null;
  thumbnailUrl: string | null;
  categories: string[];
  categorySlugs: string[];
  pricing: string | null;
  openSource: boolean;
  yc: boolean;
  hasMcpServer: boolean;
  points: number | null;
  rank: number | null;
  scoresHiddenUntil: string | null;
  reviewsCount: number | null;
  rating: number | null;
  commentsCount: number | null;
  launchedAt: string | null;
  makers: IntelligenceMakerEntry[];
  hunters: IntelligenceMakerEntry[];
  pointsDelta: number | null;
  pointsPerHour: number | null;
  velocitySource: 'snapshot_delta' | 'since_launch' | 'hidden';
  rankDelta: number | null;
  reviewsDelta: number | null;
  pulseScore: number | null;
  snapshotCountForProduct: number;
  pointsHidden: boolean;
}

export interface HunterLeaderboardRow {
  key: string;
  name: string;
  username: string | null;
  profileUrl: string | null;
  roleLabel: 'Hunter' | 'Maker';
  launchesCount: number;
  totalVisiblePoints: number | null;
  avgVisiblePoints: number | null;
  bestRank: number | null;
  totalReviews: number;
  topCategories: string[];
  products: Array<{
    slug: string;
    name: string;
    tagline: string;
    points: number | null;
    rank: number | null;
    url: string | null;
    launchedAt: string | null;
  }>;
}

export interface LeaderboardIntelligenceResponse {
  periodKey: string;
  todayPacific: string;
  yesterdayPacific: string;
  lastUpdatedAt: string | null;
  nextSnapshotInSeconds: number;
  collectionIntervalMinutes: number;
  snapshotCount: number;
  historyTimestamps: string[];
  scoresHiddenUntil: string | null;
  pointsHidden: boolean;
  summaryText: string;
  sourceStatus: 'ok' | 'error';
  sourceError: string | null;
  availableCategories: string[];
  availablePeriods: string[];
  entries: EnrichedLeaderboardEntry[];
  hunterLeaderboard: HunterLeaderboardRow[];
}

export interface HistoricalSnapshotsResponse {
  periodKey: string;
  snapshotCount: number;
  timeline: Array<{
    capturedAt: string;
    productCount: number;
    totalPoints: number | null;
    avgPoints: number | null;
    totalReviews: number;
    productPoints: number | null;
    productRank: number | null;
    productReviews: number | null;
  }>;
  periodSummaries: Array<{
    periodKey: string;
    snapshotCount: number;
    lastCapturedAt: string;
    productsCount: number;
    topProductName: string | null;
    topProductPoints: number | null;
    totalVisiblePoints: number | null;
  }>;
  availableProducts: Array<{ slug: string; name: string }>;
}

export interface ProductPerformanceResponse {
  query: string;
  profile: Record<string, unknown> | null;
  summaryText: string;
  alternatives: Record<string, unknown> | null;
  snapshotHistory: Array<{
    periodKey: string;
    capturedAt: string;
    points: number | null;
    rank: number | null;
    reviewsCount: number | null;
  }>;
}

export interface HunterAnalyticsResponse {
  query: string;
  name: string;
  username: string | null;
  profileUrl: string | null;
  headline: string | null;
  totalObservedLaunches: number;
  totalVisiblePoints: number | null;
  avgVisiblePoints: number | null;
  bestRank: number | null;
  topCategories: Array<{ name: string; count: number }>;
  launches: Array<EnrichedLeaderboardEntry & { periodKey: string; role: 'Hunter' | 'Maker' }>;
}

export type WorkspaceTab =
  | 'dashboard'
  | 'academy'
  | 'generator'
  | 'analyzer'
  | 'assistant'
  | 'research'
  | 'intelligence'
  | 'profile';
