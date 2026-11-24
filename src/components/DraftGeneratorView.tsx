import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  Check,
  CheckCircle2,
  Columns2,
  Copy,
  ExternalLink,
  Eye,
  Image as ImageIcon,
  Link2,
  RefreshCw,
  Rocket,
  Save,
  Send,
  ShieldAlert,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import {
  LaunchDraft,
  LaunchScheduleRecord,
  LaunchScheduleStatus,
  Project,
} from '../types';
import { authorizedFetch, formatTimestamp, isValidHttpUrl } from '../utils/validation';
import { UseProductHuntMcpResult } from '../hooks/useProductHuntMcp';

interface DraftGeneratorViewProps {
  projects: Project[];
  activeProjectId: string;
  drafts: LaunchDraft[];
  onSaveDraft: (input: {
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
  }) => Promise<string>;
  onUpdateDraft: (
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
  ) => Promise<void>;
  onDeleteDraft: (draftId: string) => Promise<void>;
  onCreateProjectQuick: (input: {
    name: string;
    category: string;
    websiteUrl?: string;
    targetAudience?: string;
    mainProblem?: string;
    usp?: string;
    description?: string;
  }) => Promise<Project>;
  launchSchedules: LaunchScheduleRecord[];
  onCreateLaunchSchedule: (input: {
    projectId: string;
    phLaunchId?: string;
    productName: string;
    launchDate?: string;
    status: LaunchScheduleStatus;
    liveUrl?: string;
    notes?: string;
  }) => Promise<string>;
  onUpdateLaunchSchedule: (
    scheduleId: string,
    updates: Partial<{
      phLaunchId: string;
      productName: string;
      launchDate: string;
      status: LaunchScheduleStatus;
      liveUrl: string;
      notes: string;
    }>
  ) => Promise<void>;
  onDeleteLaunchSchedule: (scheduleId: string) => Promise<void>;
  mcp: UseProductHuntMcpResult;
}

interface GeneratedPayload {
  taglines: string[];
  description: string;
  makerComment: string;
  topics: string[];
  galleryIdeas: string[];
  demoVideoScript: string;
  launchAnnouncement: string;
}

interface McpLaunchItem {
  id: string;
  name: string;
  status?: string;
  tagline?: string | null;
  launchDate?: string | null;
  url?: string | null;
  missingItems?: string[];
}

interface PendingConfirmationState {
  action: 'start_launch' | 'update_launch' | 'submit_launch';
  title: string;
  summaryLines: string[];
  warnings: string[];
  sideEffects: string[];
  previewText: string;
  launchId?: string;
  expectedRevision?: string;
  changes?: Record<string, unknown>;
  confirmationToken?: string;
  startPayload?: {
    url: string;
    values: Record<string, unknown>;
  };
}

export function DraftGeneratorView({
  projects,
  activeProjectId,
  drafts,
  onSaveDraft,
  onUpdateDraft,
  onDeleteDraft,
  onCreateProjectQuick,
  launchSchedules,
  onCreateLaunchSchedule,
  onUpdateLaunchSchedule,
  onDeleteLaunchSchedule,
  mcp,
}: DraftGeneratorViewProps) {
  const activeProject = projects.find((p) => p.id === activeProjectId) || projects[0] || null;

  // Input form state
  const [selectedProjId, setSelectedProjId] = useState(activeProject?.id || '');
  const [productName, setProductName] = useState(activeProject?.name || '');
  const [websiteUrl, setWebsiteUrl] = useState(activeProject?.websiteUrl || '');
  const [category, setCategory] = useState(activeProject?.category || 'SaaS');
  const [targetAudience, setTargetAudience] = useState(activeProject?.targetAudience || '');
  const [mainProblem, setMainProblem] = useState(activeProject?.mainProblem || '');
  const [keyFeaturesText, setKeyFeaturesText] = useState(
    activeProject?.keyFeatures?.join('\n') || ''
  );
  const [usp, setUsp] = useState(activeProject?.usp || '');
  const [productDescription, setProductDescription] = useState(activeProject?.description || '');

  // Generated editable output
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [versionName, setVersionName] = useState('v1');
  const [taglines, setTaglines] = useState<string[]>([]);
  const [selectedTagline, setSelectedTagline] = useState('');
  const [phDescription, setPhDescription] = useState('');
  const [makerComment, setMakerComment] = useState('');
  const [topicsText, setTopicsText] = useState('');
  const [galleryIdeasText, setGalleryIdeasText] = useState('');
  const [demoVideoScript, setDemoVideoScript] = useState('');
  const [launchAnnouncement, setLaunchAnnouncement] = useState('');

  // UI states
  const [generating, setGenerating] = useState(false);
  const [regenSection, setRegenSection] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Version Comparison
  const [compareMode, setCompareMode] = useState(false);
  const [compareLeftId, setCompareLeftId] = useState('');
  const [compareRightId, setCompareRightId] = useState('');

  // Product Hunt MCP Launch Manager state
  const [showPhManager, setShowPhManager] = useState(false);
  const [phLaunches, setPhLaunches] = useState<McpLaunchItem[]>([]);
  const [phLaunchesLoading, setPhLaunchesLoading] = useState(false);
  const [selectedPhLaunchId, setSelectedPhLaunchId] = useState('');
  const [selectedPhLaunchData, setSelectedPhLaunchData] = useState<Record<string, unknown> | null>(null);
  const [selectedPhLaunchText, setSelectedPhLaunchText] = useState('');
  const [phContextDate, setPhContextDate] = useState('');
  const [phContextResult, setPhContextResult] = useState('');
  const [phContextLoading, setPhContextLoading] = useState(false);
  const [assetUrl, setAssetUrl] = useState('');
  const [assetKind, setAssetKind] = useState<'thumbnail' | 'gallery'>('thumbnail');
  const [assetPreparing, setAssetPreparing] = useState(false);
  const [assetResultText, setAssetResultText] = useState('');
  const [launchDateInput, setLaunchDateInput] = useState('');
  const [phActionLoading, setPhActionLoading] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmationState | null>(null);
  const [selectedPhLaunchMeta, setSelectedPhLaunchMeta] = useState<McpLaunchItem | null>(null);

  // Manual Launch Schedule Tracking form state
  const [schedStatusInput, setSchedStatusInput] = useState<LaunchScheduleStatus>('draft');
  const [schedLiveUrlInput, setSchedLiveUrlInput] = useState('');
  const [schedNotesInput, setSchedNotesInput] = useState('');
  const [savingSchedule, setSavingSchedule] = useState(false);

  useEffect(() => {
    if (activeProject) {
      setSelectedProjId(activeProject.id);
      setProductName(activeProject.name || '');
      setWebsiteUrl(activeProject.websiteUrl || '');
      setCategory(activeProject.category || 'SaaS');
      setTargetAudience(activeProject.targetAudience || '');
      setMainProblem(activeProject.mainProblem || '');
      setKeyFeaturesText(activeProject.keyFeatures?.join('\n') || '');
      setUsp(activeProject.usp || '');
      setProductDescription(activeProject.description || '');
    }
  }, [activeProject?.id]);

  const loadPhLaunches = async () => {
    if (!mcp.mcpStatus?.accountConnected) return;
    setPhLaunchesLoading(true);
    setError(null);
    try {
      const res = await authorizedFetch<{
        data?: Record<string, unknown> | null;
        parsedLaunches?: McpLaunchItem[];
      }>('/api/mcp/launches');
      if (Array.isArray(res.parsedLaunches) && res.parsedLaunches.length > 0) {
        setPhLaunches(res.parsedLaunches);
      } else {
        const arr = Array.isArray(res.data?.launches)
          ? res.data!.launches
          : Array.isArray(res.data?.results)
          ? res.data!.results
          : [];
        const mapped: McpLaunchItem[] = arr
          .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
          .map((item) => ({
            id: String(item.id || item.launch_id || item.uuid || ''),
            name: String(item.name || item.product_name || 'Untitled Launch'),
            status: typeof item.status === 'string' ? item.status : undefined,
            tagline: typeof item.tagline === 'string' ? item.tagline : undefined,
            launchDate: typeof item.launch_date === 'string' ? item.launch_date : undefined,
            url: typeof item.url === 'string' ? item.url : undefined,
          }))
          .filter((l) => Boolean(l.id));
        setPhLaunches(mapped);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to fetch Product Hunt launches.');
    } finally {
      setPhLaunchesLoading(false);
    }
  };

  useEffect(() => {
    if (showPhManager && mcp.mcpStatus?.accountConnected) {
      loadPhLaunches();
    }
  }, [showPhManager, mcp.mcpStatus?.accountConnected]);

  const inspectPhLaunch = async (launchId: string) => {
    setSelectedPhLaunchId(launchId);
    setError(null);
    setPhActionLoading(true);
    try {
      const res = await authorizedFetch<{
        data?: Record<string, unknown> | null;
        summaryText?: string;
        parsedLaunch?: McpLaunchItem | null;
      }>(`/api/mcp/launches/${encodeURIComponent(launchId)}`);
      setSelectedPhLaunchData(res.data || null);
      setSelectedPhLaunchText(res.summaryText || '');
      setSelectedPhLaunchMeta(res.parsedLaunch || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to inspect Product Hunt launch.');
    } finally {
      setPhActionLoading(false);
    }
  };

  const handleLoadPhLaunchIntoEditor = () => {
    if (!selectedPhLaunchData) return;
    const launchObj =
      selectedPhLaunchData.launch && typeof selectedPhLaunchData.launch === 'object'
        ? (selectedPhLaunchData.launch as Record<string, unknown>)
        : selectedPhLaunchData;
    const editable =
      launchObj.editable && typeof launchObj.editable === 'object'
        ? (launchObj.editable as Record<string, unknown>)
        : launchObj;
    if (typeof editable.name === 'string') setProductName(editable.name);
    if (typeof editable.tagline === 'string') {
      setSelectedTagline(editable.tagline);
      setTaglines((prev) => (prev.length ? prev : [editable.tagline as string]));
    }
    if (typeof editable.description === 'string') setPhDescription(editable.description);
    if (typeof editable.url === 'string') setWebsiteUrl(editable.url);
    if (typeof editable.commentBody === 'string') setMakerComment(editable.commentBody);
    if (typeof editable.launchDate === 'string') setLaunchDateInput(editable.launchDate);
    setSaveMessage('Loaded Product Hunt draft fields into editor.');
  };

  const handleCheckLaunchContext = async () => {
    setError(null);
    setPhContextLoading(true);
    try {
      const res = await authorizedFetch<{
        summaryText?: string;
        data?: Record<string, unknown> | null;
      }>('/api/mcp/launches/context', {
        method: 'POST',
        body: JSON.stringify({
          url: websiteUrl.trim() && isValidHttpUrl(websiteUrl) ? websiteUrl.trim() : undefined,
          launch_date: phContextDate.trim() || undefined,
          category: category.trim() || undefined,
        }),
      });
      setPhContextResult(
        res.summaryText || (res.data ? JSON.stringify(res.data, null, 2) : 'Checked.')
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Launch context check failed.');
    } finally {
      setPhContextLoading(false);
    }
  };

  const handlePrepareAsset = async () => {
    if (!selectedPhLaunchId) {
      setError('Select a Product Hunt draft first to prepare media assets.');
      return;
    }
    if (!assetUrl.trim() || !isValidHttpUrl(assetUrl)) {
      setError('Enter a valid public https:// image URL.');
      return;
    }
    setError(null);
    setAssetPreparing(true);
    try {
      const res = await authorizedFetch<{
        summaryText?: string;
        data?: Record<string, unknown> | null;
      }>(`/api/mcp/launches/${encodeURIComponent(selectedPhLaunchId)}/prepare-asset`, {
        method: 'POST',
        body: JSON.stringify({
          kind: assetKind,
          source_url: assetUrl.trim(),
        }),
      });
      setAssetResultText(
        res.summaryText || (res.data ? JSON.stringify(res.data, null, 2) : 'Asset prepared.')
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to prepare launch asset.');
    } finally {
      setAssetPreparing(false);
    }
  };

  const handleRequestStartLaunch = () => {
    setError(null);
    if (!websiteUrl.trim() || !isValidHttpUrl(websiteUrl)) {
      setError('A valid product website URL (https://...) is required to create a Product Hunt draft.');
      return;
    }
    const values: Record<string, unknown> = {};
    if (productName.trim()) values.name = productName.trim();
    if (selectedTagline.trim()) values.tagline = selectedTagline.trim();
    if (phDescription.trim()) values.description = phDescription.trim();
    if (makerComment.trim()) values.commentBody = makerComment.trim();
    if (launchDateInput.trim() && /^\d{4}-\d{2}-\d{2}$/.test(launchDateInput.trim())) {
      values.launchDate = launchDateInput.trim();
    }

    setPendingConfirmation({
      action: 'start_launch',
      title: 'Confirm Creating Product Hunt Draft',
      summaryLines: [
        `Product URL: ${websiteUrl.trim()}`,
        `Name: ${String(values.name || productName || '(default)')}`,
        `Tagline: ${String(values.tagline || '(not set)')}`,
        ...(values.launchDate ? [`Target Launch Date: ${String(values.launchDate)}`] : []),
      ],
      warnings: [
        'This will create a new draft launch inside your connected Product Hunt account (never auto-submitted).',
      ],
      sideEffects: ['Creates a Product Hunt draft via official MCP tool: start_launch.'],
      previewText: phDescription.trim() || 'Draft fields will be saved to your Product Hunt account.',
      startPayload: {
        url: websiteUrl.trim(),
        values,
      },
    });
  };

  const handleRequestUpdateLaunch = async () => {
    if (!selectedPhLaunchId || !selectedPhLaunchData) {
      setError('Select and load a Product Hunt draft before pushing updates.');
      return;
    }
    const launchObj =
      selectedPhLaunchData.launch && typeof selectedPhLaunchData.launch === 'object'
        ? (selectedPhLaunchData.launch as Record<string, unknown>)
        : selectedPhLaunchData;
    const expectedRevision = String(
      launchObj.revision || selectedPhLaunchData.revision || ''
    );
    if (!expectedRevision) {
      setError('Missing launch revision from Product Hunt. Click the launch again to refresh.');
      return;
    }

    const changes: Record<string, unknown> = {};
    if (productName.trim()) changes.name = productName.trim();
    if (selectedTagline.trim()) changes.tagline = selectedTagline.trim();
    if (phDescription.trim()) changes.description = phDescription.trim();
    if (makerComment.trim()) changes.commentBody = makerComment.trim();
    if (websiteUrl.trim() && isValidHttpUrl(websiteUrl)) changes.url = websiteUrl.trim();
    if (launchDateInput.trim() && /^\d{4}-\d{2}-\d{2}$/.test(launchDateInput.trim())) {
      changes.launchDate = launchDateInput.trim();
    }

    if (Object.keys(changes).length === 0) {
      setError('Fill in at least one field to update on Product Hunt.');
      return;
    }

    setError(null);
    setPhActionLoading(true);
    try {
      // Step 1: Call WITHOUT explicitUserConfirmed so server enforces preview: true
      const previewRes = await authorizedFetch<{
        summaryText?: string;
        data?: Record<string, unknown> | null;
      }>(`/api/mcp/launches/${encodeURIComponent(selectedPhLaunchId)}/update`, {
        method: 'POST',
        body: JSON.stringify({
          expected_revision: expectedRevision,
          changes,
        }),
      });

      const d = previewRes.data || {};
      const token =
        typeof d.confirmation_token === 'string' ? d.confirmation_token : undefined;
      const warnings = Array.isArray(d.warnings)
        ? d.warnings.map((w) => String(w))
        : [];
      const sideEffects = Array.isArray(d.side_effects)
        ? d.side_effects.map((s) => String(s))
        : ['Updates your Product Hunt draft fields via official MCP tool: update_launch.'];

      setPendingConfirmation({
        action: 'update_launch',
        title: 'Preview & Confirm Product Hunt Draft Update',
        summaryLines: Object.entries(changes).map(([k, v]) => `${k}: ${String(v).slice(0, 140)}`),
        warnings,
        sideEffects,
        previewText:
          previewRes.summaryText ||
          (d.preview ? JSON.stringify(d.preview, null, 2) : JSON.stringify(changes, null, 2)),
        launchId: selectedPhLaunchId,
        expectedRevision,
        changes,
        confirmationToken: token,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to preview Product Hunt update.');
    } finally {
      setPhActionLoading(false);
    }
  };

  const handleRequestPreviewView = async () => {
    if (!selectedPhLaunchId) return;
    setError(null);
    setPhActionLoading(true);
    try {
      const res = await authorizedFetch<{
        summaryText?: string;
        data?: Record<string, unknown> | null;
      }>(`/api/mcp/launches/${encodeURIComponent(selectedPhLaunchId)}/preview`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setSelectedPhLaunchText(
        res.summaryText || (res.data ? JSON.stringify(res.data, null, 2) : 'Preview loaded.')
      );
      setSaveMessage('Loaded official Product Hunt preview view.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load launch preview.');
    } finally {
      setPhActionLoading(false);
    }
  };

  const handleRequestSubmitLaunch = async () => {
    if (!selectedPhLaunchId) {
      setError('Select a Product Hunt draft before previewing submission.');
      return;
    }
    setError(null);
    setPhActionLoading(true);
    try {
      // Step 1: Preview-only call (no explicitUserConfirmed)
      const previewRes = await authorizedFetch<{
        summaryText?: string;
        data?: Record<string, unknown> | null;
      }>(`/api/mcp/launches/${encodeURIComponent(selectedPhLaunchId)}/submit`, {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const d = previewRes.data || {};
      const token =
        typeof d.confirmation_token === 'string' ? d.confirmation_token : undefined;
      const warnings = Array.isArray(d.warnings)
        ? d.warnings.map((w) => String(w))
        : [
            'Submitting a launch marks it ready/scheduled or submits it for Product Hunt launch processing.',
          ];
      const sideEffects = Array.isArray(d.side_effects)
        ? d.side_effects.map((s) => String(s))
        : ['Executes official MCP tool: submit_launch.'];

      setPendingConfirmation({
        action: 'submit_launch',
        title: 'Final Confirmation: Submit Launch to Product Hunt',
        summaryLines: [`Launch ID: ${selectedPhLaunchId}`],
        warnings,
        sideEffects,
        previewText:
          previewRes.summaryText ||
          (d.preview ? JSON.stringify(d.preview, null, 2) : 'Review launch readiness before confirming.'),
        launchId: selectedPhLaunchId,
        confirmationToken: token,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to preview launch submission.');
    } finally {
      setPhActionLoading(false);
    }
  };

  const upsertScheduleRecord = async (input: {
    phLaunchId?: string;
    productName: string;
    launchDate?: string | null;
    status: LaunchScheduleStatus;
    liveUrl?: string | null;
    notes?: string;
  }) => {
    const existing = input.phLaunchId
      ? launchSchedules.find((s) => s.phLaunchId === input.phLaunchId)
      : launchSchedules.find(
          (s) => s.projectId === (selectedProjId || 'general') && s.productName === input.productName
        );
    if (existing) {
      await onUpdateLaunchSchedule(existing.id, {
        phLaunchId: input.phLaunchId || existing.phLaunchId,
        productName: input.productName,
        launchDate: input.launchDate || existing.launchDate,
        status: input.status,
        liveUrl: input.liveUrl || existing.liveUrl,
        notes: input.notes || existing.notes,
      });
    } else {
      await onCreateLaunchSchedule({
        projectId: selectedProjId || 'general',
        phLaunchId: input.phLaunchId,
        productName: input.productName,
        launchDate: input.launchDate || undefined,
        status: input.status,
        liveUrl: input.liveUrl || undefined,
        notes: input.notes,
      });
    }
  };

  const handleSaveManualSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!productName.trim()) {
      setError('Enter a product name above to track its launch schedule.');
      return;
    }
    if (schedLiveUrlInput.trim() && !isValidHttpUrl(schedLiveUrlInput.trim())) {
      setError('Live Product Hunt URL must start with https:// or http://.');
      return;
    }
    setSavingSchedule(true);
    try {
      await upsertScheduleRecord({
        phLaunchId: selectedPhLaunchId || undefined,
        productName: productName.trim(),
        launchDate: launchDateInput.trim() || undefined,
        status: schedStatusInput,
        liveUrl: schedLiveUrlInput.trim() || undefined,
        notes: schedNotesInput.trim() || undefined,
      });
      setSaveMessage(`Saved launch schedule for "${productName.trim()}".`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save launch schedule.');
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleExecuteConfirmedAction = async () => {
    if (!pendingConfirmation) return;
    setError(null);
    setPhActionLoading(true);
    try {
      if (pendingConfirmation.action === 'start_launch' && pendingConfirmation.startPayload) {
        const res = await authorizedFetch<{
          summaryText?: string;
          data?: Record<string, unknown> | null;
        }>('/api/mcp/launches/start', {
          method: 'POST',
          body: JSON.stringify({
            explicitUserConfirmed: true,
            url: pendingConfirmation.startPayload.url,
            values: pendingConfirmation.startPayload.values,
          }),
        });
        const newId = String(res.data?.id || res.data?.launch_id || '');
        const targetDate =
          typeof pendingConfirmation.startPayload.values.launchDate === 'string'
            ? pendingConfirmation.startPayload.values.launchDate
            : undefined;
        await upsertScheduleRecord({
          phLaunchId: newId || undefined,
          productName: productName.trim() || 'Product Hunt Draft',
          launchDate: targetDate,
          status: targetDate ? 'scheduled' : 'draft',
        }).catch(() => {});
        setSaveMessage(res.summaryText || 'Created draft launch on Product Hunt!');
        await loadPhLaunches();
      } else if (
        pendingConfirmation.action === 'update_launch' &&
        pendingConfirmation.launchId &&
        pendingConfirmation.expectedRevision &&
        pendingConfirmation.changes
      ) {
        const res = await authorizedFetch<{
          summaryText?: string;
          data?: Record<string, unknown> | null;
        }>(`/api/mcp/launches/${encodeURIComponent(pendingConfirmation.launchId)}/update`, {
          method: 'POST',
          body: JSON.stringify({
            explicitUserConfirmed: true,
            confirmation_token: pendingConfirmation.confirmationToken,
            expected_revision: pendingConfirmation.expectedRevision,
            changes: pendingConfirmation.changes,
          }),
        });
        const nextDate =
          typeof pendingConfirmation.changes.launchDate === 'string'
            ? pendingConfirmation.changes.launchDate
            : selectedPhLaunchMeta?.launchDate;
        await upsertScheduleRecord({
          phLaunchId: pendingConfirmation.launchId,
          productName: productName.trim() || selectedPhLaunchMeta?.name || 'Product Hunt Draft',
          launchDate: nextDate,
          status:
            (selectedPhLaunchMeta?.status as LaunchScheduleStatus) ||
            (nextDate ? 'scheduled' : 'draft'),
          liveUrl: selectedPhLaunchMeta?.url,
        }).catch(() => {});
        setSaveMessage(res.summaryText || 'Updated Product Hunt draft successfully.');
        await inspectPhLaunch(pendingConfirmation.launchId);
      } else if (
        pendingConfirmation.action === 'submit_launch' &&
        pendingConfirmation.launchId
      ) {
        const res = await authorizedFetch<{
          summaryText?: string;
          data?: Record<string, unknown> | null;
        }>(`/api/mcp/launches/${encodeURIComponent(pendingConfirmation.launchId)}/submit`, {
          method: 'POST',
          body: JSON.stringify({
            explicitUserConfirmed: true,
            confirmation_token: pendingConfirmation.confirmationToken,
          }),
        });
        await upsertScheduleRecord({
          phLaunchId: pendingConfirmation.launchId,
          productName: productName.trim() || selectedPhLaunchMeta?.name || 'Product Hunt Launch',
          launchDate: launchDateInput.trim() || selectedPhLaunchMeta?.launchDate || undefined,
          status: 'scheduled',
          liveUrl:
            typeof res.data?.url === 'string'
              ? res.data.url
              : selectedPhLaunchMeta?.url || undefined,
        }).catch(() => {});
        setSaveMessage(res.summaryText || 'Launch submitted via Product Hunt MCP.');
        await loadPhLaunches();
        await inspectPhLaunch(pendingConfirmation.launchId);
      }
      setPendingConfirmation(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Product Hunt action failed.');
    } finally {
      setPhActionLoading(false);
    }
  };

  const projectDrafts = selectedProjId
    ? drafts.filter((d) => d.projectId === selectedProjId)
    : drafts;

  const hasGeneratedOutput =
    taglines.length > 0 || Boolean(phDescription) || Boolean(makerComment);

  const handleCopy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1500);
    } catch {
      // clipboard blocked
    }
  };

  const runGeneration = async (section = 'all') => {
    setError(null);
    setSaveMessage(null);
    if (!productName.trim() || !category.trim()) {
      setError('Please enter at least a Product Name and Category.');
      return;
    }
    if (websiteUrl.trim() && !isValidHttpUrl(websiteUrl)) {
      setError('Website URL must start with https:// or http://.');
      return;
    }

    if (section === 'all') {
      setGenerating(true);
    } else {
      setRegenSection(section);
    }

    try {
      const keyFeatures = keyFeaturesText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);

      const data = await authorizedFetch<GeneratedPayload>('/api/ai/generate-draft', {
        method: 'POST',
        body: JSON.stringify({
          productName: productName.trim(),
          websiteUrl: websiteUrl.trim(),
          category: category.trim(),
          targetAudience: targetAudience.trim(),
          mainProblem: mainProblem.trim(),
          keyFeatures,
          usp: usp.trim(),
          description: productDescription.trim(),
          regenerateSection: section,
          existingDraft:
            section !== 'all'
              ? {
                  selectedTagline,
                  description: phDescription,
                  makerComment,
                  topics: topicsText.split(',').map((s) => s.trim()).filter(Boolean),
                  galleryIdeas: galleryIdeasText.split('\n').map((s) => s.trim()).filter(Boolean),
                  demoVideoScript,
                  launchAnnouncement,
                }
              : undefined,
        }),
      });

      if (section === 'all' || section === 'taglines') {
        const nextTaglines = Array.isArray(data.taglines) ? data.taglines : [];
        setTaglines(nextTaglines);
        if (nextTaglines[0]) setSelectedTagline(nextTaglines[0]);
      }
      if (section === 'all' || section === 'description') {
        setPhDescription(data.description || '');
      }
      if (section === 'all' || section === 'makerComment') {
        setMakerComment(data.makerComment || '');
      }
      if (section === 'all' || section === 'topics') {
        setTopicsText((data.topics || []).join(', '));
      }
      if (section === 'all' || section === 'galleryIdeas') {
        setGalleryIdeasText((data.galleryIdeas || []).join('\n'));
      }
      if (section === 'all' || section === 'demoVideoScript') {
        setDemoVideoScript(data.demoVideoScript || '');
      }
      if (section === 'all' || section === 'launchAnnouncement') {
        setLaunchAnnouncement(data.launchAnnouncement || '');
      }

      if (section === 'all') {
        const nextVerNum = projectDrafts.length + 1;
        setEditingDraftId(null);
        setVersionName(`v${nextVerNum}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate launch draft.');
    } finally {
      setGenerating(false);
      setRegenSection(null);
    }
  };

  const handleSaveVersion = async () => {
    setError(null);
    setSaveMessage(null);
    if (!hasGeneratedOutput) {
      setError('Generate or fill in draft content before saving.');
      return;
    }

    setSaving(true);
    try {
      let targetProjectId = selectedProjId;
      if (!targetProjectId) {
        const createdProj = await onCreateProjectQuick({
          name: productName.trim() || 'Untitled Product',
          category: category.trim() || 'SaaS',
          websiteUrl: websiteUrl.trim(),
          targetAudience: targetAudience.trim(),
          mainProblem: mainProblem.trim(),
          usp: usp.trim(),
          description: productDescription.trim(),
        });
        targetProjectId = createdProj.id;
        setSelectedProjId(targetProjectId);
      }

      const nextName = versionName.trim() || `v${projectDrafts.length + 1}`;
      const savedId = await onSaveDraft({
        projectId: targetProjectId,
        versionName: nextName,
        productName: productName.trim(),
        taglines: taglines.length > 0 ? taglines : [selectedTagline],
        selectedTagline: selectedTagline.trim() || taglines[0] || productName.trim(),
        description: phDescription.trim(),
        makerComment: makerComment.trim(),
        topics: topicsText
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        galleryIdeas: galleryIdeasText
          .split('\n')
          .map((g) => g.trim())
          .filter(Boolean),
        demoVideoScript: demoVideoScript.trim(),
        launchAnnouncement: launchAnnouncement.trim(),
      });
      setEditingDraftId(savedId);
      setSaveMessage(`Saved draft version "${nextName}" to your workspace.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save draft.');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateExistingDraft = async () => {
    if (!editingDraftId) return;
    setError(null);
    setSaveMessage(null);
    if (!hasGeneratedOutput) {
      setError('Generate or fill in draft content before updating.');
      return;
    }

    setUpdating(true);
    try {
      const nextName = versionName.trim() || 'v1';
      await onUpdateDraft(editingDraftId, {
        versionName: nextName,
        productName: productName.trim() || 'Untitled',
        taglines: taglines.length > 0 ? taglines : [selectedTagline],
        selectedTagline: selectedTagline.trim() || taglines[0] || productName.trim(),
        description: phDescription.trim(),
        makerComment: makerComment.trim(),
        topics: topicsText
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        galleryIdeas: galleryIdeasText
          .split('\n')
          .map((g) => g.trim())
          .filter(Boolean),
        demoVideoScript: demoVideoScript.trim(),
        launchAnnouncement: launchAnnouncement.trim(),
      });
      setSaveMessage(`Updated saved draft "${nextName}".`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update saved draft.');
    } finally {
      setUpdating(false);
    }
  };

  const loadDraftIntoEditor = (draft: LaunchDraft) => {
    setEditingDraftId(draft.id);
    setSelectedProjId(draft.projectId);
    setProductName(draft.productName);
    setVersionName(draft.versionName);
    setTaglines(draft.taglines);
    setSelectedTagline(draft.selectedTagline);
    setPhDescription(draft.description);
    setMakerComment(draft.makerComment);
    setTopicsText(draft.topics.join(', '));
    setGalleryIdeasText(draft.galleryIdeas.join('\n'));
    setDemoVideoScript(draft.demoVideoScript);
    setLaunchAnnouncement(draft.launchAnnouncement);
    setSaveMessage(`Loaded "${draft.versionName}" into editor.`);
  };

  const leftDraft = drafts.find((d) => d.id === compareLeftId) || drafts[0] || null;
  const rightDraft = drafts.find((d) => d.id === compareRightId) || drafts[1] || drafts[0] || null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">
            AI Launch Draft Generator
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Generate taglines, description, maker comment, gallery ideas, demo script, and launch announcement—then edit, save, and compare versions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowPhManager(!showPhManager)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              showPhManager
                ? 'border-[#EA580C] bg-orange-50 text-[#C2410C]'
                : 'border-slate-300 bg-white text-[#0F172A] hover:bg-slate-50'
            }`}
          >
            <Rocket className="w-4 h-4" />
            {showPhManager ? 'Hide Product Hunt Sync' : 'Product Hunt Drafts (MCP)'}
          </button>

          {drafts.length >= 2 && (
            <button
              type="button"
              onClick={() => {
                if (!compareLeftId && drafts[0]) setCompareLeftId(drafts[0].id);
                if (!compareRightId && drafts[1]) setCompareRightId(drafts[1].id);
                setCompareMode(!compareMode);
              }}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                compareMode
                  ? 'border-[#6D28D9] bg-violet-50 text-[#6D28D9]'
                  : 'border-slate-300 bg-white text-[#0F172A] hover:bg-slate-50'
              }`}
            >
              <Columns2 className="w-4 h-4" />
              {compareMode ? 'Back to Editor' : 'Compare Versions'}
            </button>
          )}
        </div>
      </div>

      {/* Product Hunt Launch Manager Panel (Official MCP) */}
      {showPhManager && (
        <div className="bg-white border border-orange-200 rounded-2xl p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-[#0F172A]">
                  Product Hunt Draft &amp; Launch Manager (Official MCP)
                </h2>
                {mcp.mcpStatus?.accountConnected && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-semibold">
                    <CheckCircle2 className="w-3 h-3" />
                    Connected
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 mt-1">
                Inspect your real Product Hunt drafts, check launch date availability, stage thumbnail/gallery assets, and preview every update before confirming.
              </p>
            </div>

            {!mcp.mcpStatus?.accountConnected ? (
              <button
                type="button"
                disabled={mcp.connecting}
                onClick={() => mcp.connectProductHunt()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-semibold cursor-pointer disabled:opacity-60"
              >
                <Link2 className="w-3.5 h-3.5" />
                {mcp.connecting ? 'Authorizing...' : 'Connect Product Hunt'}
              </button>
            ) : (
              <button
                type="button"
                disabled={phLaunchesLoading}
                onClick={loadPhLaunches}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-[#0F172A] cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${phLaunchesLoading ? 'animate-spin' : ''}`} />
                Refresh PH Drafts
              </button>
            )}
          </div>

          {!mcp.mcpStatus?.accountConnected ? (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
              Connect your Product Hunt account above (or in Profile &amp; Plan) to list your drafts, verify launch date slots, push updates from this editor, or submit launches with preview confirmation.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              {/* Left: Existing Drafts & Date Availability */}
              <div className="lg:col-span-5 space-y-4">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                  <p className="text-xs font-bold text-[#0F172A]">
                    Your Product Hunt Drafts &amp; Launches ({phLaunches.length})
                  </p>
                  {phLaunches.length === 0 ? (
                    <p className="text-xs text-slate-500">
                      No drafts returned yet. Fill out your Product URL &amp; copy below to create a new draft on Product Hunt.
                    </p>
                  ) : (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {phLaunches.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => inspectPhLaunch(item.id)}
                          className={`w-full p-2.5 rounded-lg border text-left text-xs transition-colors cursor-pointer ${
                            selectedPhLaunchId === item.id
                              ? 'border-[#EA580C] bg-orange-50'
                              : 'border-slate-200 bg-white hover:bg-slate-100'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-[#0F172A] truncate">
                              {item.name}
                            </span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                              {item.status || 'draft'}
                            </span>
                          </div>
                          {item.tagline && (
                            <p className="text-[11px] text-slate-500 truncate mt-0.5">
                              {item.tagline}
                            </p>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Launch Date & URL Eligibility Context Check */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#0F172A]">
                    <Calendar className="w-3.5 h-3.5 text-[#6D28D9]" />
                    <span>Check Launch Date &amp; URL Context</span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={phContextDate}
                      onChange={(e) => setPhContextDate(e.target.value)}
                      placeholder="YYYY-MM-DD (optional)"
                      className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-mono"
                    />
                    <button
                      type="button"
                      disabled={phContextLoading}
                      onClick={handleCheckLaunchContext}
                      className="px-3 py-1.5 rounded-lg bg-[#0F172A] text-white text-xs font-semibold cursor-pointer disabled:opacity-60"
                    >
                      {phContextLoading ? 'Checking...' : 'Check'}
                    </button>
                  </div>
                  {phContextResult && (
                    <pre className="p-2.5 rounded-lg bg-white border border-slate-200 text-[11px] text-slate-700 whitespace-pre-wrap max-h-32 overflow-y-auto">
                      {phContextResult}
                    </pre>
                  )}
                </div>
              </div>

              {/* Right: Selected Launch Assessment + Actions */}
              <div className="lg:col-span-7 space-y-4">
                <div className="p-4 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-bold text-[#0F172A]">
                      {selectedPhLaunchId
                        ? `Selected Draft: ${selectedPhLaunchId}`
                        : 'Create New Draft or Select One on the Left'}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {selectedPhLaunchData && (
                        <>
                          <button
                            type="button"
                            onClick={handleLoadPhLaunchIntoEditor}
                            className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-[11px] font-semibold text-[#0F172A] cursor-pointer"
                          >
                            Load into Editor
                          </button>
                          <button
                            type="button"
                            disabled={phActionLoading}
                            onClick={handleRequestPreviewView}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-[11px] font-semibold text-[#0F172A] cursor-pointer"
                          >
                            <Eye className="w-3 h-3" />
                            Preview View
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {selectedPhLaunchMeta && (
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-[#0F172A]">
                          Status: {selectedPhLaunchMeta.status || 'draft'}
                        </span>
                        {selectedPhLaunchMeta.launchDate && (
                          <span className="font-mono text-slate-600">
                            · Target PT: {selectedPhLaunchMeta.launchDate}
                          </span>
                        )}
                      </div>
                      {selectedPhLaunchMeta.url && (
                        <a
                          href={selectedPhLaunchMeta.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-semibold text-[#6D28D9] hover:underline"
                        >
                          Live PH URL <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      {selectedPhLaunchMeta.missingItems &&
                        selectedPhLaunchMeta.missingItems.length > 0 && (
                          <div className="w-full pt-1 text-[11px] text-amber-800">
                            Missing checklist items:{' '}
                            {selectedPhLaunchMeta.missingItems.join(', ')}
                          </div>
                        )}
                    </div>
                  )}

                  {selectedPhLaunchText && (
                    <pre className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-700 whitespace-pre-wrap max-h-48 overflow-y-auto">
                      {selectedPhLaunchText}
                    </pre>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        Target Launch Date (Pacific YYYY-MM-DD)
                      </label>
                      <input
                        type="text"
                        value={launchDateInput}
                        onChange={(e) => setLaunchDateInput(e.target.value)}
                        placeholder="e.g., 2026-12-01"
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        Stage Media Asset (HTTPS Image URL)
                      </label>
                      <div className="flex gap-1.5">
                        <select
                          value={assetKind}
                          onChange={(e) =>
                            setAssetKind(e.target.value as 'thumbnail' | 'gallery')
                          }
                          className="px-2 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
                        >
                          <option value="thumbnail">Thumbnail</option>
                          <option value="gallery">Gallery</option>
                        </select>
                        <input
                          type="url"
                          value={assetUrl}
                          onChange={(e) => setAssetUrl(e.target.value)}
                          placeholder="https://.../image.png"
                          className="flex-1 min-w-0 px-2 py-1.5 rounded-lg border border-slate-300 text-xs"
                        />
                        <button
                          type="button"
                          disabled={assetPreparing || !selectedPhLaunchId}
                          onClick={handlePrepareAsset}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 text-xs font-semibold cursor-pointer disabled:opacity-50"
                        >
                          <ImageIcon className="w-3 h-3" />
                          Stage
                        </button>
                      </div>
                    </div>
                  </div>

                  {assetResultText && (
                    <pre className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-900 whitespace-pre-wrap max-h-28 overflow-y-auto">
                      {assetResultText}
                    </pre>
                  )}

                  <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      disabled={phActionLoading}
                      onClick={handleRequestStartLaunch}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#6D28D9] hover:bg-[#5B21B6] text-white text-xs font-semibold cursor-pointer disabled:opacity-60"
                    >
                      <UploadCloud className="w-3.5 h-3.5" />
                      Create New PH Draft (Preview &amp; Confirm)
                    </button>

                    {selectedPhLaunchId && (
                      <>
                        <button
                          type="button"
                          disabled={phActionLoading}
                          onClick={handleRequestUpdateLaunch}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#6D28D9] text-[#6D28D9] bg-violet-50 hover:bg-violet-100 text-xs font-semibold cursor-pointer disabled:opacity-60"
                        >
                          <Save className="w-3.5 h-3.5" />
                          Push Editor Changes to PH Draft
                        </button>

                        <button
                          type="button"
                          disabled={phActionLoading}
                          onClick={handleRequestSubmitLaunch}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-semibold cursor-pointer disabled:opacity-60"
                        >
                          <Send className="w-3.5 h-3.5" />
                          Preview &amp; Submit Launch
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
          {error}
        </div>
      )}
      {saveMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
          {saveMessage}
        </div>
      )}

      {compareMode && drafts.length >= 2 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4 border-b border-slate-200">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Version A</label>
              <select
                value={leftDraft?.id || ''}
                onChange={(e) => setCompareLeftId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
              >
                {drafts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.productName} — {d.versionName} ({formatTimestamp(d.createdAt)})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Version B</label>
              <select
                value={rightDraft?.id || ''}
                onChange={(e) => setCompareRightId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
              >
                {drafts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.productName} — {d.versionName} ({formatTimestamp(d.createdAt)})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {leftDraft && rightDraft && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[leftDraft, rightDraft].map((d, i) => (
                <div key={`${d.id}-${i}`} className="border border-slate-200 rounded-xl p-5 space-y-4 bg-slate-50/50">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                    <span className="text-sm font-bold text-[#0F172A]">
                      {d.productName} · {d.versionName}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        loadDraftIntoEditor(d);
                        setCompareMode(false);
                      }}
                      className="text-xs font-semibold text-[#6D28D9] hover:underline cursor-pointer"
                    >
                      Load into Editor
                    </button>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500 mb-1">Selected Tagline</p>
                    <p className="text-sm font-medium text-[#0F172A]">{d.selectedTagline}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500 mb-1">Description</p>
                    <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">
                      {d.description}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500 mb-1">First Maker Comment</p>
                    <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">
                      {d.makerComment}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500 mb-1">Topics</p>
                    <p className="text-xs text-slate-700">{d.topics.join(' · ')}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Product Input Form */}
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h2 className="text-base font-bold text-[#0F172A]">1. Product Brief</h2>

            {projects.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Link to Project
                </label>
                <select
                  value={selectedProjId}
                  onChange={(e) => {
                    const nextProj = projects.find((p) => p.id === e.target.value);
                    setSelectedProjId(e.target.value);
                    if (nextProj) {
                      setProductName(nextProj.name);
                      setWebsiteUrl(nextProj.websiteUrl || '');
                      setCategory(nextProj.category);
                      setTargetAudience(nextProj.targetAudience || '');
                      setMainProblem(nextProj.mainProblem || '');
                      setKeyFeaturesText(nextProj.keyFeatures?.join('\n') || '');
                      setUsp(nextProj.usp || '');
                      setProductDescription(nextProj.description || '');
                    }
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.category})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Product Name *
                </label>
                <input
                  type="text"
                  maxLength={120}
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="PulseBoard"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Category *
                </label>
                <input
                  type="text"
                  maxLength={80}
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="SaaS / Developer Tools"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Website URL
              </label>
              <input
                type="url"
                maxLength={300}
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://yourproduct.com"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Target Audience
              </label>
              <input
                type="text"
                maxLength={500}
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                placeholder="Who gets immediate value on day 1?"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Main Problem Solved
              </label>
              <textarea
                rows={2}
                maxLength={1000}
                value={mainProblem}
                onChange={(e) => setMainProblem(e.target.value)}
                placeholder="What frustrating workflow does this fix?"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Key Features (one per line)
              </label>
              <textarea
                rows={3}
                value={keyFeaturesText}
                onChange={(e) => setKeyFeaturesText(e.target.value)}
                placeholder="One-click ticket clustering&#10;Weekly Slack digest&#10;Linear & Jira sync"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Unique Selling Proposition
              </label>
              <input
                type="text"
                maxLength={800}
                value={usp}
                onChange={(e) => setUsp(e.target.value)}
                placeholder="Why try this over existing tools?"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Product Description Notes
              </label>
              <textarea
                rows={3}
                maxLength={2500}
                value={productDescription}
                onChange={(e) => setProductDescription(e.target.value)}
                placeholder="Describe how the product works in plain words..."
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>

            <button
              type="button"
              disabled={generating}
              onClick={() => runGeneration('all')}
              className="w-full py-2.5 px-4 rounded-lg bg-[#6D28D9] hover:bg-[#5B21B6] text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60"
            >
              <Sparkles className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
              {generating ? 'Generating Launch Kit...' : 'Generate Complete Launch Draft'}
            </button>

            {/* Saved Versions List */}
            {projectDrafts.length > 0 && (
              <div className="pt-4 border-t border-slate-200">
                <p className="text-xs font-semibold text-slate-500 mb-2">
                  Saved Draft Versions ({projectDrafts.length})
                </p>
                <div className="space-y-2">
                  {projectDrafts.map((d) => {
                    const isEditing = d.id === editingDraftId;
                    return (
                      <div
                        key={d.id}
                        className={`p-2.5 rounded-lg border flex items-center justify-between gap-2 transition-colors ${
                          isEditing
                            ? 'border-[#6D28D9] bg-violet-50'
                            : 'border-slate-200 bg-slate-50'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => loadDraftIntoEditor(d)}
                          className="text-left min-w-0 flex-1 cursor-pointer"
                        >
                          <p className="text-xs font-semibold text-[#0F172A] truncate">
                            {d.versionName} · {d.productName}
                            {isEditing && (
                              <span className="ml-1.5 text-[10px] font-semibold text-[#6D28D9]">
                                (Editing)
                              </span>
                            )}
                          </p>
                          <p className="text-[11px] text-slate-500 truncate">
                            {d.selectedTagline}
                          </p>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (d.id === editingDraftId) setEditingDraftId(null);
                            onDeleteDraft(d.id);
                          }}
                          className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                          title="Delete draft"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right: Editable Generated Output */}
          <div className="lg:col-span-7 space-y-5">
            {!hasGeneratedOutput ? (
              <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
                <Sparkles className="w-9 h-9 text-[#6D28D9] mx-auto mb-3" />
                <h3 className="text-base font-bold text-[#0F172A] mb-1">
                  Ready to generate your Product Hunt launch kit
                </h3>
                <p className="text-sm text-slate-600 max-w-md mx-auto">
                  Fill out your product brief on the left and click “Generate Complete Launch Draft” to get 5 tagline ideas, a maker comment, gallery slide concepts, a 60-second demo script, and more.
                </p>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
                {/* Save Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium text-slate-600">Version:</label>
                    <input
                      type="text"
                      maxLength={80}
                      value={versionName}
                      onChange={(e) => setVersionName(e.target.value)}
                      className="w-28 px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-mono"
                    />
                    {editingDraftId && drafts.some((d) => d.id === editingDraftId) && (
                      <span className="text-[11px] font-medium text-[#6D28D9] bg-violet-50 border border-violet-200 px-2 py-0.5 rounded-md">
                        Editing saved draft
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {editingDraftId && drafts.some((d) => d.id === editingDraftId) && (
                      <button
                        type="button"
                        disabled={updating || saving}
                        onClick={handleUpdateExistingDraft}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#6D28D9] hover:bg-[#5B21B6] text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-60"
                      >
                        <Save className="w-3.5 h-3.5" />
                        {updating ? 'Updating...' : 'Update Draft'}
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={saving || updating}
                      onClick={handleSaveVersion}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-60"
                    >
                      <Save className="w-3.5 h-3.5" />
                      {saving
                        ? 'Saving...'
                        : editingDraftId && drafts.some((d) => d.id === editingDraftId)
                        ? 'Save as New Version'
                        : 'Save Version'}
                    </button>
                  </div>
                </div>

                {/* 5 Taglines */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <label className="text-xs font-semibold text-[#0F172A]">
                      5 Tagline Suggestions (select &amp; edit)
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={regenSection === 'taglines'}
                        onClick={() => runGeneration('taglines')}
                        className="inline-flex items-center gap-1 text-xs text-[#6D28D9] hover:underline cursor-pointer"
                      >
                        <RefreshCw className={`w-3 h-3 ${regenSection === 'taglines' ? 'animate-spin' : ''}`} />
                        Regenerate
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCopy('tagline', selectedTagline)}
                        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-[#0F172A] cursor-pointer"
                      >
                        {copiedKey === 'tagline' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        {copiedKey === 'tagline' ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2 mb-3">
                    {taglines.map((t, idx) => (
                      <button
                        key={`${t}-${idx}`}
                        type="button"
                        onClick={() => setSelectedTagline(t)}
                        className={`w-full px-3 py-2 rounded-lg border text-left text-xs flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                          selectedTagline === t
                            ? 'border-[#6D28D9] bg-violet-50 text-[#0F172A] font-medium'
                            : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <span>{t}</span>
                        <span className="font-mono text-[11px] text-slate-400 tabular-nums shrink-0">
                          {t.length}/60
                        </span>
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    maxLength={120}
                    value={selectedTagline}
                    onChange={(e) => setSelectedTagline(e.target.value)}
                    placeholder="Edit your active tagline..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-medium text-[#0F172A]"
                  />
                  <p className="text-[11px] text-slate-500 mt-1 tabular-nums">
                    Active tagline length: {selectedTagline.length} / 60 recommended characters
                  </p>
                </div>

                {/* Description */}
                <EditableSection
                  label="Product Hunt Description"
                  value={phDescription}
                  onChange={setPhDescription}
                  rows={4}
                  maxLength={3000}
                  onRegenerate={() => runGeneration('description')}
                  regenerating={regenSection === 'description'}
                  onCopy={() => handleCopy('desc', phDescription)}
                  copied={copiedKey === 'desc'}
                />

                {/* First Maker Comment */}
                <EditableSection
                  label="First Maker Comment"
                  value={makerComment}
                  onChange={setMakerComment}
                  rows={6}
                  maxLength={4000}
                  onRegenerate={() => runGeneration('makerComment')}
                  regenerating={regenSection === 'makerComment'}
                  onCopy={() => handleCopy('maker', makerComment)}
                  copied={copiedKey === 'maker'}
                />

                {/* Topics */}
                <EditableSection
                  label="Suggested Topics (comma-separated)"
                  value={topicsText}
                  onChange={setTopicsText}
                  rows={2}
                  maxLength={400}
                  onRegenerate={() => runGeneration('topics')}
                  regenerating={regenSection === 'topics'}
                  onCopy={() => handleCopy('topics', topicsText)}
                  copied={copiedKey === 'topics'}
                />

                {/* Gallery Ideas */}
                <EditableSection
                  label="Gallery Image Ideas (one slide per line)"
                  value={galleryIdeasText}
                  onChange={setGalleryIdeasText}
                  rows={5}
                  maxLength={2500}
                  onRegenerate={() => runGeneration('galleryIdeas')}
                  regenerating={regenSection === 'galleryIdeas'}
                  onCopy={() => handleCopy('gallery', galleryIdeasText)}
                  copied={copiedKey === 'gallery'}
                />

                {/* Demo Video Script */}
                <EditableSection
                  label="60-Second Demo Video Script"
                  value={demoVideoScript}
                  onChange={setDemoVideoScript}
                  rows={5}
                  maxLength={5000}
                  onRegenerate={() => runGeneration('demoVideoScript')}
                  regenerating={regenSection === 'demoVideoScript'}
                  onCopy={() => handleCopy('video', demoVideoScript)}
                  copied={copiedKey === 'video'}
                />

                {/* Launch Announcement */}
                <EditableSection
                  label="Launch Day Social Announcement"
                  value={launchAnnouncement}
                  onChange={setLaunchAnnouncement}
                  rows={4}
                  maxLength={3000}
                  onRegenerate={() => runGeneration('launchAnnouncement')}
                  regenerating={regenSection === 'launchAnnouncement'}
                  onCopy={() => handleCopy('announce', launchAnnouncement)}
                  copied={copiedKey === 'announce'}
                />
              </div>
            )}

            {/* Launch Schedule & Live Status Tracker */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-bold text-[#0F172A]">
                    Launch Schedule &amp; Live Tracking
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Track your target Pacific launch date, status, and live Product Hunt URL across your workspace.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSaveManualSchedule} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                <div className="sm:col-span-3">
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Launch Date (PT)
                  </label>
                  <input
                    type="date"
                    value={launchDateInput}
                    onChange={(e) => setLaunchDateInput(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-mono"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Status
                  </label>
                  <select
                    value={schedStatusInput}
                    onChange={(e) => setSchedStatusInput(e.target.value as LaunchScheduleStatus)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
                  >
                    <option value="draft">Draft</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="live">Live</option>
                    <option value="unscheduled">Unscheduled</option>
                  </select>
                </div>
                <div className="sm:col-span-4">
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Live Product Hunt URL (optional)
                  </label>
                  <input
                    type="url"
                    value={schedLiveUrlInput}
                    onChange={(e) => setSchedLiveUrlInput(e.target.value)}
                    placeholder="https://www.producthunt.com/posts/..."
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs"
                  />
                </div>
                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    disabled={savingSchedule}
                    className="w-full px-3 py-1.5 rounded-lg bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer disabled:opacity-60"
                  >
                    {savingSchedule ? 'Saving...' : 'Track Launch'}
                  </button>
                </div>
                <div className="sm:col-span-12">
                  <input
                    type="text"
                    maxLength={400}
                    value={schedNotesInput}
                    onChange={(e) => setSchedNotesInput(e.target.value)}
                    placeholder="Optional launch-day shift notes or checklist reminder..."
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs"
                  />
                </div>
              </form>

              {launchSchedules.length > 0 && (
                <div className="space-y-2 pt-2">
                  {launchSchedules.map((sched) => (
                    <div
                      key={sched.id}
                      className="p-3 rounded-lg border border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-[#0F172A]">
                            {sched.productName}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                              sched.status === 'live'
                                ? 'bg-emerald-100 text-emerald-800'
                                : sched.status === 'scheduled'
                                ? 'bg-violet-100 text-[#6D28D9]'
                                : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {sched.status}
                          </span>
                          {sched.launchDate && (
                            <span className="font-mono text-[11px] text-slate-600">
                              {sched.launchDate} PT
                            </span>
                          )}
                        </div>
                        {sched.notes && (
                          <p className="text-[11px] text-slate-500 mt-1 truncate">{sched.notes}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {sched.liveUrl && (
                          <a
                            href={sched.liveUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-semibold text-[#6D28D9] hover:underline"
                          >
                            Live PH <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                        <select
                          value={sched.status}
                          onChange={(e) =>
                            onUpdateLaunchSchedule(sched.id, {
                              status: e.target.value as LaunchScheduleStatus,
                            })
                          }
                          className="px-2 py-1 rounded border border-slate-300 bg-white text-[11px]"
                        >
                          <option value="draft">Draft</option>
                          <option value="scheduled">Scheduled</option>
                          <option value="live">Live</option>
                          <option value="unscheduled">Unscheduled</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => onDeleteLaunchSchedule(sched.id)}
                          title="Remove tracked schedule"
                          className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Mandatory Preview & Explicit Confirmation Modal for Product Hunt MCP Mutations */}
      {pendingConfirmation && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-orange-50 text-[#EA580C] flex items-center justify-center shrink-0">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#0F172A]">
                    {pendingConfirmation.title}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Review exact changes and Product Hunt warnings before confirming.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPendingConfirmation(null)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {pendingConfirmation.warnings.length > 0 && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
                <p className="font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Warnings &amp; Impact
                </p>
                {pendingConfirmation.warnings.map((w, i) => (
                  <p key={i}>• {w}</p>
                ))}
              </div>
            )}

            <div className="space-y-1.5 text-xs">
              <p className="font-semibold text-slate-700">Proposed Action Summary</p>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1 text-slate-700">
                {pendingConfirmation.summaryLines.map((line, i) => (
                  <p key={i} className="break-words">
                    {line}
                  </p>
                ))}
              </div>
            </div>

            {pendingConfirmation.sideEffects.length > 0 && (
              <div className="text-xs text-slate-600 space-y-1">
                <p className="font-semibold text-slate-700">Side Effects</p>
                {pendingConfirmation.sideEffects.map((s, i) => (
                  <p key={i}>• {s}</p>
                ))}
              </div>
            )}

            <div className="space-y-1.5 text-xs">
              <p className="font-semibold text-slate-700">Official Product Hunt Preview</p>
              <pre className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-700 whitespace-pre-wrap max-h-44 overflow-y-auto">
                {pendingConfirmation.previewText}
              </pre>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                disabled={phActionLoading}
                onClick={() => setPendingConfirmation(null)}
                className="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-[#0F172A] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={phActionLoading}
                onClick={handleExecuteConfirmedAction}
                className="px-4 py-2 rounded-lg bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-semibold cursor-pointer disabled:opacity-60"
              >
                {phActionLoading ? 'Executing...' : 'Confirm & Execute on Product Hunt'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EditableSection({
  label,
  value,
  onChange,
  rows,
  maxLength,
  onRegenerate,
  regenerating,
  onCopy,
  copied,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  rows: number;
  maxLength: number;
  onRegenerate: () => void;
  regenerating: boolean;
  onCopy: () => void;
  copied: boolean;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <label className="text-xs font-semibold text-[#0F172A]">{label}</label>
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={regenerating}
            onClick={onRegenerate}
            className="inline-flex items-center gap-1 text-xs text-[#6D28D9] hover:underline cursor-pointer"
          >
            <RefreshCw className={`w-3 h-3 ${regenerating ? 'animate-spin' : ''}`} />
            Regenerate
          </button>
          <button
            type="button"
            onClick={onCopy}
            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-[#0F172A] cursor-pointer"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
      <textarea
        rows={rows}
        maxLength={maxLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-[#0F172A] leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20 focus:border-[#6D28D9]"
      />
    </div>
  );
}
