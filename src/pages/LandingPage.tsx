import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
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
import { HuntPilotLogo, PhVoteBox } from '../components/ui/PhPrimitives';

interface LandingPageProps {
  isAuthenticated: boolean;
  onNavigateAuth: (
    mode?: 'login' | 'signup',
    targetTab?: 'analyzer' | 'academy' | 'dashboard'
  ) => void;
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
      <div className="w-11 h-11 rounded-full bg-[#FFF1F0] border border-[#FFD6D2] text-[#FF6154] flex items-center justify-center text-xs font-bold shrink-0">
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
      className="w-11 h-11 rounded-full object-cover border border-[#EAEAEA] shrink-0"
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
    <div className="min-h-screen bg-white text-[#202020]">
      {/* 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-40 bg-white border-b border-[#EAEAEA]">
        <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <a href="#top" className="shrink-0">
            <HuntPilotLogo />
          </a>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-[#555555]">
            <a
              href="#features"
              className="hover:text-[#FF6154] transition-colors whitespace-nowrap shrink-0"
            >
              Features
            </a>
            <a
              href="#how-it-works"
              className="hover:text-[#FF6154] transition-colors whitespace-nowrap shrink-0"
            >
              How It Works
            </a>
            <a
              href="#pricing"
              className="hover:text-[#FF6154] transition-colors whitespace-nowrap shrink-0"
            >
              Pricing
            </a>
            <a
              href="#faq"
              className="hover:text-[#FF6154] transition-colors whitespace-nowrap shrink-0"
            >
              FAQ
            </a>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            {isAuthenticated ? (
              <button
                type="button"
                onClick={() => onNavigateWorkspace('dashboard')}
                className="px-4 py-2 text-sm font-semibold text-white bg-[#FF6154] hover:bg-[#E54B3E] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Open Workspace
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onNavigateAuth('login', 'dashboard')}
                className="px-4 py-2 text-sm font-semibold text-white bg-[#FF6154] hover:bg-[#E54B3E] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section id="top" className="pt-14 pb-20 lg:pt-20 lg:pb-24 bg-white border-b border-[#EAEAEA]">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="lg:col-span-6"
            >
              <p className="text-sm font-semibold text-[#FF6154] mb-3.5">
                Your AI-Powered Product Hunt Launch Partner
              </p>
              <h1
                className="font-bold text-[#202020] tracking-tight leading-[1.08] mb-5"
                style={{ fontSize: 'clamp(2.25rem, 4vw, 3.5rem)', textWrap: 'balance' }}
              >
                Launch on Product Hunt with Confidence
              </h1>
              <p className="text-base lg:text-[17px] text-[#555555] leading-relaxed mb-8 max-w-xl">
                Whether you are launching your very first product or sharpening a flagship v2,
                HuntPilot AI gives you step-by-step launch education, structured draft generation,
                readiness diagnostics, and live ecosystem intelligence in one focused workspace.
              </p>

              <div className="flex flex-wrap items-center gap-3.5">
                <button
                  type="button"
                  onClick={handlePrimaryCta}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#FF6154] hover:bg-[#E54B3E] text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-[0_1px_2px_rgba(255,97,84,0.2)]"
                >
                  Analyze My Launch
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleAcademyCta}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-[#EAEAEA] bg-white hover:bg-[#F7F7F7] hover:border-[#D4D4D4] text-[#202020] text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Explore Launch Academy
                </button>
              </div>

              <div className="mt-8 pt-6 border-t border-[#EAEAEA] flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[#777777]">
                <span>6-Chapter Beginner Academy</span>
                <span aria-hidden="true">·</span>
                <span>Estimated Readiness Scoring</span>
                <span aria-hidden="true">·</span>
                <span>Live MCP Leaderboards</span>
                <span aria-hidden="true">·</span>
                <span>Free Plan Available</span>
              </div>
            </motion.div>

            {/* Interactive Product Hunt-Style Workspace Preview */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, delay: 0.06, ease: 'easeOut' }}
              className="lg:col-span-6"
            >
              <div className="bg-[#F7F7F7] border border-[#EAEAEA] rounded-2xl p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#EAEAEA]">
                  <div>
                    <p className="text-xs font-medium text-[#777777]">Interactive Workspace Preview</p>
                    <p className="text-sm font-bold text-[#202020] mt-0.5">
                      Sample Launch: PulseBoard Analytics
                    </p>
                  </div>
                  <div className="flex items-center gap-1 p-1 bg-white border border-[#EAEAEA] rounded-lg">
                    {(
                      [
                        { id: 'readiness', label: 'Analyzer' },
                        { id: 'draft', label: 'Drafts' },
                        { id: 'academy', label: 'Academy' },
                      ] as const
                    ).map((tab) => {
                      const active = previewTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setPreviewTab(tab.id)}
                          className={`relative px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                            active ? 'text-white' : 'text-[#555555] hover:text-[#202020]'
                          }`}
                        >
                          {active && (
                            <motion.span
                              layoutId="landing-preview-tab"
                              transition={{ type: 'spring', stiffness: 450, damping: 34 }}
                              className="absolute inset-0 bg-[#FF6154] rounded-md"
                            />
                          )}
                          <span className="relative z-10">{tab.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {previewTab === 'readiness' && (
                  <div className="pt-5 space-y-4">
                    {/* PH-style Product Card Row */}
                    <div className="bg-white border border-[#EAEAEA] rounded-xl p-5 flex items-center justify-between gap-5">
                      <div className="flex items-start gap-3.5 min-w-0">
                        <div className="w-12 h-12 rounded-xl bg-[#FFF1F0] border border-[#FFD6D2] text-[#FF6154] font-bold text-lg flex items-center justify-center shrink-0">
                          P
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold text-[#FF6154] mb-0.5">
                            Estimated Launch Readiness Score
                          </p>
                          <p className="text-base font-bold text-[#202020] truncate">
                            PulseBoard Analytics
                          </p>
                          <p className="text-xs text-[#666666] mt-1">
                            Strong tagline · Maker story ready · Add 2 gallery slides
                          </p>
                        </div>
                      </div>
                      <PhVoteBox points={84} active />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { label: 'Tagline Clarity', score: 91 },
                        { label: 'USP Strength', score: 86 },
                        { label: 'Audience Fit', score: 82 },
                        { label: 'Visual Assets', score: 74 },
                      ].map((metric) => (
                        <div
                          key={metric.label}
                          className="bg-white border border-[#EAEAEA] rounded-xl p-3.5"
                        >
                          <div className="flex items-center justify-between text-xs mb-2">
                            <span className="text-[#555555] font-medium">{metric.label}</span>
                            <span className="font-mono font-bold text-[#202020] tabular-nums">
                              {metric.score}%
                            </span>
                          </div>
                          <div className="h-1.5 bg-[#F3F3F3] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#FF6154] rounded-full transition-all duration-300"
                              style={{ width: `${metric.score}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    <p className="text-[11px] text-[#777777] leading-relaxed">
                      Estimated readiness reflects draft clarity and preparation completeness—not featuring probability.
                    </p>
                  </div>
                )}

                {previewTab === 'draft' && (
                  <div className="pt-5 space-y-3.5">
                    <div className="bg-white border border-[#EAEAEA] rounded-xl p-4">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="text-xs font-semibold text-[#FF6154]">
                          Generated Tagline Option 1 of 5
                        </p>
                        <span className="text-[11px] font-mono text-[#777777] tabular-nums">
                          59 / 60 chars
                        </span>
                      </div>
                      <p className="text-sm font-bold text-[#202020]">
                        Turn customer support tickets into weekly product roadmaps
                      </p>
                    </div>
                    <div className="bg-white border border-[#EAEAEA] rounded-xl p-4">
                      <p className="text-xs font-semibold text-[#202020] mb-1">
                        First Maker Comment Preview
                      </p>
                      <p className="text-xs text-[#555555] leading-relaxed">
                        “Hey Product Hunt! After spending every Friday manually tagging Intercom threads in spreadsheets, we built PulseBoard to group feature requests automatically...”
                      </p>
                    </div>
                    <div className="flex items-center justify-between text-xs text-[#777777] px-1">
                      <span>Includes 60s demo script &amp; gallery storyboard</span>
                      <span className="font-semibold text-[#202020]">Version v2 saved</span>
                    </div>
                  </div>
                )}

                {previewTab === 'academy' && (
                  <div className="pt-5 space-y-2.5">
                    {[
                      { ch: 'Chapter 1', title: 'Understanding Product Hunt', status: '5 lessons · Completed' },
                      { ch: 'Chapter 2', title: 'Preparing Your Product', status: '5 lessons · In progress' },
                      { ch: 'Chapter 3', title: 'Creating a Launch Draft', status: '8 lessons · Ready' },
                      { ch: 'Chapter 4', title: 'Pre-Launch Strategy', status: '5 lessons · Up next' },
                    ].map((item) => (
                      <div
                        key={item.ch}
                        className="bg-white border border-[#EAEAEA] rounded-xl px-4 py-3 flex items-center justify-between gap-4"
                      >
                        <div>
                          <p className="text-[11px] font-semibold text-[#FF6154]">{item.ch}</p>
                          <p className="text-sm font-bold text-[#202020]">{item.title}</p>
                        </div>
                        <span className="text-xs text-[#777777] whitespace-nowrap">{item.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Bento Grid */}
      <section id="features" className="py-20 bg-[#F7F7F7] border-b border-[#EAEAEA]">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="max-w-2xl mb-12">
            <p className="text-sm font-semibold text-[#FF6154] mb-2">Platform Capabilities</p>
            <h2 className="text-3xl font-bold text-[#202020] tracking-tight mb-3">
              Everything required to go from raw idea to launch-ready page
            </h2>
            <p className="text-[#555555] leading-relaxed">
              Built for first-time makers learning the ropes and experienced founders iterating toward a sharper launch.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-6 gap-5">
            <div className="md:col-span-3 bg-white border border-[#EAEAEA] hover:border-[#D4D4D4] transition-colors rounded-xl p-7">
              <div className="w-10 h-10 rounded-lg bg-[#FFF1F0] border border-[#FFD6D2] text-[#FF6154] flex items-center justify-center mb-5">
                <BookOpen className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-[#202020] mb-2">
                Product Hunt Launch Academy
              </h3>
              <p className="text-sm text-[#555555] leading-relaxed mb-4">
                Six beginner-friendly chapters covering how Product Hunt works, positioning, asset specs, pre-launch outreach, launch-day execution, and post-launch follow-ups—complete with Do’s, Don’ts, and interactive checklists.
              </p>
              <p className="text-xs text-[#777777]">
                32 lessons · 18 checklist items · Persistent progress tracking
              </p>
            </div>

            <div className="md:col-span-3 bg-white border border-[#EAEAEA] hover:border-[#D4D4D4] transition-colors rounded-xl p-7">
              <div className="w-10 h-10 rounded-lg bg-[#FFF1F0] border border-[#FFD6D2] text-[#FF6154] flex items-center justify-center mb-5">
                <Sparkles className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-[#202020] mb-2">
                AI Launch Draft Generator
              </h3>
              <p className="text-sm text-[#555555] leading-relaxed mb-4">
                Turn product notes into 5 tagline options, a crisp description, an authentic First Maker Comment, suggested topics, gallery slide concepts, a 60-second demo script, and social announcements—then edit, save, and compare versions.
              </p>
              <p className="text-xs text-[#777777]">
                Section regeneration · Version comparison · Product Hunt MCP sync
              </p>
            </div>

            <div className="md:col-span-2 bg-white border border-[#EAEAEA] hover:border-[#D4D4D4] transition-colors rounded-xl p-7">
              <div className="w-10 h-10 rounded-lg bg-[#F3F3F3] text-[#202020] flex items-center justify-center mb-5">
                <Gauge className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-[#202020] mb-2">AI Launch Analyzer</h3>
              <p className="text-sm text-[#555555] leading-relaxed">
                Evaluate your draft across 8 criteria to uncover missing info, weak positioning, and concrete fixes—with an honest Estimated Launch Readiness Score.
              </p>
            </div>

            <div className="md:col-span-2 bg-white border border-[#EAEAEA] hover:border-[#D4D4D4] transition-colors rounded-xl p-7">
              <div className="w-10 h-10 rounded-lg bg-[#F3F3F3] text-[#202020] flex items-center justify-center mb-5">
                <MessageSquare className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-[#202020] mb-2">HuntPilot Assistant</h3>
              <p className="text-sm text-[#555555] leading-relaxed">
                An AI launch strategist that remembers your active project context to rewrite taglines, refine maker comments, and answer beginner questions.
              </p>
            </div>

            <div className="md:col-span-2 bg-white border border-[#EAEAEA] hover:border-[#D4D4D4] transition-colors rounded-xl p-7">
              <div className="w-10 h-10 rounded-lg bg-[#FFF1F0] border border-[#FFD6D2] text-[#FF6154] flex items-center justify-center mb-5">
                <Search className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-[#202020] mb-2">
                Live Intelligence &amp; MCP
              </h3>
              <p className="text-sm text-[#555555] leading-relaxed">
                Track live Product Hunt leaderboards, velocity, pulse scores, hunters, and direct competitor comparisons powered by the official Product Hunt MCP server.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 bg-white border-b border-[#EAEAEA]">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="max-w-2xl mb-12">
            <p className="text-sm font-semibold text-[#FF6154] mb-2">How It Works</p>
            <h2 className="text-3xl font-bold text-[#202020] tracking-tight">
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
                body: 'Validate competitor positioning, study live leaderboards, and use HuntPilot Assistant for launch-day replies.',
                icon: Sparkles,
              },
            ].map((item) => (
              <div key={item.step} className="pt-5 border-t border-[#EAEAEA]">
                <span className="font-mono text-xs font-bold text-[#FF6154] tabular-nums">
                  {item.step}.
                </span>
                <h3 className="text-base font-bold text-[#202020] mt-3 mb-2">{item.title}</h3>
                <p className="text-sm text-[#555555] leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Sample Testimonials */}
      <section className="py-20 bg-[#F7F7F7] border-b border-[#EAEAEA]">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-12">
            <div>
              <p className="text-sm font-semibold text-[#FF6154] mb-2">
                Sample Founder Stories (Illustrative Examples)
              </p>
              <h2 className="text-3xl font-bold text-[#202020] tracking-tight">
                How makers prepare stronger launches
              </h2>
            </div>
            <p className="text-xs text-[#777777] max-w-xs">
              These sample testimonials illustrate typical founder workflows and are labeled as sample examples.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {SAMPLE_TESTIMONIALS.map((t) => (
              <article
                key={t.name}
                className="bg-white border border-[#EAEAEA] rounded-xl p-6 flex flex-col justify-between"
              >
                <div>
                  <p className="text-sm text-[#444444] leading-relaxed mb-5">“{t.quote}”</p>
                  <p className="text-xs font-medium text-[#202020] mb-6 pt-4 border-t border-[#F0F0F0]">
                    Outcome: {t.outcome}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <FounderAvatar src={t.avatar} alt={`${t.name} portrait`} initials={t.initials} />
                  <div>
                    <p className="text-sm font-bold text-[#202020]">{t.name}</p>
                    <p className="text-xs text-[#777777]">
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
      <section id="pricing" className="py-20 bg-white border-b border-[#EAEAEA]">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="max-w-2xl mb-12">
            <p className="text-sm font-semibold text-[#FF6154] mb-2">Pricing</p>
            <h2 className="text-3xl font-bold text-[#202020] tracking-tight mb-3">
              Start free while preparing your launch
            </h2>
            <p className="text-[#555555]">
              HuntPilot AI is currently live with the Free plan. Paid Pro and Agency tiers are prepared on our roadmap with payments disabled during early access.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Free */}
            <div className="bg-white border-2 border-[#FF6154] rounded-2xl p-7 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h3 className="text-lg font-bold text-[#202020]">Free</h3>
                  <span className="text-xs font-semibold text-[#FF6154]">Active Now</span>
                </div>
                <p className="text-xs text-[#777777] mb-4">For first-time makers &amp; indie founders</p>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-bold text-[#202020] tabular-nums">$0</span>
                  <span className="text-sm text-[#777777]">/ month</span>
                </div>
                <ul className="space-y-3 text-sm text-[#555555] mb-8">
                  {[
                    'Complete 6-chapter Launch Academy',
                    'AI Draft Generator with version saving',
                    'Launch Analyzer with 8-category breakdown',
                    'HuntPilot Assistant with project context',
                    'Live Intelligence & Product Hunt MCP explorer',
                  ].map((feat) => (
                    <li key={feat} className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-[#FF6154] shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <button
                type="button"
                onClick={handlePrimaryCta}
                className="w-full py-2.5 px-4 rounded-lg bg-[#FF6154] hover:bg-[#E54B3E] text-white text-sm font-semibold transition-colors cursor-pointer"
              >
                Start Free Workspace
              </button>
            </div>

            {/* Pro */}
            <div className="bg-[#F7F7F7] border border-[#EAEAEA] rounded-2xl p-7 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h3 className="text-lg font-bold text-[#202020]">Pro</h3>
                  <span className="text-xs font-medium text-[#777777]">Coming Soon</span>
                </div>
                <p className="text-xs text-[#777777] mb-4">For repeat founders &amp; SaaS teams</p>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-bold text-[#202020] tabular-nums">$29</span>
                  <span className="text-sm text-[#777777]">/ month (planned)</span>
                </div>
                <ul className="space-y-3 text-sm text-[#555555] mb-8">
                  {[
                    'Higher monthly AI generation limits',
                    'Deep multi-draft comparative scoring',
                    'Expanded Competitor Research & MCP queries',
                    'Unlimited saved product launch workspaces',
                  ].map((feat) => (
                    <li key={feat} className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-[#777777] shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <button
                type="button"
                disabled
                className="w-full py-2.5 px-4 rounded-lg border border-[#EAEAEA] bg-white text-[#999999] text-sm font-medium cursor-not-allowed"
              >
                Billing Not Active Yet
              </button>
            </div>

            {/* Agency */}
            <div className="bg-[#F7F7F7] border border-[#EAEAEA] rounded-2xl p-7 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h3 className="text-lg font-bold text-[#202020]">Agency</h3>
                  <span className="text-xs font-medium text-[#777777]">Coming Soon</span>
                </div>
                <p className="text-xs text-[#777777] mb-4">For launch studios &amp; venture teams</p>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-bold text-[#202020] tabular-nums">$99</span>
                  <span className="text-sm text-[#777777]">/ month (planned)</span>
                </div>
                <ul className="space-y-3 text-sm text-[#555555] mb-8">
                  {[
                    'Multi-client launch portfolios',
                    'Exportable client readiness reports',
                    'Shared team collaboration & review notes',
                    'Dedicated client management workspace',
                  ].map((feat) => (
                    <li key={feat} className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-[#777777] shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <button
                type="button"
                disabled
                className="w-full py-2.5 px-4 rounded-lg border border-[#EAEAEA] bg-white text-[#999999] text-sm font-medium cursor-not-allowed"
              >
                Billing Not Active Yet
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20 bg-[#F7F7F7] border-b border-[#EAEAEA]">
        <div className="max-w-[900px] mx-auto px-6">
          <div className="mb-10">
            <p className="text-sm font-semibold text-[#FF6154] mb-2">FAQ</p>
            <h2 className="text-3xl font-bold text-[#202020] tracking-tight">
              Common questions from founders
            </h2>
          </div>

          <div className="divide-y divide-[#EAEAEA] border border-[#EAEAEA] rounded-2xl bg-white overflow-hidden">
            {FAQS.map((item, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div key={item.q}>
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full px-6 py-5 text-left flex items-center justify-between gap-4 hover:bg-[#FAFAFA] transition-colors cursor-pointer"
                  >
                    <span
                      className={`text-sm sm:text-base font-semibold ${
                        isOpen ? 'text-[#FF6154]' : 'text-[#202020]'
                      }`}
                    >
                      {item.q}
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 shrink-0 transition-transform duration-150 ${
                        isOpen ? 'rotate-180 text-[#FF6154]' : 'text-[#777777]'
                      }`}
                    />
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.16, ease: 'easeOut' }}
                        className="overflow-hidden"
                      >
                        <div className="px-6 pb-5 text-sm text-[#555555] leading-relaxed">
                          {item.a}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Quiet Footer */}
      <footer className="py-12 bg-white">
        <div className="max-w-[1200px] mx-auto px-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="space-y-2">
            <HuntPilotLogo size="sm" />
            <p className="text-xs text-[#777777]">
              Your AI-Powered Product Hunt Launch Partner. Independent launch preparation platform; not affiliated with Product Hunt.
            </p>
          </div>
          <div className="flex items-center gap-6 text-xs font-medium text-[#555555]">
            <a href="#features" className="hover:text-[#FF6154] transition-colors">
              Features
            </a>
            <a href="#how-it-works" className="hover:text-[#FF6154] transition-colors">
              How It Works
            </a>
            <a href="#pricing" className="hover:text-[#FF6154] transition-colors">
              Pricing
            </a>
            <a href="#faq" className="hover:text-[#FF6154] transition-colors">
              FAQ
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
