export interface AcademyLesson {
  id: string;
  title: string;
  readMinutes: number;
  explanation: string;
  steps: string[];
  practicalExample: string;
  dos: string[];
  donts: string[];
}

export interface AcademyChecklistItem {
  id: string;
  label: string;
}

export interface AcademyChapter {
  id: string;
  number: number;
  title: string;
  subtitle: string;
  lessons: AcademyLesson[];
  checklist: AcademyChecklistItem[];
}

export const ACADEMY_CHAPTERS: AcademyChapter[] = [
  {
    id: 'ch1',
    number: 1,
    title: 'Understanding Product Hunt',
    subtitle: 'Learn how Product Hunt works, who is in the community, and what actually drives meaningful visibility.',
    lessons: [
      {
        id: 'ch1_l1',
        title: 'What is Product Hunt?',
        readMinutes: 3,
        explanation:
          'Product Hunt is a daily curation platform where founders, makers, and indie builders share new software products, tools, and apps. Every 24-hour cycle (starting at 12:01 AM Pacific Time), newly launched products compete for attention, feedback, and early adopters.',
        steps: [
          'Create a personal Product Hunt account using your real name and photo.',
          'Spend 10 minutes each morning for 5 days browsing the daily homepage.',
          'Click through 3 launches in your category and study how they explain their product.',
        ],
        practicalExample:
          'Think of Product Hunt like an interactive daily magazine for builders. An early-stage scheduling tool can launch alongside a major AI startup and win real users if its value is clear in 5 seconds.',
        dos: [
          'Treat Product Hunt as a discovery and feedback milestone, not the end of marketing.',
          'Browse the homepage for 5–10 days before your own launch to see what resonates.',
        ],
        donts: [
          'Expect Product Hunt alone to solve product-market fit.',
          'Launch without visiting Product Hunt and commenting on other products first.',
        ],
      },
      {
        id: 'ch1_l2',
        title: 'How does Product Hunt work?',
        readMinutes: 4,
        explanation:
          'Each day resets at 12:01 AM PT. Products go live on the "Newest" feed, and selected products appear on the featured homepage feed. During the first few hours of the day, upvote counts are hidden so visitors judge products on merit rather than bandwagon momentum.',
        steps: [
          'Convert 12:01 AM Pacific Time into your local timezone before scheduling.',
          'Schedule your launch at least 48 hours ahead so all links and media are verified.',
          'Plan team coverage across the first 4 hours (blind voting window) and US/EU mornings.',
        ],
        practicalExample:
          'If you schedule your launch for 12:01 AM PT on a Tuesday, your product has a full 24-hour window to gather authentic comments, questions, and upvotes across global timezones.',
        dos: [
          'Schedule your launch right at 12:01 AM Pacific Time so you get the full 24-hour day.',
          'Prepare all assets and your first maker comment before starting your launch shift.',
        ],
        donts: [
          'Launch at 3 PM PT and lose 15 hours of the daily cycle.',
          'Ignore the early hours when vote counts are hidden—engagement matters most then.',
        ],
      },
      {
        id: 'ch1_l3',
        title: 'What are Makers, Hunters and supporters?',
        readMinutes: 3,
        explanation:
          'Makers are the people who built the product. A Hunter is the user who submits ("hunts") the product page—though today, Makers routinely hunt their own products with zero disadvantage. Supporters are community members, early testers, and peers who leave thoughtful reviews and feedback.',
        steps: [
          'Have every co-founder, designer, and engineer create a Product Hunt profile.',
          'Decide whether you will self-hunt (recommended for most teams) or partner with an existing supporter.',
          'Link all Maker profiles during draft submission so everyone can respond with a Maker badge.',
        ],
        practicalExample:
          'Many top launches are self-hunted by their founders. Having your co-founder, designer, and engineer all listed as Makers shows authenticity and lets multiple people reply to comments.',
        dos: [
          'List everyone who contributed to building the product in the Makers section.',
          'Self-hunt if you do not have an organic relationship with a well-known hunter.',
        ],
        donts: [
          'Pay money to someone promising a "guaranteed #1 spot" for hunting your product.',
          'Forget to verify your Maker profiles before launch day.',
        ],
      },
      {
        id: 'ch1_l4',
        title: 'How does featuring work?',
        readMinutes: 4,
        explanation:
          'Not every submitted product automatically appears on the main Featured homepage feed—many start in the "All" / "Newest" section. Product Hunt’s internal systems and editorial team decide which launches get featured based on completeness, genuine utility, community compliance, and quality signals.',
        steps: [
          'Verify your landing page loads quickly and lets visitors test or understand the product immediately.',
          'Complete every Product Hunt listing field: tagline, description, topics, thumbnail, gallery, and maker comment.',
          'Follow Product Hunt community rules strictly—no vote trading, automation, or paid upvote services.',
        ],
        practicalExample:
          'A complete listing with crisp screenshots, a working live demo, no spammy behavior, and an authentic maker story has a much cleaner profile than a rushed page with a broken link.',
        dos: [
          'Complete every section of your launch page thoroughly and honestly.',
          'Make sure anyone clicking your website link can try or understand the product immediately.',
        ],
        donts: [
          'Assume any third-party tool can guarantee featuring.',
          'Use fake accounts, vote rings, or automated upvote bots—this leads to demotion or removal.',
        ],
      },
      {
        id: 'ch1_l5',
        title: 'The difference between upvotes and engagement',
        readMinutes: 3,
        explanation:
          'Raw upvotes from brand-new accounts carry far less weight than genuine engagement from active Product Hunt members. Thoughtful comments, detailed maker replies, and real product feedback spark conversations that keep visitors interested and help convert views into signups.',
        steps: [
          'End your First Maker Comment with 1–2 specific questions inviting honest critique.',
          'Reply to every comment with context, not just "Thanks!"—ask follow-up questions.',
          'Invite existing beta users to share what problem your product solved for them.',
        ],
        practicalExample:
          'A launch with 180 upvotes and 55 genuine back-and-forth comments often drives more trial signups and press interest than a launch with 400 quiet upvotes and 4 generic "Congrats!" comments.',
        dos: [
          'Ask open-ended questions in your maker comment to invite real feedback.',
          'Reply thoughtfully to every comment, even critical ones.',
        ],
        donts: [
          'Blast cold DMs begging strangers to "upvote us!" without context.',
          'Ask friends to create brand-new accounts on launch morning just to click upvote.',
        ],
      },
    ],
    checklist: [
      { id: 'ch1_c1', label: 'Create and complete your personal Product Hunt Maker profile' },
      { id: 'ch1_c2', label: 'Browse 5 recent launches in your category and leave 2 genuine comments' },
      { id: 'ch1_c3', label: 'Understand the 12:01 AM PT daily launch reset window' },
    ],
  },
  {
    id: 'ch2',
    number: 2,
    title: 'Preparing Your Product',
    subtitle: 'Clarify your positioning, define your audience, and sharpen what makes your product worth trying today.',
    lessons: [
      {
        id: 'ch2_l1',
        title: 'Product positioning',
        readMinutes: 4,
        explanation:
          'Positioning answers: "What is this, who is it for, and why does it matter right now?" On Product Hunt, visitors scan dozens of products in seconds. If they cannot tell what category your tool lives in within 3 seconds, they scroll past.',
        steps: [
          'Write down the existing category or workflow your users already know.',
          'Draft a plain-English one-liner: "[Product] helps [Audience] achieve [Outcome] without [Pain]."',
          'Test your one-liner on 3 peers who have never seen your product and ask what they think it does.',
        ],
        practicalExample:
          'Weak: "An AI-powered workspace for modern teams." Strong: "Turn messy user interview recordings into prioritized product specs in 2 minutes."',
        dos: [
          'Anchor your product to a concrete workflow or painful task users already recognize.',
          'Lead with the core outcome rather than internal technical architecture.',
        ],
        donts: [
          'Use vague buzzwords like "next-gen", "all-in-one", or "revolutionary".',
          'Try to target every industry on your first launch.',
        ],
      },
      {
        id: 'ch2_l2',
        title: 'Target audience',
        readMinutes: 3,
        explanation:
          'The narrower your primary audience on launch day, the easier it is for the right early adopters to say "Wait—that is literally for me." You can expand later, but sharp focus wins early traction.',
        steps: [
          'Name 1 primary user persona (role, company size, daily workflow).',
          'List the exact trigger moment when they realize they need a tool like yours.',
          'Align your screenshots and sample data with that persona’s real-world use case.',
        ],
        practicalExample:
          'Instead of "marketers everywhere", target "B2B SaaS founders writing weekly product changelogs".',
        dos: [
          'Write down 1 primary persona and 1 secondary persona before writing copy.',
          'Match your examples and screenshots to that exact persona’s daily workflow.',
        ],
        donts: [
          'Say "everyone can use this"—when you speak to everyone, no one feels urgency.',
        ],
      },
      {
        id: 'ch2_l3',
        title: 'Finding your unique selling point (USP)',
        readMinutes: 4,
        explanation:
          'Your USP is the single clear reason someone should try your product instead of staying with spreadsheets, ChatGPT, or an incumbent competitor. It might be speed, simplicity, pricing transparency, privacy, or a specialized workflow.',
        steps: [
          'List the top 2 alternatives your audience currently uses (including manual spreadsheets).',
          'Identify the single biggest friction point in those alternatives.',
          'Turn that advantage into a concrete claim you can demonstrate in your first 2 gallery images.',
        ],
        practicalExample:
          'If Notion and Linear already exist, a new tracker’s USP might be: "Zero-setup bug reporting directly from Slack threads with automatic browser logs."',
        dos: [
          'State your differentiator in plain language in both your description and maker comment.',
          'Back up your USP visually in your first two gallery screenshots.',
        ],
        donts: [
          'Claim "we have better UI" as your only differentiator—show what problem that UI removes.',
        ],
      },
      {
        id: 'ch2_l4',
        title: 'Competitor research',
        readMinutes: 4,
        explanation:
          'Researching similar Product Hunt launches shows you which taglines worked, what objections commenters raised in the comments section, and what gaps competitors left open.',
        steps: [
          'Search 3–5 similar products in your category inside HuntPilot’s Competitor Research workspace.',
          'Note how they framed their taglines and which topics they selected.',
          'Read user questions on competing launches and answer those objections directly in your maker comment.',
        ],
        practicalExample:
          'Read the comment threads on 3 competing products launched in the past year. If users kept asking "Does this support self-hosting?" or "Is there a free tier?", address that upfront in your launch.',
        dos: [
          'Study competitor taglines, gallery structure, and common user questions.',
          'Use HuntPilot’s Competitor Research workspace to map differentiation angles.',
        ],
        donts: [
          'Copy a competitor’s tagline word-for-word.',
          'Badmouth competitors in your launch copy—focus on user pain instead.',
        ],
      },
      {
        id: 'ch2_l5',
        title: 'Preparing a launch strategy',
        readMinutes: 4,
        explanation:
          'Decide your goal before picking a launch date: are you optimizing for early beta signups, honest feedback, developer adoption, or brand awareness? Choose a launch day (Tue–Thu are highest traffic and highest competition; Fri–Sun are quieter with easier visibility) aligned with your capacity.',
        steps: [
          'Pick one primary launch goal (e.g., 150 qualified free signups or 30 detailed feedback threads).',
          'Choose a launch day 2+ weeks out based on your audience availability.',
          'Decide on a Product Hunt welcome offer (e.g., extended trial or early-maker discount) for visitors.',
        ],
        practicalExample:
          'A solo indie maker launching a free developer CLI tool may pick a Tuesday for maximum developer traffic, whereas a bootstrapped niche B2B tool might launch on Sunday to reach Product of the Day with less noise.',
        dos: [
          'Pick a date at least 2 weeks out so your team can prepare assets calmly.',
          'Prepare a special Product Hunt welcome offer or extended trial on your landing page.',
        ],
        donts: [
          'Schedule launch day during a holiday or major conference when your team is offline.',
        ],
      },
    ],
    checklist: [
      { id: 'ch2_c1', label: 'Write a 1-sentence positioning statement (Who + Problem + Outcome)' },
      { id: 'ch2_c2', label: 'Identify 3–5 similar products and list how your USP differs' },
      { id: 'ch2_c3', label: 'Choose your target launch window (Tuesday–Thursday vs Weekend strategy)' },
    ],
  },
  {
    id: 'ch3',
    number: 3,
    title: 'Creating a Launch Draft',
    subtitle: 'Master every single field on the Product Hunt submission form—from tagline to first maker comment.',
    lessons: [
      {
        id: 'ch3_l1',
        title: 'Product name',
        readMinutes: 2,
        explanation:
          'Use your clean product brand name only. Do not stuff keywords, emojis, or slogans into the Product Name field.',
        steps: [
          'Enter your exact brand name matching your website header.',
          'Remove any subtitles, version hype, or decorative symbols.',
        ],
        practicalExample:
          'Good: "HuntPilot AI". Bad: "HuntPilot AI — Best #1 Product Hunt Launch Tool 🚀".',
        dos: ['Keep your product name identical to your website header and domain.'],
        donts: ['Stuff taglines or promotional emojis into the product name field.'],
      },
      {
        id: 'ch3_l2',
        title: 'Tagline (60 characters max)',
        readMinutes: 4,
        explanation:
          'Your tagline is the highest-leverage 60 characters of your launch. It appears right beneath your name on the homepage feed. Aim for immediate comprehension: verb + outcome + target context.',
        steps: [
          'Generate 5 distinct tagline options in HuntPilot’s Draft Generator.',
          'Trim any fluff words so every option stays under 60 characters.',
          'Pick the one a stranger understands fastest without opening your website.',
        ],
        practicalExample:
          'Good: "Prepare and score your Product Hunt launch with AI" (51 chars). Bad: "The ultimate AI paradigm shift for startup founders."',
        dos: [
          'Stay strictly under 60 characters so it never truncates.',
          'Test 5 variations using HuntPilot’s Draft Generator and read them aloud.',
        ],
        donts: [
          'Use clever puns that hide what your product actually does.',
          'Use all caps or excessive punctuation.',
        ],
      },
      {
        id: 'ch3_l3',
        title: 'Product description',
        readMinutes: 3,
        explanation:
          'Your description appears when someone clicks into your product card. Keep it crisp (150–260 characters is often ideal for the core summary) and focus on the main problem, how your product solves it, and who benefits.',
        steps: [
          'Sentence 1: State who it is for and the core problem.',
          'Sentence 2: Explain how your product solves it in concrete terms.',
          'Sentence 3: Highlight the biggest differentiator or what users get for free.',
        ],
        practicalExample:
          'Explain the core workflow in 2–3 plain sentences so a busy founder understands what happens after they click "Visit Website".',
        dos: ['Write in active, plain English and mention concrete capabilities.'],
        donts: ['Paste a 500-word press release into the description box.'],
      },
      {
        id: 'ch3_l4',
        title: 'Topics and categories',
        readMinutes: 2,
        explanation:
          'Choose 3 to 4 accurate topics (for example: SaaS, Artificial Intelligence, Productivity, Developer Tools). Accurate topics connect your product to followers of those categories and weekly digest newsletters.',
        steps: [
          'Select 1 primary category topic that describes what your product is.',
          'Add 2–3 supporting topics describing who uses it or the core workflow.',
        ],
        practicalExample:
          'If you built an API monitoring tool, pick Developer Tools, SaaS, and Productivity rather than unrelated high-volume tags.',
        dos: ['Select 3–4 tightly relevant topics.'],
        donts: ['Pick irrelevant topics just because they look popular.'],
      },
      {
        id: 'ch3_l5',
        title: 'Thumbnail (240×240px)',
        readMinutes: 3,
        explanation:
          'Your square thumbnail sits next to your name in the feed. Simple, high-contrast logos or clean marks read best at small sizes. Subtle motion GIFs are allowed, but avoid flashing or chaotic animations.',
        steps: [
          'Export a clean 240×240px square PNG or subtle GIF.',
          'Zoom out to 25% on your screen to confirm the mark stays crisp at 48×48px.',
        ],
        practicalExample:
          'A crisp geometric logo mark on a clean navy or vibrant purple background stands out immediately in a sea of white boxes.',
        dos: ['Check how your thumbnail looks scaled down to 48×48px on mobile.'],
        donts: ['Put tiny unreadable text inside your 240×240 thumbnail.'],
      },
      {
        id: 'ch3_l6',
        title: 'Gallery images (1270×760px)',
        readMinutes: 4,
        explanation:
          'Gallery images tell your visual story. Upload 4 to 6 crisp 1270×760 slides: Slide 1 should be your hero value proposition + clean product screenshot; Slides 2–4 should spotlight key workflows with short, readable captions; Slide 5 can show social proof or a clear call to action.',
        steps: [
          'Design 4–6 slides at exactly 1270×760px resolution.',
          'Add a bold 5–8 word headline above each clean UI screenshot.',
          'Put your clearest before/after or main workspace view on Slide 1.',
        ],
        practicalExample:
          'Think of your gallery as a 5-slide pitch deck with real UI—never raw uncropped browser tabs with tiny 8px fonts.',
        dos: [
          'Use 1270×760px aspect ratio with bold 1-line captions above real UI views.',
          'Put your strongest, clearest visual first.',
        ],
        donts: ['Upload blurry screenshots or dark unreadable text overlays.'],
      },
      {
        id: 'ch3_l7',
        title: 'Demo video',
        readMinutes: 3,
        explanation:
          'A short 45–90 second demo video embedded as your first gallery item builds instant trust. Show the real product solving a real task—skip 15-second animated logo intros.',
        steps: [
          'Use the 60-second script from HuntPilot’s Draft Generator.',
          'Record a clean 1080p screen walkthrough showing the real UI within 5 seconds.',
          'Add clear burned-in captions since most visitors watch muted first.',
        ],
        practicalExample:
          '0:00–0:08 Show the pain point -> 0:08–0:45 Screen recording walking through the magic moment -> 0:45–1:00 Where to try it free.',
        dos: ['Show real software within the first 5 seconds and add captions for muted viewers.'],
        donts: ['Spend 20 seconds on abstract motion graphics before showing the UI.'],
      },
      {
        id: 'ch3_l8',
        title: 'First maker comment',
        readMinutes: 4,
        explanation:
          'Your first maker comment is pinned right below your gallery and sets the tone for the entire comment section. Introduce yourself, share why you built the product, outline who it helps, mention any special Product Hunt offer, and ask one specific question.',
        steps: [
          'Open with a warm personal hello and the exact problem that triggered building it.',
          'Summarize 3 concrete things visitors can try right now.',
          'Close with a specific feedback question and save it in HuntPilot ready to paste at 12:01 AM PT.',
        ],
        practicalExample:
          '"Hey Product Hunt! I’m Alex, and I built X after spending 12 hours prepping our last launch..." followed by bulleted takeaways and a genuine invitation for feedback.',
        dos: [
          'Post your maker comment within 2 minutes of your launch going live.',
          'Be transparent about current limitations and what you are building next.',
        ],
        donts: ['Post a robotic sales pitch or forget to invite conversation.'],
      },
    ],
    checklist: [
      { id: 'ch3_c1', label: 'Finalize a <= 60 character tagline and crisp description' },
      { id: 'ch3_c2', label: 'Export 240×240 thumbnail and 4–6 1270×760 gallery slides' },
      { id: 'ch3_c3', label: 'Write and proofread your First Maker Comment ahead of launch day' },
    ],
  },
  {
    id: 'ch4',
    number: 4,
    title: 'Pre-Launch Strategy',
    subtitle: 'Build momentum ethically before launch day so your launch starts with real people who care.',
    lessons: [
      {
        id: 'ch4_l1',
        title: 'Building an audience before launch',
        readMinutes: 4,
        explanation:
          'Share your build-in-public progress 2–4 weeks before launch. Short product demos, behind-the-scenes decisions, and honest milestones help people feel invested in your launch day.',
        steps: [
          'Publish your Product Hunt Coming Soon teaser page 10–14 days before launch.',
          'Share 2 short workflow demos per week on X or LinkedIn.',
          'Collect interested followers on the teaser page so Product Hunt notifies them at launch.',
        ],
        practicalExample:
          'Post 2 weekly updates on X, LinkedIn, or relevant builder communities showing a problem you solved and linking your Product Hunt teaser ("Notify Me") page.',
        dos: ['Set up a Product Hunt Coming Soon teaser page 1–2 weeks early.'],
        donts: ['Stay completely silent until launch morning and hope strangers discover you.'],
      },
      {
        id: 'ch4_l2',
        title: 'Preparing your community & supporters',
        readMinutes: 3,
        explanation:
          'Make a clean list of early beta users, friends in tech, newsletter subscribers, and peers who genuinely know your product. Let them know your launch date in advance and ask for honest feedback—not blind upvotes.',
        steps: [
          'Build a list of 20–50 people who have actually tested your product or followed your build.',
          'Send a friendly heads-up 3 days before launch with the date.',
          'On launch morning, share the link and ask for honest feedback in the comments.',
        ],
        practicalExample:
          'Send a short personal note: "We’re launching on Product Hunt this Wednesday! Would love your honest thoughts on our new onboarding flow in the comments."',
        dos: ['Ask supporters to share honest feedback and check out the product page.'],
        donts: ['Use automated mass-DM tools or buy upvote packages.'],
      },
      {
        id: 'ch4_l3',
        title: 'Finding early users',
        readMinutes: 3,
        explanation:
          'Before launching on Product Hunt, get at least 10–25 real people using your product. Their feedback fixes embarrassing signup bugs, and their real stories become your best social proof.',
        steps: [
          'Watch 5 target users sign up and use your product live without your help.',
          'Fix every confusing button, broken redirect, or slow loading screen they hit.',
          'Ask 2 happy beta testers if you can quote their feedback in your launch assets.',
        ],
        practicalExample:
          'Run 5 quick onboarding calls with target users a week prior so your landing page and signup flow are rock-solid under launch traffic.',
        dos: ['Test your signup flow, pricing page, and mobile responsiveness end-to-end.'],
        donts: ['Launch a broken onboarding flow or gated waitlist when visitors expect to try the app.'],
      },
      {
        id: 'ch4_l4',
        title: 'Creating social media announcements',
        readMinutes: 3,
        explanation:
          'Draft your launch morning posts for X, LinkedIn, newsletter, and community Slack/Discord groups 48 hours beforehand. Keep each post tailored to that platform rather than copy-pasting identical links.',
        steps: [
          'Generate your base announcement in HuntPilot’s Draft Generator.',
          'Customize one version for X (visual + short story), one for LinkedIn (lessons learned), and one for email.',
          'Schedule or stage them so launch morning takes 5 minutes instead of 2 hours.',
        ],
        practicalExample:
          'Write a founder-story thread for X, a concise lessons-learned post for LinkedIn, and a short personal email to your beta waitlist.',
        dos: ['Include a 20-second demo clip or crisp product visual in your social posts.'],
        donts: ['Spend 3 hours on launch morning trying to write social copy from scratch.'],
      },
      {
        id: 'ch4_l5',
        title: 'Pre-launch readiness checklist',
        readMinutes: 3,
        explanation:
          'Do a final 24-hour dry run: check server scaling, analytics tracking, support chat widget, Product Hunt draft preview, and team timezone coverage.',
        steps: [
          'Run your full draft through HuntPilot’s Launch Analyzer to catch missing assets or weak copy.',
          'Verify your website URL, SSL certificate, signup flow, and mobile layout.',
          'Lock production deployments 12 hours before launch.',
        ],
        practicalExample:
          'Verify that clicking your Product Hunt "Visit" button lands directly on a fast, clear page with zero broken images or auth errors.',
        dos: ['Run your draft through HuntPilot’s Launch Analyzer to catch missing details.'],
        donts: ['Push risky database migrations 2 hours before midnight Pacific Time.'],
      },
    ],
    checklist: [
      { id: 'ch4_c1', label: 'Publish Product Hunt Coming Soon page and share teaser link' },
      { id: 'ch4_c2', label: 'Pre-draft launch emails and social announcements for launch day' },
      { id: 'ch4_c3', label: 'Test signup, onboarding, and server stability with 5+ early users' },
    ],
  },
  {
    id: 'ch5',
    number: 5,
    title: 'Launch Day',
    subtitle: 'Execute a calm, responsive 24-hour launch day focused on conversations, clarity, and reliability.',
    lessons: [
      {
        id: 'ch5_l1',
        title: 'Launch timing & morning execution',
        readMinutes: 3,
        explanation:
          'When your scheduled launch goes live at 12:01 AM PT, verify the page immediately, post your Maker Comment right away, and confirm all gallery images and video links render cleanly.',
        steps: [
          'Open your live Product Hunt link at 12:01 AM PT and test the Visit Website button.',
          'Paste and publish your First Maker Comment immediately.',
          'Confirm all Makers are tagged and gallery slides/video play smoothly.',
        ],
        practicalExample:
          'Set an alarm or assign one co-founder to handle the 12:01 AM PT go-live check, then rotate shifts with another teammate for European and US morning waves.',
        dos: ['Verify your listing and post your Maker Comment within minutes of go-live.'],
        donts: ['Sleep through the first 6 hours without anyone watching comments or bugs.'],
      },
      {
        id: 'ch5_l2',
        title: 'Maker comment & early tone',
        readMinutes: 3,
        explanation:
          'Your Maker Comment anchors the discussion. Stay active right after posting it so the earliest visitors see an engaged, approachable founder ready to answer questions.',
        steps: [
          'Check comments every 15 minutes during the first 3 hours.',
          'Answer technical and pricing questions transparently.',
          'Thank early commenters by name and engage with their specific point.',
        ],
        practicalExample:
          'If someone asks "How does this compare to Tool Y?", answer honestly about strengths and trade-offs.',
        dos: ['Be candid, helpful, and concise in every reply.'],
        donts: ['Copy-paste identical "Thanks!" replies to every single comment.'],
      },
      {
        id: 'ch5_l3',
        title: 'Community engagement',
        readMinutes: 3,
        explanation:
          'Share your launch respectfully across your own channels throughout the day—morning announcement, midday milestone or behind-the-scenes lesson, and evening recap for late timezones.',
        steps: [
          'Publish your morning announcement across X, LinkedIn, and your email list.',
          'Share a midday insight or interesting question someone asked on Product Hunt.',
          'Post an evening wrap-up inviting late-timezone builders to share feedback.',
        ],
        practicalExample:
          'Point people to your Product Hunt discussion page so they can share thoughts and see other questions.',
        dos: ['Encourage genuine product curiosity and feedback.'],
        donts: ['Spam unrelated subreddits, Slack channels, or DM strangers asking for upvotes.'],
      },
      {
        id: 'ch5_l4',
        title: 'Responding to comments',
        readMinutes: 3,
        explanation:
          'Every comment is a chance to turn a curious browser into a loyal user—or discover a feature blind spot. Respond within 15–30 minutes whenever possible, especially to tough or skeptical questions.',
        steps: [
          'Acknowledge the commenter’s specific observation or concern first.',
          'Provide a clear, honest answer or workaround.',
          'Log every feature request or bug report into a launch-day triage note.',
        ],
        practicalExample:
          'When a user points out a missing integration, thank them, confirm whether it is on your roadmap, and share how they can follow progress.',
        dos: ['Turn thoughtful feature requests into public follow-ups after launch.'],
        donts: ['Get defensive when someone criticizes pricing or UI choices.'],
      },
      {
        id: 'ch5_l5',
        title: 'Monitoring performance',
        readMinutes: 3,
        explanation:
          'Watch your website analytics, signup conversion rate, and server error logs—not just the Product Hunt leaderboard. Fix any onboarding friction live during launch day.',
        steps: [
          'Keep your analytics dashboard and error monitor open in a pinned tab.',
          'Watch where visitors drop off between landing page, signup, and first activation.',
          'Ship quick copy or UX fixes if visitors repeatedly misunderstand a feature.',
        ],
        practicalExample:
          'If 200 visitors hit your homepage but only 5 sign up, check whether your hero headline or signup button is unclear and adjust quickly.',
        dos: ['Track signups, activation rate, and real user feedback alongside Product Hunt traffic.'],
        donts: ['Obsess over refreshing the leaderboard every 30 seconds while ignoring onboarding bugs.'],
      },
    ],
    checklist: [
      { id: 'ch5_c1', label: 'Confirm live page, links, and First Maker Comment at 12:01 AM PT' },
      { id: 'ch5_c2', label: 'Reply thoughtfully to every comment throughout the 24-hour window' },
      { id: 'ch5_c3', label: 'Monitor signup funnel and server health live during traffic spikes' },
    ],
  },
  {
    id: 'ch6',
    number: 6,
    title: 'After Launch',
    subtitle: 'Turn one launch day into lasting users, sharper product direction, and repeatable growth.',
    lessons: [
      {
        id: 'ch6_l1',
        title: 'Collecting and organizing feedback',
        readMinutes: 3,
        explanation:
          'Within 48 hours of launch, export every Product Hunt comment, support chat, and user email into one structured feedback sheet tagged by bug, UX confusion, or feature request.',
        steps: [
          'Review all Product Hunt comments and direct messages from launch day.',
          'Group recurring themes into 3 buckets: Quick Fixes, Positioning Clarifications, Roadmap.',
          'Prioritize the top 3 items that blocked new users from activating.',
        ],
        practicalExample:
          'If 6 commenters asked for team collaboration or CSV export, promote that item directly into your next sprint.',
        dos: ['Review both positive comments and skeptical questions for hidden product insights.'],
        donts: ['Let valuable launch-day suggestions get buried in old notifications.'],
      },
      {
        id: 'ch6_l2',
        title: 'Sharing results transparently',
        readMinutes: 3,
        explanation:
          'Publish a transparent post-launch retrospective sharing what worked, what surprised you, real traffic/signup numbers, and lessons for other makers. Honest stories often drive a second wave of visitors.',
        steps: [
          'Compile your real 48-hour metrics: visitors, signups, activation rate, and top comments.',
          'Write a short retrospective highlighting 3 things that worked and 2 mistakes you would fix.',
          'Share the recap with your community and thank everyone who tested the product.',
        ],
        practicalExample:
          'Write a short blog post or LinkedIn recap: "What we learned from launching on Product Hunt: 420 signups, 18 bugs fixed live, and 3 positioning mistakes."',
        dos: ['Thank everyone who tested your product and shared honest feedback.'],
        donts: ['Disappear for two months right after launch day.'],
      },
      {
        id: 'ch6_l3',
        title: 'Following up with users',
        readMinutes: 3,
        explanation:
          'Reach out personally to new signups who activated—or dropped off midway—within 3 days while your product is still fresh in their mind.',
        steps: [
          'Segment launch-day signups into "Activated" and "Signed up but stalled".',
          'Send a short plain-text founder note asking what brought them in and where they got stuck.',
          'Invite power users to a 15-minute feedback chat.',
        ],
        practicalExample:
          'Send a plain-text founder email: "Hey Maya, noticed you created your first draft on launch day—was anything confusing or missing?"',
        dos: ['Send personal, helpful check-ins rather than automated sales sequences.'],
        donts: ['Spam launch signups with aggressive upsells on Day 2.'],
      },
      {
        id: 'ch6_l4',
        title: 'Improving your product for the next milestone',
        readMinutes: 3,
        explanation:
          'Product Hunt allows major updates ("Launch 2.0" or major feature milestones) after meaningful product evolution. Use the insights from your first launch to build a much stronger v2.',
        steps: [
          'Save your Launch 1 drafts and Analyzer score inside HuntPilot as a baseline.',
          'Ship the top user-requested improvements over the next 3–6 months.',
          'Prepare a v2 launch draft focused on new capabilities and real customer proof.',
        ],
        practicalExample:
          'Fix the top 3 onboarding friction points from Launch 1, build the most requested workflow, and return 6 months later with customer case studies.',
        dos: ['Archive your Launch 1 metrics and drafts inside HuntPilot to benchmark future launches.'],
        donts: ['Treat Product Hunt as a one-shot gamble rather than a repeatable learning loop.'],
      },
    ],
    checklist: [
      { id: 'ch6_c1', label: 'Categorize all launch-day comments and user feedback into a prioritized list' },
      { id: 'ch6_c2', label: 'Send personal follow-up notes to early launch-day signups' },
      { id: 'ch6_c3', label: 'Publish a transparent launch retrospective and update your product roadmap' },
    ],
  },
];
