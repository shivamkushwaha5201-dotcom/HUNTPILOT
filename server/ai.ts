import { GoogleGenAI, Type } from '@google/genai';
import type { Content, FunctionDeclaration } from '@google/genai';
import { callMcpToolForUser } from './mcp.ts';
import { getUserOAuthSession } from './mcpOAuth.ts';

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error('GEMINI_API_KEY is not configured in server secrets.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const MODEL_NAME = 'gemini-4-hydrogen';

export interface DraftInput {
  productName: string;
  websiteUrl?: string;
  category: string;
  targetAudience: string;
  mainProblem: string;
  keyFeatures: string[];
  usp: string;
  description: string;
  regenerateSection?: string;
  existingDraft?: Record<string, unknown>;
}

export async function generateLaunchDraftWithAI(input: DraftInput) {
  const ai = getAiClient();
  const focusNote =
    input.regenerateSection && input.regenerateSection !== 'all'
      ? `The user specifically requested a fresh variation for section "${input.regenerateSection}". Keep the rest coherent with their existing draft while improving "${input.regenerateSection}" markedly.`
      : 'Generate a complete, high-converting Product Hunt launch kit.';

  const prompt = `
Product Name: ${input.productName}
Website URL: ${input.websiteUrl || 'Not provided yet'}
Category: ${input.category}
Target Audience: ${input.targetAudience}
Main Problem Solved: ${input.mainProblem}
Key Features: ${input.keyFeatures.join('; ')}
Unique Selling Proposition: ${input.usp}
Product Description Notes: ${input.description}
${input.existingDraft ? `Existing Draft Context: ${JSON.stringify(input.existingDraft)}` : ''}

${focusNote}

Requirements:
- Each of the 5 taglines must be <= 60 characters, crystal clear, benefit-driven, zero buzzwords ("revolutionize", "supercharge", "game-changer").
- The Product Hunt description must be punchy, clear, and scannable (under 280 words).
- The First Maker Comment must sound authentic, human, founder-led: welcome the community, explain the origin story, summarize 3 key capabilities, offer an honest limitation or roadmap note, and ask a specific feedback question.
- Suggest 3 to 5 relevant Product Hunt topics.
- Provide 4 to 5 concrete gallery image slide concepts (title + what visual/UI to show).
- Provide a 60-second demo video script with clear timestamps (0:00-0:10 Hook, 0:10-0:25 Problem, 0:25-0:50 Live Flow, 0:50-1:00 CTA).
- Provide a ready-to-post launch announcement for X/LinkedIn without cheesy hype.
`;

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
    config: {
      systemInstruction:
        'You are an experienced Product Hunt launch strategist and copywriter. Write sharp, specific, founder-authentic copy with zero hype clichés.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          taglines: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: '5 tagline options, each under 60 characters.',
          },
          description: {
            type: Type.STRING,
            description: 'Main Product Hunt product description.',
          },
          makerComment: {
            type: Type.STRING,
            description: 'First maker comment for launch day.',
          },
          topics: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: '3-5 Product Hunt topic suggestions.',
          },
          galleryIdeas: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: '4-5 concrete gallery slide visual ideas.',
          },
          demoVideoScript: {
            type: Type.STRING,
            description: '60-second demo video script with timestamps.',
          },
          launchAnnouncement: {
            type: Type.STRING,
            description: 'Social announcement post for launch day.',
          },
        },
        required: [
          'taglines',
          'description',
          'makerComment',
          'topics',
          'galleryIdeas',
          'demoVideoScript',
          'launchAnnouncement',
        ],
      },
    },
  });

  const text = (response.text ?? '{}').trim();
  return JSON.parse(text);
}

export interface AnalyzeMcpContext {
  relatedProducts: Array<{
    name: string;
    tagline: string;
    pricing?: string | null;
    rating?: number | null;
    topLaunchPoints?: number | null;
    url?: string;
  }>;
  matchedCategories: string[];
  mcpLaunchAssessment?: unknown;
}

export interface AnalyzeInput {
  productName: string;
  tagline: string;
  category?: string;
  description: string;
  makerComment: string;
  topics: string[];
  websiteUrl?: string;
  targetAudience?: string;
  usp?: string;
  visualAssetsNotes?: string;
  competitorNotes?: string;
  launchChecklistNotes?: string;
  mcpContext?: AnalyzeMcpContext | null;
}

export const LAUNCH_READINESS_DISCLAIMER =
  'Important: This is an estimated Launch Readiness Score based on copy clarity, positioning, and preparation completeness. It is NOT a probability of getting featured. Featuring depends on Product Hunt’s internal systems, editorial decisions, daily competition, and community response.';

export async function analyzeLaunchWithAI(input: AnalyzeInput) {
  const ai = getAiClient();

  const mcpBlock =
    input.mcpContext &&
    (input.mcpContext.relatedProducts.length > 0 ||
      input.mcpContext.matchedCategories.length > 0 ||
      input.mcpContext.mcpLaunchAssessment)
      ? `
REAL PRODUCT HUNT DATA RETRIEVED FROM OFFICIAL MCP SERVER (do NOT invent anything beyond these facts):
- Matching Official Product Hunt Categories: ${input.mcpContext.matchedCategories.join(', ') || 'None matched'}
- Similar/Nearby Products on Product Hunt:
${
  input.mcpContext.relatedProducts.length > 0
    ? input.mcpContext.relatedProducts
        .map(
          (p) =>
            `  * ${p.name}: "${p.tagline}" (Pricing: ${p.pricing || 'unspecified'}, Rating: ${
              p.rating ?? 'N/A'
            }, Top Launch Points: ${p.topLaunchPoints ?? 'N/A'})`
        )
        .join('\n')
    : '  * None retrieved'
}
${
  input.mcpContext.mcpLaunchAssessment
    ? `- Official Product Hunt Draft Assessment from MCP: ${JSON.stringify(
        input.mcpContext.mcpLaunchAssessment
      ).slice(0, 3000)}`
    : ''
}
`
      : '\nNo live Product Hunt MCP comparison data was retrieved for this query; evaluate strictly from the submitted draft.\n';

  const prompt = `
Evaluate the following Product Hunt launch draft objectively and constructively.

Product Name: ${input.productName}
Product Category: ${input.category || input.topics[0] || 'Unspecified'}
Tagline (${input.tagline.length} chars): ${input.tagline}
Website URL: ${input.websiteUrl || 'Not provided'}
Topics: ${input.topics.join(', ') || 'None specified'}
Target Audience: ${input.targetAudience || 'Not specified'}
Unique Selling Proposition: ${input.usp || 'Not specified'}
Description:
${input.description}

First Maker Comment:
${input.makerComment || 'Not provided yet'}

Visual Assets / Gallery Plan:
${input.visualAssetsNotes || 'Not provided yet'}

Competitor Differentiation Notes:
${input.competitorNotes || 'Not provided yet'}

Launch Preparation Checklist Notes:
${input.launchChecklistNotes || 'Not provided yet'}
${mcpBlock}
Instructions:
- Score each of the 8 dimensions from 0 to 100 rigorously (do not inflate scores if critical details like visual assets, maker comment, or USP are missing).
- Calculate overallScore (0-100) as a thoughtful weighted readiness score.
- Clearly distinguish in your feedback between real retrieved Product Hunt data (when provided above) and your AI evaluation estimates.
- Never claim this score predicts featuring or guaranteed upvotes.
`;

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
    config: {
      systemInstruction:
        'You are a candid, constructive Product Hunt launch reviewer. Provide actionable, specific feedback grounded strictly in what the founder submitted and any real Product Hunt MCP data provided.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          overallScore: { type: Type.INTEGER },
          categoryScores: {
            type: Type.OBJECT,
            properties: {
              taglineClarity: { type: Type.INTEGER },
              descriptionQuality: { type: Type.INTEGER },
              positioning: { type: Type.INTEGER },
              uspStrength: { type: Type.INTEGER },
              audienceClarity: { type: Type.INTEGER },
              visualAssets: { type: Type.INTEGER },
              competitorDiff: { type: Type.INTEGER },
              launchPrep: { type: Type.INTEGER },
            },
            required: [
              'taglineClarity',
              'descriptionQuality',
              'positioning',
              'uspStrength',
              'audienceClarity',
              'visualAssets',
              'competitorDiff',
              'launchPrep',
            ],
          },
          strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
          weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
          missingInfo: { type: Type.ARRAY, items: { type: Type.STRING } },
          suggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
          nextSteps: { type: Type.ARRAY, items: { type: Type.STRING } },
          summary: { type: Type.STRING },
        },
        required: [
          'overallScore',
          'categoryScores',
          'strengths',
          'weaknesses',
          'missingInfo',
          'suggestions',
          'nextSteps',
          'summary',
        ],
      },
    },
  });

  const parsed = JSON.parse((response.text ?? '{}').trim());
  return {
    ...parsed,
    disclaimer: LAUNCH_READINESS_DISCLAIMER,
  };
}

export async function explainAcademyLessonWithAI(input: {
  lessonTitle: string;
  lessonExplanation: string;
  question?: string;
  projectContext?: {
    name?: string;
    category?: string;
    tagline?: string;
    targetAudience?: string;
  } | null;
}): Promise<string> {
  const ai = getAiClient();
  const projectBlock = input.projectContext?.name
    ? `Founder's active project: "${input.projectContext.name}" (${input.projectContext.category || 'SaaS'}), tagline: "${
        input.projectContext.tagline || 'not written yet'
      }", target audience: "${input.projectContext.targetAudience || 'unspecified'}".`
    : 'No active project selected; give a clear, beginner-friendly example.';

  const prompt = `
Lesson: ${input.lessonTitle}
Lesson core material: ${input.lessonExplanation}
${projectBlock}
Founder's question: ${
    input.question?.trim() ||
    'Explain this lesson in super simple English for a first-time founder and give 1 concrete step I can take today.'
  }

Respond clearly in plain English (under 220 words), avoiding jargon and false guarantees about featuring.
`;

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
    config: {
      systemInstruction:
        'You are a patient Product Hunt Launch Academy coach teaching first-time founders in plain, simple English.',
    },
  });

  return (response.text ?? 'Unable to generate explanation right now.').trim();
}

export interface AssistantInput {
  uid: string;
  message: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  projectContext?: {
    name?: string;
    category?: string;
    tagline?: string;
    targetAudience?: string;
    usp?: string;
    description?: string;
    stage?: string;
    latestScore?: number;
  } | null;
  academySummary?: string;
  draftsSummary?: string;
  researchSummary?: string;
  latestAnalysisSummary?: string;
}

const BASE_ASSISTANT_TOOLS: FunctionDeclaration[] = [
  {
    name: 'ph_search_products',
    description:
      'Search real Product Hunt products by keyword, category slug, pricing, open source, or date window.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: 'Product name or task phrase.' },
        category: { type: Type.STRING, description: 'Optional category slug.' },
        pricing: {
          type: Type.STRING,
          description: 'Optional: any, free, free_options, payment_required.',
        },
        launched_within_days: {
          type: Type.INTEGER,
          description: 'Filter launches within last N days.',
        },
        sort: {
          type: Type.STRING,
          description: 'Optional (only without query): relevance, newest, most_points, highest_rated.',
        },
        limit: { type: Type.INTEGER, description: 'Max results (1-15).' },
      },
    },
  },
  {
    name: 'ph_get_product_profile',
    description:
      'Retrieve real Product Hunt product profile details, pricing, rating, sentiment pros/cons, makers, company, and funding.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        product_name: { type: Type.STRING, description: 'Product name or slug, e.g. cursor.' },
      },
      required: ['product_name'],
    },
  },
  {
    name: 'ph_get_alternatives',
    description: 'Find real alternatives on Product Hunt to a given product slug or name.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        product: { type: Type.STRING, description: 'Product slug or name.' },
        limit: { type: Type.INTEGER, description: 'Number of alternatives (1-15).' },
      },
      required: ['product'],
    },
  },
  {
    name: 'ph_get_leaderboard',
    description:
      'Get the official Product Hunt leaderboard for today (omit date), a day (YYYY-MM-DD), week (YYYY-Www), month (YYYY-MM), or year (YYYY).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        date: { type: Type.STRING, description: 'Optional YYYY-MM-DD, YYYY-Www, YYYY-MM, or YYYY.' },
        limit: { type: Type.INTEGER, description: 'Number of products (1-15).' },
      },
    },
  },
  {
    name: 'ph_get_categories',
    description: 'List official Product Hunt categories and slugs.',
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
];

const ACCOUNT_ASSISTANT_TOOLS: FunctionDeclaration[] = [
  {
    name: 'ph_get_my_account',
    description: 'Get the authenticated user Product Hunt account identity.',
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: 'ph_list_my_launches',
    description: 'List the connected user Product Hunt drafts, scheduled, unscheduled, or live launches.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        status: {
          type: Type.STRING,
          description: 'Optional filter: draft, scheduled, live, unscheduled.',
        },
        limit: { type: Type.INTEGER, description: 'Max items (1-20).' },
      },
    },
  },
  {
    name: 'ph_get_launch',
    description: 'Read a specific launch or draft owned/managed by the connected user, including missing items and assessment.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        launch_id: { type: Type.STRING, description: 'Launch ID or UUID from list_my_launches.' },
      },
      required: ['launch_id'],
    },
  },
  {
    name: 'ph_get_launch_context',
    description: 'Check Product Hunt launch date availability, URL eligibility, or topic/category suggestions.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        url: { type: Type.STRING, description: 'Product URL.' },
        launch_date: { type: Type.STRING, description: 'YYYY-MM-DD Pacific date to check availability.' },
        topic: { type: Type.STRING, description: 'Topic name to look up.' },
        category: { type: Type.STRING, description: 'Category name to look up.' },
      },
    },
  },
];

const FUNCTION_TO_MCP_TOOL: Record<string, string> = {
  ph_search_products: 'search_products',
  ph_get_product_profile: 'get_product_profile',
  ph_get_alternatives: 'get_alternatives',
  ph_get_leaderboard: 'get_product_leaderboard',
  ph_get_categories: 'get_categories',
  ph_get_my_account: 'get_my_account',
  ph_list_my_launches: 'list_my_launches',
  ph_get_launch: 'get_launch',
  ph_get_launch_context: 'get_launch_context',
};

export async function askAssistantWithAI(input: AssistantInput): Promise<{
  reply: string;
  usedLiveMcpData: boolean;
  mcpToolsUsed: string[];
}> {
  const ai = getAiClient();
  const hasOAuthSession = Boolean(getUserOAuthSession(input.uid));

  const contextBlock = input.projectContext
    ? `\nActive Founder Project Context:\n- Product: ${input.projectContext.name || 'Unnamed'}\n- Category: ${input.projectContext.category || 'Unspecified'}\n- Tagline: ${input.projectContext.tagline || 'Not drafted yet'}\n- Target Audience: ${input.projectContext.targetAudience || 'Unspecified'}\n- USP: ${input.projectContext.usp || 'Unspecified'}\n- Stage: ${input.projectContext.stage || 'idea'}\n- Latest Readiness Score: ${input.projectContext.latestScore ?? 'Not analyzed yet'}\n- Description: ${input.projectContext.description || 'None'}\n`
    : '\nNo specific project is selected yet; give clear general or beginner-friendly Product Hunt guidance.\n';

  const workspaceSections: string[] = [];
  if (input.draftsSummary?.trim()) {
    workspaceSections.push(`Saved Launch Drafts Context:\n${input.draftsSummary.trim()}`);
  }
  if (input.latestAnalysisSummary?.trim()) {
    workspaceSections.push(`Latest Launch Readiness Diagnostic:\n${input.latestAnalysisSummary.trim()}`);
  }
  if (input.researchSummary?.trim()) {
    workspaceSections.push(`Saved Competitor Research Context:\n${input.researchSummary.trim()}`);
  }
  if (input.academySummary?.trim()) {
    workspaceSections.push(`Launch Academy Curriculum & User Progress:\n${input.academySummary.trim()}`);
  }
  const workspaceKnowledgeBlock =
    workspaceSections.length > 0 ? `\n${workspaceSections.join('\n\n')}\n` : '';

  const accountStatusNote = hasOAuthSession
    ? 'The user has connected their Product Hunt account via OAuth, so account/draft read tools are available.'
    : 'The user has NOT connected their personal Product Hunt OAuth account yet. Public Product Hunt research tools (search, profiles, alternatives, leaderboards, categories) ARE available, while personal account/draft tools require connecting Product Hunt in Profile & Plan -> Product Hunt Integration.';

  const systemInstruction = `You are HuntPilot Assistant, an experienced Product Hunt launch strategist helping both first-time makers and seasoned founders.
${contextBlock}${workspaceKnowledgeBlock}
${accountStatusNote}

Guidelines:
- Use clear, plain English without jargon or hype.
- Whenever the user asks about real Product Hunt products, competitors, alternatives, leaderboards, categories, or their connected Product Hunt launches/account, CALL the live ph_* MCP tools rather than guessing or recalling stale training data.
- Never invent product metrics, upvote counts, or launch rankings. If a tool returns an error or auth requirement, state it honestly.
- Never promise featuring, upvotes, or specific ranking outcomes; remind founders that featuring depends on Product Hunt's internal systems, editorial review, competition, and community engagement.
- When reviewing copy, weaknesses, or taglines, reference the user's actual saved drafts, readiness report feedback, and competitor research when available and provide concrete rewritten alternatives.
- Reference the active project context and Launch Academy lessons naturally whenever relevant.`;

  const declarations = hasOAuthSession
    ? [...BASE_ASSISTANT_TOOLS, ...ACCOUNT_ASSISTANT_TOOLS]
    : BASE_ASSISTANT_TOOLS;

  const contents: Content[] = [
    ...input.history.slice(-10).map((turn) => ({
      role: turn.role === 'assistant' ? ('model' as const) : ('user' as const),
      parts: [{ text: turn.content }],
    })),
    {
      role: 'user' as const,
      parts: [{ text: input.message }],
    },
  ];

  const mcpToolsUsed = new Set<string>();
  let finalReply = '';

  for (let round = 0; round < 4; round += 1) {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents,
      config: {
        systemInstruction,
        tools: [{ functionDeclarations: declarations }],
      },
    });

    const functionCalls = response.functionCalls;
    const modelContent = response.candidates?.[0]?.content;

    if (!functionCalls || functionCalls.length === 0) {
      finalReply = (response.text ?? '').trim();
      break;
    }

    if (modelContent) {
      contents.push(modelContent);
    }

    const responseParts = [];
    for (const call of functionCalls) {
      const callName = call.name || '';
      const mcpToolName = FUNCTION_TO_MCP_TOOL[callName];
      const args =
        call.args && typeof call.args === 'object'
          ? (call.args as Record<string, unknown>)
          : {};

      if (!mcpToolName) {
        responseParts.push({
          functionResponse: {
            id: call.id,
            name: callName,
            response: { error: `Unknown tool ${callName}` },
          },
        });
        continue;
      }

      try {
        const result = await callMcpToolForUser(input.uid, mcpToolName, args);
        mcpToolsUsed.add(mcpToolName);
        responseParts.push({
          functionResponse: {
            id: call.id,
            name: callName,
            response: {
              summary: result.summaryText,
              data: result.data ? JSON.stringify(result.data).slice(0, 14000) : null,
            },
          },
        });
      } catch (err) {
        responseParts.push({
          functionResponse: {
            id: call.id,
            name: callName,
            response: {
              error: err instanceof Error ? err.message : 'MCP tool failed.',
            },
          },
        });
      }
    }

    contents.push({
      role: 'user',
      parts: responseParts,
    });
  }

  return {
    reply:
      finalReply ||
      'I retrieved the requested information, please ask a follow-up question to explore further.',
    usedLiveMcpData: mcpToolsUsed.size > 0,
    mcpToolsUsed: Array.from(mcpToolsUsed),
  };
}

export interface CompetitorResearchInput {
  query: string;
  category: string;
  productDescription?: string;
  usp?: string;
  mcpData: unknown;
}

export async function synthesizeCompetitorResearchWithAI(input: CompetitorResearchInput) {
  const ai = getAiClient();

  const prompt = `
Analyze ONLY the following REAL Product Hunt products retrieved from the official Product Hunt MCP server alongside the founder's product context.

Search Query / Mode: ${input.query}
Category: ${input.category}
Founder Product Description: ${input.productDescription || 'Not provided'}
Founder USP: ${input.usp || 'Not provided'}

Retrieved Official Product Hunt MCP Data:
${JSON.stringify(input.mcpData).slice(0, 15000)}

Strict rules:
- Extract ONLY real products present in the retrieved MCP payload above. Do NOT invent or add products that are not in the payload.
- If zero products were returned in the MCP payload, set competitors to [] and explain honestly in summary that no matching Product Hunt products were returned for that query.
- Summarize positioning patterns across the real retrieved products and provide 3-5 concrete differentiation angles for the founder.
- Include real retrieved metrics in sourceNote (e.g., pricing, rating, or top launch points when present; otherwise "Product Hunt MCP").
`;

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
    config: {
      systemInstruction:
        'You are a market positioning strategist. Ground every product name, metric, and competitor claim strictly in the provided official Product Hunt MCP data. Never fabricate products or upvote counts.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING },
          differentiationAngles: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          competitors: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                positioning: { type: Type.STRING },
                strength: { type: Type.STRING },
                gapToExploit: { type: Type.STRING },
                sourceNote: { type: Type.STRING },
              },
              required: ['name', 'positioning', 'strength', 'gapToExploit', 'sourceNote'],
            },
          },
        },
        required: ['summary', 'differentiationAngles', 'competitors'],
      },
    },
  });

  const parsed = JSON.parse((response.text ?? '{}').trim());
  return {
    ...parsed,
    dataSource: 'mcp' as const,
  };
}
