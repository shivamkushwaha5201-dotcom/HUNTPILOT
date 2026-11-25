import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  Circle,
  Compass,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react';
import { ACADEMY_CHAPTERS } from '../data/academyData';
import { AcademyProgress, Project } from '../types';
import { authorizedFetch } from '../utils/validation';
import { PhBanner, PhCard } from './ui/PhPrimitives';

interface AcademyViewProps {
  progress: AcademyProgress | null;
  activeProject?: Project | null;
  onToggleLesson: (lessonId: string) => Promise<void>;
  onToggleChecklist: (itemId: string) => Promise<void>;
}

export function AcademyView({
  progress,
  activeProject,
  onToggleLesson,
  onToggleChecklist,
}: AcademyViewProps) {
  const [selectedChapterId, setSelectedChapterId] = useState(ACADEMY_CHAPTERS[0].id);
  const [selectedLessonId, setSelectedLessonId] = useState(ACADEMY_CHAPTERS[0].lessons[0].id);
  const [imgFailed, setImgFailed] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  const [aiQuestion, setAiQuestion] = useState('');
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    setAiExplanation(null);
    setAiError(null);
    setAiQuestion('');
  }, [selectedLessonId]);

  const completedLessons = progress?.completedLessons || [];
  const completedChecklist = progress?.completedChecklistItems || [];

  const totalLessons = ACADEMY_CHAPTERS.reduce((acc, ch) => acc + ch.lessons.length, 0);
  const totalChecklist = ACADEMY_CHAPTERS.reduce((acc, ch) => acc + ch.checklist.length, 0);
  const overallPercent = Math.round(
    ((completedLessons.length + completedChecklist.length) / (totalLessons + totalChecklist)) * 100
  );

  const activeChapter =
    ACADEMY_CHAPTERS.find((c) => c.id === selectedChapterId) || ACADEMY_CHAPTERS[0];
  const activeLesson =
    activeChapter.lessons.find((l) => l.id === selectedLessonId) || activeChapter.lessons[0];

  const handleSelectChapter = (chapterId: string) => {
    const ch = ACADEMY_CHAPTERS.find((c) => c.id === chapterId);
    setSelectedChapterId(chapterId);
    if (ch && ch.lessons.length > 0) {
      setSelectedLessonId(ch.lessons[0].id);
    }
  };

  const handleToggleLessonClick = async (lessonId: string) => {
    setSavingId(lessonId);
    try {
      await onToggleLesson(lessonId);
    } finally {
      setSavingId(null);
    }
  };

  const handleToggleChecklistClick = async (itemId: string) => {
    setSavingId(itemId);
    try {
      await onToggleChecklist(itemId);
    } finally {
      setSavingId(null);
    }
  };

  const handleAskAiExplain = async (customQuestion?: string) => {
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await authorizedFetch<{ explanation: string }>('/api/ai/academy-explain', {
        method: 'POST',
        body: JSON.stringify({
          lessonTitle: activeLesson.title,
          lessonExplanation: activeLesson.explanation,
          question: (customQuestion ?? aiQuestion).trim(),
          projectContext: activeProject
            ? {
                name: activeProject.name,
                category: activeProject.category,
                tagline: activeProject.tagline,
                targetAudience: activeProject.targetAudience,
              }
            : null,
        }),
      });
      setAiExplanation(res.explanation);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Unable to generate explanation.');
    } finally {
      setAiLoading(false);
    }
  };

  const lessonIsDone = completedLessons.includes(activeLesson.id);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-[#EAEAEA] rounded-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12">
        <div className="lg:col-span-7 p-6 sm:p-8 flex flex-col justify-between">
          <div>
            <p className="text-xs font-semibold text-[#FF6154] mb-2">
              Product Hunt Launch Academy
            </p>
            <h1 className="text-2xl font-bold text-[#202020] tracking-tight mb-2">
              Learn Product Hunt from first principles
            </h1>
            <p className="text-sm text-[#555555] leading-relaxed max-w-xl">
              Six practical chapters written in plain English for first-time makers. Read each guide, study real examples, review Do’s and Don’ts, and check off action items as you prepare your launch.
            </p>
          </div>

          <div className="mt-6 pt-5 border-t border-[#EAEAEA]">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-medium text-[#555555]">
                Academy Progress · {completedLessons.length}/{totalLessons} lessons ·{' '}
                {completedChecklist.length}/{totalChecklist} checklist items
              </span>
              <span className="font-mono font-bold text-[#FF6154] tabular-nums">
                {overallPercent}%
              </span>
            </div>
            <div className="h-2 bg-[#F3F3F3] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#FF6154] rounded-full transition-all duration-300"
                style={{ width: `${overallPercent}%` }}
              />
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 bg-[#F3F3F3] min-h-[200px] relative">
          {imgFailed ? (
            <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-[#FFF1F0] text-[#202020]">
              <Compass className="w-9 h-9 text-[#FF6154] mb-2" />
              <p className="text-sm font-semibold">6-Chapter Launch Playbook</p>
            </div>
          ) : (
            <img
              src="/src/assets/images/academy_launch_editorial_1795508886165.jpg"
              alt="Minimalist founder workspace preparing Product Hunt launch"
              referrerPolicy="no-referrer"
              onError={() => setImgFailed(true)}
              className="w-full h-full object-cover lg:absolute lg:inset-0"
            />
          )}
        </div>
      </div>

      {/* Chapter Navigation */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
        {ACADEMY_CHAPTERS.map((ch) => {
          const isCurrent = ch.id === activeChapter.id;
          const doneInCh = ch.lessons.filter((l) => completedLessons.includes(l.id)).length;
          return (
            <button
              key={ch.id}
              type="button"
              onClick={() => handleSelectChapter(ch.id)}
              className={`p-3.5 rounded-xl border text-left transition-colors cursor-pointer ${
                isCurrent
                  ? 'border-[#FF6154] bg-[#FFF1F0]'
                  : 'border-[#EAEAEA] bg-white hover:bg-[#FAFAFA] hover:border-[#D4D4D4]'
              }`}
            >
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-mono font-bold text-[#FF6154] tabular-nums">
                  Ch. {ch.number}
                </span>
                <span className="font-mono text-[11px] text-[#777777] tabular-nums">
                  {doneInCh}/{ch.lessons.length}
                </span>
              </div>
              <p className="text-xs font-bold text-[#202020] leading-snug line-clamp-2">
                {ch.title}
              </p>
            </button>
          );
        })}
      </div>

      {/* Main Reader Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Lesson List & Chapter Checklist */}
        <div className="lg:col-span-4 space-y-5">
          <PhCard padding="p-5">
            <p className="text-xs font-medium text-[#777777] mb-1">
              Chapter {activeChapter.number}
            </p>
            <h2 className="text-base font-bold text-[#202020] mb-1">{activeChapter.title}</h2>
            <p className="text-xs text-[#555555] leading-relaxed mb-4">
              {activeChapter.subtitle}
            </p>

            <div className="space-y-1.5">
              {activeChapter.lessons.map((lesson, idx) => {
                const isSelected = lesson.id === activeLesson.id;
                const done = completedLessons.includes(lesson.id);
                return (
                  <button
                    key={lesson.id}
                    type="button"
                    onClick={() => setSelectedLessonId(lesson.id)}
                    className={`w-full px-3 py-2.5 rounded-lg text-left flex items-start gap-2.5 transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#FF6154] text-white'
                        : 'hover:bg-[#F7F7F7] text-[#202020]'
                    }`}
                  >
                    {done ? (
                      <CheckCircle2
                        className={`w-4 h-4 shrink-0 mt-0.5 ${
                          isSelected ? 'text-white' : 'text-[#16A34A]'
                        }`}
                      />
                    ) : (
                      <Circle
                        className={`w-4 h-4 shrink-0 mt-0.5 ${
                          isSelected ? 'text-white/75' : 'text-[#CCCCCC]'
                        }`}
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold leading-snug">
                        {idx + 1}. {lesson.title}
                      </p>
                      <p
                        className={`text-[11px] mt-0.5 tabular-nums ${
                          isSelected ? 'text-white/85' : 'text-[#777777]'
                        }`}
                      >
                        {lesson.readMinutes} min read
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </PhCard>

          {/* Actionable Chapter Checklist */}
          <PhCard padding="p-5">
            <h3 className="text-sm font-bold text-[#202020] mb-1">
              Chapter {activeChapter.number} Action Checklist
            </h3>
            <p className="text-xs text-[#777777] mb-4">
              Complete these practical tasks before moving to the next phase.
            </p>
            <div className="space-y-2.5">
              {activeChapter.checklist.map((item) => {
                const checked = completedChecklist.includes(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={savingId === item.id}
                    onClick={() => handleToggleChecklistClick(item.id)}
                    className={`w-full p-3 rounded-lg border text-left flex items-start gap-2.5 transition-colors cursor-pointer ${
                      checked
                        ? 'border-[#BBF7D0] bg-[#F0FDF4] text-[#202020]'
                        : 'border-[#EAEAEA] bg-white hover:bg-[#F7F7F7] text-[#444444]'
                    }`}
                  >
                    {checked ? (
                      <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0 mt-0.5" />
                    ) : (
                      <Circle className="w-4 h-4 text-[#CCCCCC] shrink-0 mt-0.5" />
                    )}
                    <span
                      className={`text-xs leading-relaxed ${
                        checked ? 'line-through text-[#777777]' : ''
                      }`}
                    >
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </PhCard>
        </div>

        {/* Right: Lesson Detail Content */}
        <PhCard className="lg:col-span-8" padding="p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#EAEAEA]">
            <div>
              <div className="flex items-center gap-2 text-xs text-[#777777] mb-1.5">
                <BookOpen className="w-3.5 h-3.5 text-[#FF6154]" />
                <span>
                  Chapter {activeChapter.number}: {activeChapter.title}
                </span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">{activeLesson.readMinutes} min read</span>
              </div>
              <h2 className="text-xl font-bold text-[#202020]">{activeLesson.title}</h2>
            </div>

            <button
              type="button"
              disabled={savingId === activeLesson.id}
              onClick={() => handleToggleLessonClick(activeLesson.id)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                lessonIsDone
                  ? 'bg-[#F0FDF4] border border-[#BBF7D0] text-[#15803D] hover:bg-[#DCFCE7]'
                  : 'bg-[#FF6154] hover:bg-[#E54B3E] text-white'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              {lessonIsDone ? 'Completed' : 'Mark as Complete'}
            </button>
          </div>

          <div className="mt-6 space-y-6">
            <div>
              <h3 className="text-xs font-semibold text-[#777777] mb-2">
                Plain-English Explanation
              </h3>
              <p className="text-sm sm:text-base text-[#333333] leading-relaxed">
                {activeLesson.explanation}
              </p>
            </div>

            {activeLesson.steps && activeLesson.steps.length > 0 && (
              <div className="border border-[#EAEAEA] rounded-xl p-5 bg-white">
                <h3 className="text-xs font-bold text-[#202020] mb-3">Step-by-Step Tutorial</h3>
                <ol className="space-y-2.5">
                  {activeLesson.steps.map((step, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-3 text-sm text-[#444444] leading-relaxed"
                    >
                      <span className="w-5 h-5 rounded-full bg-[#FFF1F0] text-[#FF6154] font-mono text-xs font-bold flex items-center justify-center shrink-0 mt-0.5 tabular-nums">
                        {idx + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            <div className="bg-[#F7F7F7] border border-[#EAEAEA] rounded-xl p-5">
              <h3 className="text-xs font-bold text-[#FF6154] mb-2">Practical Example</h3>
              <p className="text-sm text-[#202020] leading-relaxed">
                {activeLesson.practicalExample}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-[#BBF7D0] bg-[#F0FDF4] rounded-xl p-5">
                <div className="flex items-center gap-2 text-[#15803D] font-bold text-xs mb-3">
                  <ThumbsUp className="w-4 h-4" />
                  <span>Do’s</span>
                </div>
                <ul className="space-y-2.5 text-xs sm:text-sm text-[#333333]">
                  {activeLesson.dos.map((d) => (
                    <li key={d} className="leading-relaxed">
                      • {d}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="border border-[#FFD6D2] bg-[#FFF1F0] rounded-xl p-5">
                <div className="flex items-center gap-2 text-[#CC3D31] font-bold text-xs mb-3">
                  <ThumbsDown className="w-4 h-4" />
                  <span>Don’ts</span>
                </div>
                <ul className="space-y-2.5 text-xs sm:text-sm text-[#333333]">
                  {activeLesson.donts.map((d) => (
                    <li key={d} className="leading-relaxed">
                      • {d}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Inline AI Plain-English Explainer */}
            <div className="border border-[#FFD6D2] bg-[#FFF1F0]/60 rounded-xl p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#FF6154]" />
                  <h3 className="text-xs font-bold text-[#202020]">
                    Ask AI to Explain in Simple English
                  </h3>
                </div>
                <button
                  type="button"
                  disabled={aiLoading}
                  onClick={() => handleAskAiExplain('')}
                  className="px-3.5 py-1.5 rounded-lg bg-[#FF6154] hover:bg-[#E54B3E] text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-60"
                >
                  {aiLoading
                    ? 'Explaining...'
                    : activeProject
                    ? `Apply to ${activeProject.name}`
                    : 'Explain Simply'}
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleAskAiExplain();
                }}
                className="flex flex-col sm:flex-row gap-2"
              >
                <input
                  type="text"
                  maxLength={500}
                  value={aiQuestion}
                  onChange={(e) => setAiQuestion(e.target.value)}
                  placeholder="Optional: ask a specific question about this lesson..."
                  className="flex-1 px-3 py-2 rounded-lg border border-[#EAEAEA] bg-white text-xs text-[#202020] focus:outline-none focus:border-[#FF6154]"
                />
                <button
                  type="submit"
                  disabled={aiLoading || !aiQuestion.trim()}
                  className="px-3.5 py-2 rounded-lg border border-[#EAEAEA] bg-white hover:bg-[#F7F7F7] text-xs font-semibold text-[#202020] cursor-pointer disabled:opacity-50"
                >
                  Ask Coach
                </button>
              </form>

              {aiError && <PhBanner tone="error">{aiError}</PhBanner>}

              {aiExplanation && (
                <div className="p-3.5 rounded-lg bg-white border border-[#FFD6D2] text-xs sm:text-sm text-[#202020] leading-relaxed whitespace-pre-line">
                  {aiExplanation}
                </div>
              )}
            </div>
          </div>
        </PhCard>
      </div>
    </div>
  );
}
