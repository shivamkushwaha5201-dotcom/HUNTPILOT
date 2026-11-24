import { useCallback, useEffect, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  AcademyProgress,
  Activity,
  ActivityType,
  AnalysisReport,
  CategoryScores,
  ChatMessage,
  CompetitorEntry,
  CompetitorResearch,
  LaunchDraft,
  LaunchScheduleRecord,
  LaunchScheduleStatus,
  PhConnectionRecord,
  Project,
  ProjectStage,
  SavedIntelligenceItem,
} from '../types';
import {
  clampScore,
  clampString,
  clampStringArray,
  generateSafeId,
  LIMITS,
} from '../utils/validation';

function sortByCreatedDesc<T extends { createdAt?: unknown }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const getMs = (val: unknown) => {
      if (val && typeof val === 'object' && 'toMillis' in val && typeof (val as { toMillis: () => number }).toMillis === 'function') {
        return (val as { toMillis: () => number }).toMillis();
      }
      if (typeof val === 'string' || typeof val === 'number') {
        return new Date(val).getTime();
      }
      return Date.now();
    };
    return getMs(b.createdAt) - getMs(a.createdAt);
  });
}

function sortByCreatedAsc<T extends { createdAt?: unknown }>(items: T[]): T[] {
  return sortByCreatedDesc(items).reverse();
}

export function useWorkspaceData(userId: string | undefined, emailVerified: boolean | undefined) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [drafts, setDrafts] = useState<LaunchDraft[]>([]);
  const [reports, setReports] = useState<AnalysisReport[]>([]);
  const [academyProgress, setAcademyProgress] = useState<AcademyProgress | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [researchReports, setResearchReports] = useState<CompetitorResearch[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [phConnection, setPhConnection] = useState<PhConnectionRecord | null>(null);
  const [launchSchedules, setLaunchSchedules] = useState<LaunchScheduleRecord[]>([]);
  const [savedIntelligence, setSavedIntelligence] = useState<SavedIntelligenceItem[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!userId || !emailVerified) {
      setProjects([]);
      setDrafts([]);
      setReports([]);
      setAcademyProgress(null);
      setChatMessages([]);
      setResearchReports([]);
      setActivities([]);
      setPhConnection(null);
      setLaunchSchedules([]);
      setSavedIntelligence([]);
      setDataLoading(false);
      return;
    }

    setDataLoading(true);
    let settledCount = 0;
    const markSettled = () => {
      settledCount += 1;
      if (settledCount >= 6) {
        setDataLoading(false);
      }
    };

    const unsubProjects = onSnapshot(
      query(collection(db, 'projects'), where('ownerId', '==', userId)),
      (snap) => {
        setProjects(sortByCreatedDesc(snap.docs.map((d) => d.data() as Project)));
        markSettled();
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'projects')
    );

    const unsubDrafts = onSnapshot(
      query(collection(db, 'launchDrafts'), where('ownerId', '==', userId)),
      (snap) => {
        setDrafts(sortByCreatedDesc(snap.docs.map((d) => d.data() as LaunchDraft)));
        markSettled();
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'launchDrafts')
    );

    const unsubReports = onSnapshot(
      query(collection(db, 'analysisReports'), where('ownerId', '==', userId)),
      (snap) => {
        setReports(sortByCreatedDesc(snap.docs.map((d) => d.data() as AnalysisReport)));
        markSettled();
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'analysisReports')
    );

    const unsubAcademy = onSnapshot(
      doc(db, 'academyProgress', userId),
      (snap) => {
        if (snap.exists()) {
          setAcademyProgress(snap.data() as AcademyProgress);
        } else {
          setAcademyProgress({
            ownerId: userId,
            completedLessons: [],
            completedChecklistItems: [],
            updatedAt: null,
          });
        }
        markSettled();
      },
      (err) => handleFirestoreError(err, OperationType.GET, `academyProgress/${userId}`)
    );

    const unsubChats = onSnapshot(
      query(collection(db, 'chatMessages'), where('ownerId', '==', userId)),
      (snap) => {
        setChatMessages(sortByCreatedAsc(snap.docs.map((d) => d.data() as ChatMessage)));
        markSettled();
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'chatMessages')
    );

    const unsubResearch = onSnapshot(
      query(collection(db, 'competitorResearch'), where('ownerId', '==', userId)),
      (snap) => {
        setResearchReports(sortByCreatedDesc(snap.docs.map((d) => d.data() as CompetitorResearch)));
        markSettled();
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'competitorResearch')
    );

    const unsubActivities = onSnapshot(
      query(collection(db, 'activities'), where('ownerId', '==', userId)),
      (snap) => {
        setActivities(sortByCreatedDesc(snap.docs.map((d) => d.data() as Activity)).slice(0, 20));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'activities')
    );

    const unsubPhConnection = onSnapshot(
      doc(db, 'phConnections', userId),
      (snap) => {
        if (snap.exists()) {
          setPhConnection(snap.data() as PhConnectionRecord);
        } else {
          setPhConnection(null);
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, `phConnections/${userId}`)
    );

    const unsubSchedules = onSnapshot(
      query(collection(db, 'launchSchedules'), where('ownerId', '==', userId)),
      (snap) => {
        setLaunchSchedules(
          sortByCreatedDesc(snap.docs.map((d) => d.data() as LaunchScheduleRecord))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'launchSchedules')
    );

    const unsubSavedIntel = onSnapshot(
      query(collection(db, 'savedIntelligence'), where('ownerId', '==', userId)),
      (snap) => {
        setSavedIntelligence(
          sortByCreatedDesc(snap.docs.map((d) => d.data() as SavedIntelligenceItem))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'savedIntelligence')
    );

    return () => {
      unsubProjects();
      unsubDrafts();
      unsubReports();
      unsubAcademy();
      unsubChats();
      unsubResearch();
      unsubActivities();
      unsubPhConnection();
      unsubSchedules();
      unsubSavedIntel();
    };
  }, [userId, emailVerified]);

  const logActivity = useCallback(
    async (type: ActivityType, title: string, detail?: string, projectId?: string) => {
      if (!userId || !emailVerified) return;
      const id = generateSafeId('act');
      const payload: Record<string, unknown> = {
        id,
        ownerId: userId,
        type,
        title: clampString(title, LIMITS.activityTitle) || 'Workspace action',
        createdAt: serverTimestamp(),
      };
      if (detail) payload.detail = clampString(detail, LIMITS.activityDetail);
      if (projectId) payload.projectId = clampString(projectId, LIMITS.id);
      try {
        await setDoc(doc(db, 'activities', id), payload);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `activities/${id}`);
      }
    },
    [userId, emailVerified]
  );

  const createProject = useCallback(
    async (input: {
      name: string;
      tagline?: string;
      websiteUrl?: string;
      category: string;
      targetAudience?: string;
      mainProblem?: string;
      keyFeatures?: string[];
      usp?: string;
      description?: string;
      stage?: ProjectStage;
    }): Promise<Project> => {
      if (!userId || !emailVerified) throw new Error('Verified user required.');
      const id = generateSafeId('proj');
      const payload: Record<string, unknown> = {
        id,
        ownerId: userId,
        name: clampString(input.name, LIMITS.projectName) || 'Untitled Launch',
        category: clampString(input.category, LIMITS.category) || 'SaaS',
        stage: input.stage || 'idea',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (input.tagline) payload.tagline = clampString(input.tagline, LIMITS.tagline);
      if (input.websiteUrl) payload.websiteUrl = clampString(input.websiteUrl, LIMITS.websiteUrl);
      if (input.targetAudience) payload.targetAudience = clampString(input.targetAudience, LIMITS.targetAudience);
      if (input.mainProblem) payload.mainProblem = clampString(input.mainProblem, LIMITS.mainProblem);
      if (input.keyFeatures && input.keyFeatures.length > 0) {
        payload.keyFeatures = clampStringArray(input.keyFeatures, LIMITS.maxKeyFeatures, 200);
      }
      if (input.usp) payload.usp = clampString(input.usp, LIMITS.usp);
      if (input.description) payload.description = clampString(input.description, LIMITS.projectDescription);

      try {
        await setDoc(doc(db, 'projects', id), payload);
        await logActivity('project', `Created project "${payload.name}"`, `Category: ${payload.category}`, id);
        return payload as unknown as Project;
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `projects/${id}`);
      }
    },
    [userId, emailVerified, logActivity]
  );

  const updateProject = useCallback(
    async (
      projectId: string,
      updates: Partial<{
        name: string;
        tagline: string;
        websiteUrl: string;
        category: string;
        targetAudience: string;
        mainProblem: string;
        keyFeatures: string[];
        usp: string;
        description: string;
        stage: ProjectStage;
      }>
    ) => {
      if (!userId || !emailVerified) throw new Error('Verified user required.');
      const payload: Record<string, unknown> = { updatedAt: serverTimestamp() };
      if (updates.name !== undefined) payload.name = clampString(updates.name, LIMITS.projectName) || 'Untitled Launch';
      if (updates.tagline !== undefined) payload.tagline = clampString(updates.tagline, LIMITS.tagline);
      if (updates.websiteUrl !== undefined) payload.websiteUrl = clampString(updates.websiteUrl, LIMITS.websiteUrl);
      if (updates.category !== undefined) payload.category = clampString(updates.category, LIMITS.category) || 'SaaS';
      if (updates.targetAudience !== undefined) payload.targetAudience = clampString(updates.targetAudience, LIMITS.targetAudience);
      if (updates.mainProblem !== undefined) payload.mainProblem = clampString(updates.mainProblem, LIMITS.mainProblem);
      if (updates.keyFeatures !== undefined) payload.keyFeatures = clampStringArray(updates.keyFeatures, LIMITS.maxKeyFeatures, 200);
      if (updates.usp !== undefined) payload.usp = clampString(updates.usp, LIMITS.usp);
      if (updates.description !== undefined) payload.description = clampString(updates.description, LIMITS.projectDescription);
      if (updates.stage !== undefined) payload.stage = updates.stage;

      try {
        await updateDoc(doc(db, 'projects', projectId), payload);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `projects/${projectId}`);
      }
    },
    [userId, emailVerified]
  );

  const deleteProject = useCallback(
    async (projectId: string) => {
      if (!userId || !emailVerified) throw new Error('Verified user required.');
      try {
        await deleteDoc(doc(db, 'projects', projectId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `projects/${projectId}`);
      }
    },
    [userId, emailVerified]
  );

  const saveLaunchDraft = useCallback(
    async (input: {
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
    }): Promise<string> => {
      if (!userId || !emailVerified) throw new Error('Verified user required.');
      const id = generateSafeId('draft');
      const payload = {
        id,
        ownerId: userId,
        projectId: input.projectId,
        versionName: clampString(input.versionName, LIMITS.versionName) || 'v1',
        productName: clampString(input.productName, LIMITS.projectName) || 'Untitled',
        taglines: clampStringArray(input.taglines, LIMITS.maxTaglines, 120),
        selectedTagline: clampString(input.selectedTagline, LIMITS.tagline) || 'Product Hunt Launch',
        description: clampString(input.description, LIMITS.draftDescription) || 'Product description',
        makerComment: clampString(input.makerComment, LIMITS.makerComment) || 'Hello Product Hunt!',
        topics: clampStringArray(input.topics, LIMITS.maxTopics, 60),
        galleryIdeas: clampStringArray(input.galleryIdeas, LIMITS.maxGalleryIdeas, 400),
        demoVideoScript: clampString(input.demoVideoScript, LIMITS.demoVideoScript),
        launchAnnouncement: clampString(input.launchAnnouncement, LIMITS.launchAnnouncement),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      try {
        await setDoc(doc(db, 'launchDrafts', id), payload);
        await logActivity('draft', `Saved launch draft ${payload.versionName}`, `${payload.productName} — "${payload.selectedTagline}"`, input.projectId);
        return id;
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `launchDrafts/${id}`);
      }
    },
    [userId, emailVerified, logActivity]
  );

  const updateLaunchDraft = useCallback(
    async (
      draftId: string,
      updates: Partial<{
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
      }>
    ) => {
      if (!userId || !emailVerified) throw new Error('Verified user required.');
      const payload: Record<string, unknown> = { updatedAt: serverTimestamp() };
      if (updates.versionName !== undefined) payload.versionName = clampString(updates.versionName, LIMITS.versionName) || 'v1';
      if (updates.productName !== undefined) payload.productName = clampString(updates.productName, LIMITS.projectName) || 'Untitled';
      if (updates.taglines !== undefined) payload.taglines = clampStringArray(updates.taglines, LIMITS.maxTaglines, 120);
      if (updates.selectedTagline !== undefined) payload.selectedTagline = clampString(updates.selectedTagline, LIMITS.tagline) || 'Launch';
      if (updates.description !== undefined) payload.description = clampString(updates.description, LIMITS.draftDescription) || 'Description';
      if (updates.makerComment !== undefined) payload.makerComment = clampString(updates.makerComment, LIMITS.makerComment) || 'Hello Product Hunt!';
      if (updates.topics !== undefined) payload.topics = clampStringArray(updates.topics, LIMITS.maxTopics, 60);
      if (updates.galleryIdeas !== undefined) payload.galleryIdeas = clampStringArray(updates.galleryIdeas, LIMITS.maxGalleryIdeas, 400);
      if (updates.demoVideoScript !== undefined) payload.demoVideoScript = clampString(updates.demoVideoScript, LIMITS.demoVideoScript);
      if (updates.launchAnnouncement !== undefined) payload.launchAnnouncement = clampString(updates.launchAnnouncement, LIMITS.launchAnnouncement);

      try {
        await updateDoc(doc(db, 'launchDrafts', draftId), payload);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `launchDrafts/${draftId}`);
      }
    },
    [userId, emailVerified]
  );

  const deleteLaunchDraft = useCallback(
    async (draftId: string) => {
      if (!userId || !emailVerified) throw new Error('Verified user required.');
      try {
        await deleteDoc(doc(db, 'launchDrafts', draftId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `launchDrafts/${draftId}`);
      }
    },
    [userId, emailVerified]
  );

  const saveAnalysisReport = useCallback(
    async (input: {
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
    }): Promise<string> => {
      if (!userId || !emailVerified) throw new Error('Verified user required.');
      const id = generateSafeId('rep');
      const score = clampScore(input.overallScore);
      const payload = {
        id,
        ownerId: userId,
        projectId: input.projectId,
        draftTitle: clampString(input.draftTitle, LIMITS.draftTitle) || 'Launch Analysis',
        overallScore: score,
        categoryScores: {
          taglineClarity: clampScore(input.categoryScores.taglineClarity),
          descriptionQuality: clampScore(input.categoryScores.descriptionQuality),
          positioning: clampScore(input.categoryScores.positioning),
          uspStrength: clampScore(input.categoryScores.uspStrength),
          audienceClarity: clampScore(input.categoryScores.audienceClarity),
          visualAssets: clampScore(input.categoryScores.visualAssets),
          competitorDiff: clampScore(input.categoryScores.competitorDiff),
          launchPrep: clampScore(input.categoryScores.launchPrep),
        },
        strengths: clampStringArray(input.strengths, LIMITS.maxReportArray, 300),
        weaknesses: clampStringArray(input.weaknesses, LIMITS.maxReportArray, 300),
        missingInfo: clampStringArray(input.missingInfo, LIMITS.maxReportArray, 300),
        suggestions: clampStringArray(input.suggestions, LIMITS.maxReportArray, 350),
        nextSteps: clampStringArray(input.nextSteps, LIMITS.maxReportArray, 300),
        summary: clampString(input.summary, LIMITS.summary) || 'Launch readiness evaluation completed.',
        disclaimer: clampString(input.disclaimer, LIMITS.disclaimer),
        createdAt: serverTimestamp(),
      };

      try {
        await setDoc(doc(db, 'analysisReports', id), payload);
        await updateDoc(doc(db, 'projects', input.projectId), {
          latestScore: score,
          stage: score >= 80 ? 'ready' : 'drafting',
          updatedAt: serverTimestamp(),
        });
        await logActivity('analysis', `Analyzed "${payload.draftTitle}"`, `Estimated Launch Readiness Score: ${score}/100`, input.projectId);
        return id;
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `analysisReports/${id}`);
      }
    },
    [userId, emailVerified, logActivity]
  );

  const deleteAnalysisReport = useCallback(
    async (reportId: string) => {
      if (!userId || !emailVerified) throw new Error('Verified user required.');
      try {
        await deleteDoc(doc(db, 'analysisReports', reportId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `analysisReports/${reportId}`);
      }
    },
    [userId, emailVerified]
  );

  const toggleAcademyLesson = useCallback(
    async (lessonId: string) => {
      if (!userId || !emailVerified) throw new Error('Verified user required.');
      const currentLessons = academyProgress?.completedLessons || [];
      const currentChecklist = academyProgress?.completedChecklistItems || [];
      const exists = currentLessons.includes(lessonId);
      const nextLessons = exists
        ? currentLessons.filter((id) => id !== lessonId)
        : clampStringArray([...currentLessons, lessonId], LIMITS.maxCompletedLessons, 40);

      const ref = doc(db, 'academyProgress', userId);
      const isNew = !academyProgress?.updatedAt;
      try {
        if (isNew) {
          await setDoc(ref, {
            ownerId: userId,
            completedLessons: nextLessons,
            completedChecklistItems: currentChecklist,
            updatedAt: serverTimestamp(),
          });
        } else {
          await updateDoc(ref, {
            completedLessons: nextLessons,
            completedChecklistItems: currentChecklist,
            updatedAt: serverTimestamp(),
          });
        }
        if (!exists) {
          await logActivity('academy', 'Completed Academy lesson', `Lesson ${lessonId}`);
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `academyProgress/${userId}`);
      }
    },
    [userId, emailVerified, academyProgress, logActivity]
  );

  const toggleAcademyChecklist = useCallback(
    async (itemId: string) => {
      if (!userId || !emailVerified) throw new Error('Verified user required.');
      const currentLessons = academyProgress?.completedLessons || [];
      const currentChecklist = academyProgress?.completedChecklistItems || [];
      const exists = currentChecklist.includes(itemId);
      const nextChecklist = exists
        ? currentChecklist.filter((id) => id !== itemId)
        : clampStringArray([...currentChecklist, itemId], LIMITS.maxCompletedChecklist, 40);

      const ref = doc(db, 'academyProgress', userId);
      const isNew = !academyProgress?.updatedAt;
      try {
        if (isNew) {
          await setDoc(ref, {
            ownerId: userId,
            completedLessons: currentLessons,
            completedChecklistItems: nextChecklist,
            updatedAt: serverTimestamp(),
          });
        } else {
          await updateDoc(ref, {
            completedLessons: currentLessons,
            completedChecklistItems: nextChecklist,
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `academyProgress/${userId}`);
      }
    },
    [userId, emailVerified, academyProgress]
  );

  const appendChatTurn = useCallback(
    async (projectId: string, userMessage: string, assistantReply: string) => {
      if (!userId || !emailVerified) throw new Error('Verified user required.');
      const userMsgId = generateSafeId('msg');
      const botMsgId = generateSafeId('msg');
      const safeProjectId = clampString(projectId, LIMITS.id) || 'general';
      const batch = writeBatch(db);

      batch.set(doc(db, 'chatMessages', userMsgId), {
        id: userMsgId,
        ownerId: userId,
        projectId: safeProjectId,
        role: 'user',
        content: clampString(userMessage, LIMITS.chatContent) || 'Question',
        createdAt: serverTimestamp(),
      });
      batch.set(doc(db, 'chatMessages', botMsgId), {
        id: botMsgId,
        ownerId: userId,
        projectId: safeProjectId,
        role: 'assistant',
        content: clampString(assistantReply, LIMITS.chatContent) || 'Response',
        createdAt: serverTimestamp(),
      });

      try {
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'chatMessages');
      }
    },
    [userId, emailVerified]
  );

  const clearChatHistoryForProject = useCallback(
    async (projectId: string) => {
      if (!userId || !emailVerified) throw new Error('Verified user required.');
      const targets = chatMessages.filter((m) => m.projectId === projectId);
      if (targets.length === 0) return;
      const batch = writeBatch(db);
      for (const m of targets) {
        batch.delete(doc(db, 'chatMessages', m.id));
      }
      try {
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, 'chatMessages');
      }
    },
    [userId, emailVerified, chatMessages]
  );

  const saveCompetitorResearch = useCallback(
    async (input: {
      projectId: string;
      query: string;
      category: string;
      dataSource: 'mcp' | 'ai_framework';
      summary: string;
      differentiationAngles: string[];
      competitors: CompetitorEntry[];
    }): Promise<string> => {
      if (!userId || !emailVerified) throw new Error('Verified user required.');
      const id = generateSafeId('res');
      const payload = {
        id,
        ownerId: userId,
        projectId: clampString(input.projectId, LIMITS.id) || 'general',
        query: clampString(input.query, LIMITS.researchQuery) || 'Competitor research',
        category: clampString(input.category, LIMITS.category) || 'SaaS',
        dataSource: input.dataSource,
        summary: clampString(input.summary, LIMITS.researchSummary) || 'Summary',
        differentiationAngles: clampStringArray(input.differentiationAngles, 10, 300),
        competitors: input.competitors.slice(0, LIMITS.maxCompetitors).map((c) => ({
          name: clampString(c.name, 120),
          positioning: clampString(c.positioning, 400),
          strength: clampString(c.strength, 300),
          gapToExploit: clampString(c.gapToExploit, 300),
          sourceNote: clampString(c.sourceNote, 160),
        })),
        createdAt: serverTimestamp(),
      };

      try {
        await setDoc(doc(db, 'competitorResearch', id), payload);
        await logActivity('research', `Saved competitor research: "${payload.query}"`, `Source: ${payload.dataSource === 'mcp' ? 'Product Hunt MCP' : 'Strategy Framework'}`, input.projectId);
        return id;
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `competitorResearch/${id}`);
      }
    },
    [userId, emailVerified, logActivity]
  );

  const deleteCompetitorResearch = useCallback(
    async (researchId: string) => {
      if (!userId || !emailVerified) throw new Error('Verified user required.');
      try {
        await deleteDoc(doc(db, 'competitorResearch', researchId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `competitorResearch/${researchId}`);
      }
    },
    [userId, emailVerified]
  );

  const syncPhConnectionStatus = useCallback(
    async (input: {
      accountConnected: boolean;
      username?: string | null;
      name?: string | null;
      profileUrl?: string | null;
      lastConnectedAt?: string | null;
    }) => {
      if (!userId || !emailVerified) return;
      const payload: Record<string, unknown> = {
        ownerId: userId,
        accountConnected: Boolean(input.accountConnected),
        updatedAt: serverTimestamp(),
      };
      if (input.username) payload.username = clampString(input.username, LIMITS.username);
      if (input.name) payload.name = clampString(input.name, LIMITS.displayName);
      if (input.profileUrl) payload.profileUrl = clampString(input.profileUrl, LIMITS.profileUrl);
      if (input.lastConnectedAt) {
        payload.lastConnectedAt = clampString(input.lastConnectedAt, LIMITS.lastConnectedAt);
      }

      const ref = doc(db, 'phConnections', userId);
      try {
        if (!phConnection?.updatedAt) {
          await setDoc(ref, payload);
        } else {
          await updateDoc(ref, {
            accountConnected: Boolean(input.accountConnected),
            username: input.username ? clampString(input.username, LIMITS.username) : '',
            name: input.name ? clampString(input.name, LIMITS.displayName) : '',
            profileUrl: input.profileUrl ? clampString(input.profileUrl, LIMITS.profileUrl) : '',
            lastConnectedAt: input.lastConnectedAt
              ? clampString(input.lastConnectedAt, LIMITS.lastConnectedAt)
              : '',
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `phConnections/${userId}`);
      }
    },
    [userId, emailVerified, phConnection]
  );

  const createLaunchSchedule = useCallback(
    async (input: {
      projectId: string;
      phLaunchId?: string;
      productName: string;
      launchDate?: string;
      status: LaunchScheduleStatus;
      liveUrl?: string;
      notes?: string;
    }): Promise<string> => {
      if (!userId || !emailVerified) throw new Error('Verified user required.');
      const id = generateSafeId('sched');
      const payload: Record<string, unknown> = {
        id,
        ownerId: userId,
        projectId: clampString(input.projectId, LIMITS.id) || 'general',
        productName: clampString(input.productName, LIMITS.projectName) || 'Untitled Launch',
        status: input.status,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (input.phLaunchId) payload.phLaunchId = clampString(input.phLaunchId, LIMITS.id);
      if (input.launchDate) payload.launchDate = clampString(input.launchDate, LIMITS.launchDate);
      if (input.liveUrl) payload.liveUrl = clampString(input.liveUrl, LIMITS.liveUrl);
      if (input.notes) payload.notes = clampString(input.notes, LIMITS.scheduleNotes);

      try {
        await setDoc(doc(db, 'launchSchedules', id), payload);
        await logActivity(
          'launch',
          `Tracked launch "${payload.productName}"`,
          `Status: ${input.status}${input.launchDate ? ` · Target: ${input.launchDate}` : ''}`,
          String(payload.projectId)
        );
        return id;
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `launchSchedules/${id}`);
      }
    },
    [userId, emailVerified, logActivity]
  );

  const updateLaunchSchedule = useCallback(
    async (
      scheduleId: string,
      updates: Partial<{
        phLaunchId: string;
        productName: string;
        launchDate: string;
        status: LaunchScheduleStatus;
        liveUrl: string;
        notes: string;
      }>
    ) => {
      if (!userId || !emailVerified) throw new Error('Verified user required.');
      const payload: Record<string, unknown> = { updatedAt: serverTimestamp() };
      if (updates.phLaunchId !== undefined) payload.phLaunchId = clampString(updates.phLaunchId, LIMITS.id);
      if (updates.productName !== undefined) {
        payload.productName = clampString(updates.productName, LIMITS.projectName) || 'Untitled Launch';
      }
      if (updates.launchDate !== undefined) payload.launchDate = clampString(updates.launchDate, LIMITS.launchDate);
      if (updates.status !== undefined) payload.status = updates.status;
      if (updates.liveUrl !== undefined) payload.liveUrl = clampString(updates.liveUrl, LIMITS.liveUrl);
      if (updates.notes !== undefined) payload.notes = clampString(updates.notes, LIMITS.scheduleNotes);

      try {
        await updateDoc(doc(db, 'launchSchedules', scheduleId), payload);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `launchSchedules/${scheduleId}`);
      }
    },
    [userId, emailVerified]
  );

  const deleteLaunchSchedule = useCallback(
    async (scheduleId: string) => {
      if (!userId || !emailVerified) throw new Error('Verified user required.');
      try {
        await deleteDoc(doc(db, 'launchSchedules', scheduleId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `launchSchedules/${scheduleId}`);
      }
    },
    [userId, emailVerified]
  );

  const saveIntelligenceItem = useCallback(
    async (input: {
      kind: 'product' | 'hunter' | 'snapshot';
      slugOrKey: string;
      title: string;
      subtitle?: string;
      periodKey?: string;
      notes?: string;
      url?: string;
    }): Promise<string> => {
      if (!userId || !emailVerified) throw new Error('Verified user required.');
      const id = generateSafeId('intel');
      const payload: Record<string, unknown> = {
        id,
        ownerId: userId,
        kind: input.kind,
        slugOrKey: clampString(input.slugOrKey, LIMITS.slugOrKey) || 'item',
        title: clampString(input.title, LIMITS.intelTitle) || 'Saved Item',
        createdAt: serverTimestamp(),
      };
      if (input.subtitle) payload.subtitle = clampString(input.subtitle, LIMITS.intelSubtitle);
      if (input.periodKey) payload.periodKey = clampString(input.periodKey, LIMITS.periodKey);
      if (input.notes) payload.notes = clampString(input.notes, LIMITS.intelNotes);
      if (input.url) payload.url = clampString(input.url, LIMITS.liveUrl);

      try {
        await setDoc(doc(db, 'savedIntelligence', id), payload);
        await logActivity(
          'intelligence',
          `Bookmarked ${input.kind}: "${payload.title}"`,
          input.periodKey ? `Period: ${input.periodKey}` : undefined
        );
        return id;
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `savedIntelligence/${id}`);
      }
    },
    [userId, emailVerified, logActivity]
  );

  const deleteIntelligenceItem = useCallback(
    async (itemId: string) => {
      if (!userId || !emailVerified) throw new Error('Verified user required.');
      try {
        await deleteDoc(doc(db, 'savedIntelligence', itemId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `savedIntelligence/${itemId}`);
      }
    },
    [userId, emailVerified]
  );

  return {
    projects,
    drafts,
    reports,
    academyProgress,
    chatMessages,
    researchReports,
    activities,
    phConnection,
    launchSchedules,
    savedIntelligence,
    dataLoading,
    createProject,
    updateProject,
    deleteProject,
    saveLaunchDraft,
    updateLaunchDraft,
    deleteLaunchDraft,
    saveAnalysisReport,
    deleteAnalysisReport,
    toggleAcademyLesson,
    toggleAcademyChecklist,
    appendChatTurn,
    clearChatHistoryForProject,
    saveCompetitorResearch,
    deleteCompetitorResearch,
    syncPhConnectionStatus,
    createLaunchSchedule,
    updateLaunchSchedule,
    deleteLaunchSchedule,
    saveIntelligenceItem,
    deleteIntelligenceItem,
    logActivity,
  };
}
