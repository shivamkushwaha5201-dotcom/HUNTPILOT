import React, { useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  Compass,
  FileText,
  Gauge,
  MessageSquare,
  Search,
  Sparkles,
} from 'lucide-react';

interface LandingPageProps {
  isAuthenticated: boolean;
  onNavigateAuth: (mode?: 'login' | 'signup', targetTab?: 'analyzer' | 'academy' | 'dashboard') => void;
  onNavigateWorkspace: (tab: 'dashboard' | 'academy' | 'analyzer') => void;
}

interface SampleTestimonial {
  name: string;
  role: string;
  company: string;
  quote: string;
  outcome: string;
  avatar: string;
  initials: string;
}

const SAMPLE_TESTIMONIALS: SampleTestimonial[] = [
  {
    name: 'Elena Rostova',
    role: 'Co-founder',
    company: 'MetricFlow (Sample Story)',
    quote:
      'Before HuntPilot AI, our draft read like an internal engineering spec. The Launch Analyzer flagged our vague tagline and missing maker story 10 days before launch.',
    outcome: 'Rewrote positioning and completed all 6 Launch Academy checklists before launch day.',
    avatar: '/src/assets/images/founder_avatar_elena_1795508886128.jpg',
    initials: 'ER',
  },
  {
    name: 'Marcus Chen',
    role: 'Indie Maker',
    company: 'DockPulse (Sample Story)',
    quote:
      'It was my first time launching on Product Hunt. Having a plain-English curriculum alongside an AI assistant that remembered my product saved me days of guesswork.',
    outcome: 'Went from blank page to 5 tested taglines, gallery storyboard, and maker comment in one evening.',
    avatar: '/src/assets/images/founder_avatar_marcus_1795508885202.jpg',
    initials: 'MC',
  },
  {
    name: 'Priya Nair',
    role: 'Head of Product',
    company: 'Threadline (Sample Story)',
    quote:
      'Comparing draft versions side-by-side let our whole team align on one clear value proposition instead of debating copy in scattered docs.',
    outcome: 'Improved draft clarity score from 58 to 87 across tagline, USP, and visual plan.',
    avatar: '/src/assets/images/founder_avatar_priya_1795508886579.jpg',
    initials: 'PN',
  },
];

const FAQS = [
  {
    q: 'Does a high Launch Readiness Score guarantee my product will get featured?',
    a: 'No. HuntPilot AI provides an estimated Launch Readiness Score based on copy clarity, audience focus, USP strength, and preparation completeness. Featuring on Product Hunt depends on Product Hunt’s internal systems, editorial decisions, daily competition, and authentic community response.',
  },
  {
    q: 'Is HuntPilot AI useful if I have never launched on Product Hunt before?',
    a: 'Yes. The Product Hunt Launch Academy walks you through 6 structured chapters in plain English—from understanding Makers and Hunters to writing your first comment and following up with early adopters.',
  },
  {
    q: 'How does the Product Hunt MCP integration work?',
    a: 'HuntPilot AI connects server-side to the official Product Hunt Model Context Protocol (MCP) endpoint (https://mcp.producthunt.com/mcp) to power live product search, categories, alternatives, and Live Intelligence leaderboards. Connecting your personal Product Hunt account via OAuth 2.1 unlocks personal launch draft syncing and preview workflows. AI generation features additionally require configuring GEMINI_API_KEY on the server.',
  },
  {
    q: 'Can I start using HuntPilot AI for free?',
    a: 'Yes. HuntPilot AI launches with a Free plan covering the Launch Academy, AI Draft Generator, Launch Analyzer, HuntPilot Assistant, and saved projects. Pro and Agency tiers are planned for future release.',
  },
  {
    q: 'Who can see my product drafts and analysis reports?',
    a: 'Your projects, launch drafts, analysis reports, chat history, and competitor notes are private to your authenticated account and protected by strict database security rules.',
  },
];

function FounderAvatar({ src, alt, initials }: { src: string; alt: string; initials: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className="w-11 h-11 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-semibold shrink-0">
        {initials}
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="w-11 h-11 rounded-full object-cover border border-slate-200 shrink-0"
    />
  );
}

export function LandingPage({
  isAuthenticated,
  onNavigateAuth,
  onNavigateWorkspace,
}: LandingPageProps) {
  const [previewTab, setPreviewTab] = useState<'readiness' | 'draft' | 'academy'>('readiness');
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const handlePrimaryCta = () => {
    if (isAuthenticated) {
      onNavigateWorkspace('analyzer');
    } else {
      onNavigateAuth('signup', 'analyzer');
    }
  };

  const handleAcademyCta = () => {
    if (isAuthenticated) {
      onNavigateWorkspace('academy');
    } else {
      onNavigateAuth('signup', 'academy');
    }
  };

  return (
    <div className="min-h-screen bg-white text-[#0F172A]">
      {/* 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <a
            href="#top"
            className="text-lg font-bold tracking-tight text-[#0F172A] whitespace-nowrap shrink-0"
          >
            HuntPilot AI
          </a>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
            <a href="#features" className="hover:text-[#0F172A] transition-colors whitespace-nowrap shrink-0">
              Features
            </a>
            <a href="#how-it-works" className="hover:text-[#0F172A] transition-colors whitespace-nowrap shrink-0">
              How It Works
            </a>
            <a href="#pricing" className="hover:text-[#0F172A] transition-colors whitespace-nowrap shrink-0">
              Pricing
            </a>
            <a href="#faq" className="hover:text-[#0F172A] transition-colors whitespace-nowrap shrink-0">
              FAQ
            </a>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            {isAuthenticated ? (
              <button
                type="button"
                onClick={() => onNavigateWorkspace('dashboard')}
                className="px-4 py-2 text-sm font-semibold text-white bg-[#6D28D9] hover:bg-[#5B21B6] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Open Workspace
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onNavigateAuth('login', 'dashboard')}
                className="px-4 py-2 text-sm font-semibold text-white bg-[#0F172A] hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section id="top" className="pt-16 pb-20 lg:pt-24 lg:pb-28 border-b border-slate-100">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-6">
              <p className="text-sm font-medium text-[#6D28D9] mb-4">
                Your AI-Powered Product Hunt Launch Partner
              </p>
              <h1
                className="font-bold text-[#0F172A] tracking-tight leading-[1.08] mb-6"
                style={{ fontSize: 'clamp(2.25rem, 4vw, 3.6rem)', textWrap: 'balance' }}
              >
                Launch on Product Hunt with Confidence
              </h1>
              <p className="text-base lg:text-lg text-slate-600 leading-relaxed mb-8 max-w-xl">
                Whether you are launching your very first product or sharpening a flagship v2,
                HuntPilot AI gives you step-by-step launch education, structured draft generation,
                readiness diagnostics, and competitor positioning in one focused workspace.
              </p>

              <div className="flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={handlePrimaryCta}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#EA580C] hover:bg-[#C2410C] text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Analyze My Launch
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleAcademyCta}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-[#0F172A] text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Explore Launch Academy
                </button>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-200 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
                <span>6-Chapter Beginner Academy</span>
                <span aria-hidden="true">·</span>
                <span>Estimated Readiness Scoring</span>
                <span aria-hidden="true">·</span>
                <span>Free Plan Available</span>
              </div>
            </div>

            {/* Interactive Product Dashboard Preview */}
            <div className="lg:col-span-6">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 sm:p-6">
                <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-200">
                  <div>
                    <p className="text-xs font-medium text-slate-500">Interactive Workspace Preview</p>
                    <p className="text-sm font-semibold text-[#0F172A] mt-0.5">
                      Sample Project: PulseBoard Analytics
                    </p>
                  </div>
                  <div className="flex items-center gap-1 p-1 bg-white border border-slate-200 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setPreviewTab('readiness')}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                        previewTab === 'readiness'
                          ? 'bg-[#0F172A] text-white'
                          : 'text-slate-600 hover:text-[#0F172A]'
                      }`}
                    >
                      Analyzer
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewTab('draft')}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                        previewTab === 'draft'
                          ? 'bg-[#0F172A] text-white'
                          : 'text-slate-600 hover:text-[#0F172A]'
                      }`}
                    >
                      Drafts
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewTab('academy')}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                        previewTab === 'academy'
                          ? 'bg-[#0F172A] text-white'
                          : 'text-slate-600 hover:text-[#0F172A]'
                      }`}
                    >
                      Academy
                    </button>
                  </div>
                </div>

                {previewTab === 'readiness' && (
                  <div className="pt-5 space-y-5">
                    <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between gap-6">
                      <div>
                        <p className="text-xs font-medium text-slate-500">
                          Estimated Launch Readiness Score
                        </p>
                        <div className="flex items-baseline gap-2 mt-1">
                          <span className="text-4xl font-bold text-[#0F172A] tabular-nums font-mono">
                            84
                          </span>
                          <span className="text-sm text-slate-500 tabular-nums">/ 100</span>
                        </div>
                        <p className="text-xs text-slate-600 mt-2">
                          Strong tagline clarity · Maker story ready · Needs 2 more gallery slides
                        </p>
                      </div>
                      <div className="w-16 h-16 rounded-xl bg-violet-50 border border-violet-200 flex items-center justify-center shrink-0">
                        <Gauge className="w-8 h-8 text-[#6D28D9]" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { label: 'Tagline Clarity', score: 91 },
                        { label: 'USP Strength', score: 86 },
                        { label: 'Audience Fit', score: 82 },
                        { label: 'Visual Assets', score: 74 },
                      ].map((metric) => (
                        <div key={metric.label} className="bg-white border border-slate-200 rounded-xl p-3.5">
                          <div className="flex items-center justify-between text-xs mb-2">
                            <span className="text-slate-600 font-medium">{metric.label}</span>
                            <span className="font-mono font-semibold text-[#0F172A] tabular-nums">
                              {metric.score}%
                            </span>
                          </div>
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#6D28D9] rounded-full"
                              style={{ width: `${metric.score}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Estimated readiness reflects draft quality and preparation completeness—not featuring probability.
                    </p>
                  </div>
                )}

                {previewTab === 'draft' && (
                  <div className="pt-5 space-y-4">
                    <div className="bg-white border border-slate-200 rounded-xl p-4">
                      <p className="text-xs font-medium text-[#6D28D9] mb-1">Generated Tagline Option 1 of 5</p>
                      <p className="text-sm font-semibold text-[#0F172A]">
                        Turn customer support tickets into weekly product roadmaps
                      </p>
                      <p className="text-xs text-slate-500 mt-1 tabular-nums">59 / 60 characters</p>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-xl p-4">
                      <p className="text-xs font-medium text-[#EA580C] mb-1">First Maker Comment Preview</p>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        “Hey Product Hunt! After spending every Friday manually tagging Intercom threads in spreadsheets, we built PulseBoard to group feature requests automatically...”
                      </p>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-500 px-1">
                      <span>Includes 60s demo script &amp; gallery plan</span>
                      <span className="font-medium text-[#0F172A]">Version v2 saved</span>
                    </div>
                  </div>
                )}

                {previewTab === 'academy' && (
                  <div className="pt-5 space-y-3">
                    {[
                      { ch: 'Chapter 1', title: 'Understanding Product Hunt', status: '5 lessons · Completed' },
                      { ch: 'Chapter 2', title: 'Preparing Your Product', status: '5 lessons · In progress' },
                      { ch: 'Chapter 3', title: 'Creating a Launch Draft', status: '8 lessons · Ready' },
                      { ch: 'Chapter 4', title: 'Pre-Launch Strategy', status: '5 lessons · Up next' },
                    ].map((item) => (
                      <div
                        key={item.ch}
                        className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between gap-4"
                      >
                        <div>
                          <p className="text-xs text-slate-500">{item.ch}</p>
                          <p className="text-sm font-semibold text-[#0F172A]">{item.title}</p>
                        </div>
                        <span className="text-xs text-slate-600 whitespace-nowrap">{item.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Bento Grid */}
      <section id="features" className="py-20 bg-slate-50 border-b border-slate-200">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="max-w-2xl mb-12">
            <p className="text-sm font-medium text-[#6D28D9] mb-2">Platform Capabilities</p>
            <h2 className="text-3xl font-bold text-[#0F172A] tracking-tight mb-4">
              Everything required to go from raw idea to launch-ready page
            </h2>
            <p className="text-slate-600 leading-relaxed">
              Built for first-time founders learning the ropes and experienced makers iterating toward a sharper launch.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-6 gap-5">
            <div className="md:col-span-3 bg-white border border-slate-200 rounded-2xl p-7">
              <div className="w-10 h-10 rounded-lg bg-violet-50 text-[#6D28D9] flex items-center justify-center mb-5">
                <BookOpen className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-semibold text-[#0F172A] mb-2">
                Product Hunt Launch Academy
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed mb-4">
                Six beginner-friendly chapters covering how Product Hunt works, positioning, asset specs, pre-launch outreach, launch-day execution, and post-launch follow-ups—complete with Do’s, Don’ts, and interactive checklists.
              </p>
              <p className="text-xs text-slate-500">
                32 lessons · 18 checklist items · Persistent progress tracking
              </p>
            </div>

            <div className="md:col-span-3 bg-white border border-slate-200 rounded-2xl p-7">
              <div className="w-10 h-10 rounded-lg bg-orange-50 text-[#EA580C] flex items-center justify-center mb-5">
                <Sparkles className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-semibold text-[#0F172A] mb-2">
                AI Launch Draft Generator
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed mb-4">
                Turn product notes into 5 tagline options, a crisp description, an authentic First Maker Comment, suggested topics, gallery slide concepts, a 60-second demo script, and social announcements—then edit, save, and compare versions.
              </p>
              <p className="text-xs text-slate-500">
                Section regeneration · Version comparison · One-click copy
              </p>
            </div>

            <div className="md:col-span-2 bg-white border border-slate-200 rounded-2xl p-7">
              <div className="w-10 h-10 rounded-lg bg-slate-100 text-[#0F172A] flex items-center justify-center mb-5">
                <Gauge className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-semibold text-[#0F172A] mb-2">
                AI Launch Analyzer
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Evaluate your draft across 8 criteria to uncover missing info, weak positioning, and concrete fixes—with an honest Estimated Launch Readiness Score.
              </p>
            </div>

            <div className="md:col-span-2 bg-white border border-slate-200 rounded-2xl p-7">
              <div className="w-10 h-10 rounded-lg bg-violet-50 text-[#6D28D9] flex items-center justify-center mb-5">
                <MessageSquare className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-semibold text-[#0F172A] mb-2">
                HuntPilot Assistant
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                An AI launch strategist that remembers your active project context to rewrite taglines, refine maker comments, and answer beginner questions.
              </p>
            </div>

            <div className="md:col-span-2 bg-white border border-slate-200 rounded-2xl p-7">
              <div className="w-10 h-10 rounded-lg bg-orange-50 text-[#EA580C] flex items-center justify-center mb-5">
                <Search className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-semibold text-[#0F172A] mb-2">
                Competitor Research &amp; MCP
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Map differentiation angles and connect to the official Product Hunt MCP server when configured to pull live launch data into your research.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 border-b border-slate-200">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="max-w-2xl mb-12">
            <p className="text-sm font-medium text-[#EA580C] mb-2">How It Works</p>
            <h2 className="text-3xl font-bold text-[#0F172A] tracking-tight">
              A structured four-step path to launch day
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                step: '01',
                title: 'Learn the Playbook',
                body: 'Start in Launch Academy to understand Product Hunt timing, Makers vs. Hunters, and what makes visitors pause and read.',
                icon: Compass,
              },
              {
                step: '02',
                title: 'Generate Your Assets',
                body: 'Input your product details once to produce taglines, maker comments, gallery ideas, and a demo video script.',
                icon: FileText,
              },
              {
                step: '03',
                title: 'Score & Refine',
                body: 'Submit your complete draft to the Launch Analyzer, spot blind spots across 8 categories, and compare improved versions.',
                icon: Gauge,
              },
              {
                step: '04',
                title: 'Differentiate & Ship',
                body: 'Validate competitor positioning, finalize your pre-launch checklist, and use HuntPilot Assistant for launch-day replies.',
                icon: Sparkles,
              },
            ].map((item) => (
              <div key={item.step} className="pt-4 border-t border-slate-200">
                <span className="font-mono text-xs font-semibold text-[#6D28D9] tabular-nums">
                  {item.step}.
                </span>
                <h3 className="text-base font-semibold text-[#0F172A] mt-3 mb-2">{item.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Sample Testimonials */}
      <section className="py-20 bg-slate-50 border-b border-slate-200">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-12">
            <div>
              <p className="text-sm font-medium text-[#6D28D9] mb-2">
                Sample Founder Stories (Illustrative Examples)
              </p>
              <h2 className="text-3xl font-bold text-[#0F172A] tracking-tight">
                How makers prepare stronger launches
              </h2>
            </div>
            <p className="text-xs text-slate-500 max-w-xs">
              These sample testimonials illustrate typical founder workflows and are labeled as sample examples.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {SAMPLE_TESTIMONIALS.map((t) => (
              <article
                key={t.name}
                className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col justify-between"
              >
                <div>
                  <p className="text-sm text-slate-700 leading-relaxed mb-5">“{t.quote}”</p>
                  <p className="text-xs font-medium text-[#0F172A] mb-6 pt-4 border-t border-slate-100">
                    Outcome: {t.outcome}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <FounderAvatar src={t.avatar} alt={`${t.name} portrait`} initials={t.initials} />
                  <div>
                    <p className="text-sm font-semibold text-[#0F172A]">{t.name}</p>
                    <p className="text-xs text-slate-500">
                      {t.role} · {t.company}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 border-b border-slate-200">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="max-w-2xl mb-12">
            <p className="text-sm font-medium text-[#EA580C] mb-2">Pricing</p>
            <h2 className="text-3xl font-bold text-[#0F172A] tracking-tight mb-3">
              Start free while preparing your launch
            </h2>
            <p className="text-slate-600">
              HuntPilot AI is currently live with the Free plan. Paid Pro and Agency tiers are prepared on our roadmap with payments disabled during early access.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Free */}
            <div className="bg-white border-2 border-[#6D28D9] rounded-2xl p-7 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h3 className="text-lg font-bold text-[#0F172A]">Free</h3>
                  <span className="text-xs font-semibold text-[#6D28D9]">Active Now</span>
                </div>
                <p className="text-xs text-slate-500 mb-4">For first-time makers &amp; indie founders</p>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-bold text-[#0F172A] tabular-nums">$0</span>
                  <span className="text-sm text-slate-500">/ month</span>
                </div>
                <ul className="space-y-3 text-sm text-slate-600 mb-8">
                  {[
                    'Complete 6-chapter Launch Academy',
                    'AI Draft Generator with version saving',
                    'Launch Analyzer with 8-category breakdown',
                    'HuntPilot Assistant with project context',
                    'Competitor Research & MCP readiness',
                  ].map((feat) => (
                    <li key={feat} className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-[#6D28D9] shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <button
                type="button"
                onClick={handlePrimaryCta}
                className="w-full py-2.5 px-4 rounded-lg bg-[#6D28D9] hover:bg-[#5B21B6] text-white text-sm font-semibold transition-colors cursor-pointer"
              >
                Start Free Workspace
              </button>
            </div>

            {/* Pro */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-7 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h3 className="text-lg font-bold text-[#0F172A]">Pro</h3>
                  <span className="text-xs font-medium text-slate-500">Coming Soon</span>
                </div>
                <p className="text-xs text-slate-500 mb-4">For repeat founders &amp; SaaS teams</p>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-bold text-[#0F172A] tabular-nums">$29</span>
                  <span className="text-sm text-slate-500">/ month (planned)</span>
                </div>
                <ul className="space-y-3 text-sm text-slate-600 mb-8">
                  {[
                    'Higher monthly AI generation limits',
                    'Deep multi-draft comparative scoring',
                    'Expanded Competitor Research & MCP queries',
                    'Unlimited saved product launch workspaces',
                  ].map((feat) => (
                    <li key={feat} className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <button
                type="button"
                disabled
                className="w-full py-2.5 px-4 rounded-lg border border-slate-300 bg-white text-slate-400 text-sm font-medium cursor-not-allowed"
              >
                Billing Not Active Yet
              </button>
            </div>

            {/* Agency */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-7 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h3 className="text-lg font-bold text-[#0F172A]">Agency</h3>
                  <span className="text-xs font-medium text-slate-500">Coming Soon</span>
                </div>
                <p className="text-xs text-slate-500 mb-4">For launch studios &amp; venture teams</p>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-bold text-[#0F172A] tabular-nums">$99</span>
                  <span className="text-sm text-slate-500">/ month (planned)</span>
                </div>
                <ul className="space-y-3 text-sm text-slate-600 mb-8">
                  {[
                    'Multi-client launch portfolios',
                    'Exportable client readiness reports',
                    'Shared team collaboration & review notes',
                    'Dedicated client management workspace',
                  ].map((feat) => (
                    <li key={feat} className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <button
                type="button"
                disabled
                className="w-full py-2.5 px-4 rounded-lg border border-slate-300 bg-white text-slate-400 text-sm font-medium cursor-not-allowed"
              >
                Billing Not Active Yet
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20 bg-slate-50 border-b border-slate-200">
        <div className="max-w-[900px] mx-auto px-6">
          <div className="mb-10">
            <p className="text-sm font-medium text-[#6D28D9] mb-2">FAQ</p>
            <h2 className="text-3xl font-bold text-[#0F172A] tracking-tight">
              Common questions from founders
            </h2>
          </div>

          <div className="divide-y divide-slate-200 border border-slate-200 rounded-2xl bg-white overflow-hidden">
            {FAQS.map((item, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div key={item.q}>
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full px-6 py-5 text-left flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <span className="text-sm sm:text-base font-semibold text-[#0F172A]">
                      {item.q}
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-500 shrink-0 transition-transform duration-150 ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-6 pb-5 text-sm text-slate-600 leading-relaxed">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Quiet Footer */}
      <footer className="py-12 bg-white">
        <div className="max-w-[1200px] mx-auto px-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <p className="text-base font-bold text-[#0F172A]">HuntPilot AI</p>
            <p className="text-xs text-slate-500 mt-1">
              Your AI-Powered Product Hunt Launch Partner. Independent launch preparation platform; not affiliated with Product Hunt.
            </p>
          </div>
          <div className="flex items-center gap-6 text-xs font-medium text-slate-600">
            <a href="#features" className="hover:text-[#0F172A]">Features</a>
            <a href="#how-it-works" className="hover:text-[#0F172A]">How It Works</a>
            <a href="#pricing" className="hover:text-[#0F172A]">Pricing</a>
            <a href="#faq" className="hover:text-[#0F172A]">FAQ</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
