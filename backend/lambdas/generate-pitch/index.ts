import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { invokeClaudeJSON } from '../shared/bedrock';
import { success, error } from '../shared/response';

interface PitchRequest {
  accountContext: {
    customer_name: string;
    industry: string;
    segment: string;
    aws_spend_current: number;
    ppa: string;
    account_plan_priority: string;
    linkedin_roles: number;
    linkedin_yoy: string;
    tc_state: string;
    earnings_signals: string[];
    executive_social: { name: string; title: string; post_theme: string }[];
    glassdoor_signals: string[];
    industry_context: string;
    news_signals: string[];
  };
  persona: { name: string; title: string; persona: string };
  engagementPlan: {
    narrative: string;
    conversation_starters: string[];
    recommended_plays: { play_name: string; description: string }[];
    revenue_estimate: { offering: string; estimated_value: string; timeline: string }[];
    total_pipeline: string;
    proof_points: { customer: string; industry: string; metric: string; demonstrates: string }[];
  };
  userNotes?: string[];
}

interface PitchSlide {
  slideNumber: number;
  title: string;
  content: string;
  speakerNotes: string;
  type: 'title' | 'story' | 'data' | 'insight' | 'action' | 'close';
}

interface PitchResponse {
  title: string;
  subtitle: string;
  duration: string;
  audience: string;
  slides: PitchSlide[];
}

const SYSTEM_PROMPT = `You are an expert at creating executive pitch decks for AWS Training & Certification engagements. You create narrative-driven presentations that position T&C as a strategic accelerator, not a product pitch.

DECK STRUCTURE (7-8 slides):
1. TITLE — Customer × AWS T&C partnership framing
2. STORY — The persona-specific narrative (their challenge, in their words)
3. DATA — The intelligence that makes the case (hiring data, signals, industry context)
4. INSIGHT — Proof points from peer organizations (matched to persona and industry)
5. ACTION — Recommended approach (T&C plays, phased)
6. INVESTMENT — Revenue framework with ROI data
7. CLOSE — Next steps with specific timeline and commitments
8. (Optional) ADDITIONAL — User-added topics

RULES:
1. Speaker notes must coach the presenter on HOW to deliver, not just WHAT to say
2. Content should be concise enough for a slide (bullet points, key phrases) not paragraphs
3. Speaker notes should include: what to watch for in the room, how to handle likely reactions, which proof point to emphasize for this persona
4. The deck tells a story — each slide builds on the previous
5. Ground everything in the specific account data provided

Return JSON:
{
  "title": "...",
  "subtitle": "...",
  "duration": "20-25 minutes",
  "audience": "...",
  "slides": [{"slideNumber": 1, "title": "...", "content": "...", "speakerNotes": "...", "type": "title|story|data|insight|action|close"}]
}`;

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    if (!event.body) {
      return error(400, 'Request body is required');
    }

    const request: PitchRequest = JSON.parse(event.body);
    const { accountContext, persona, engagementPlan, userNotes } = request;

    if (!accountContext || !persona || !engagementPlan) {
      return error(400, 'accountContext, persona, and engagementPlan are required');
    }

    const userMessage = `Generate a pitch deck for:

CUSTOMER: ${accountContext.customer_name} (${accountContext.industry}, ${accountContext.segment})
AWS SPEND: $${(accountContext.aws_spend_current / 1_000_000).toFixed(1)}M | PPA: ${accountContext.ppa}
PRIORITY: ${accountContext.account_plan_priority}

TARGET PERSONA: ${persona.name} (${persona.title}) — ${persona.persona}

INTELLIGENCE:
- LinkedIn: ${accountContext.linkedin_roles} cloud/AI roles (${accountContext.linkedin_yoy} YoY)
- Earnings: ${accountContext.earnings_signals.slice(0, 3).join('; ')}
- Executive Social: ${accountContext.executive_social.filter(e => e.name === persona.name).map(e => `"${e.post_theme}"`).join('; ') || 'No direct social signals'}
- Glassdoor: ${accountContext.glassdoor_signals.slice(0, 2).join('; ')}
- Industry: ${accountContext.industry_context}
- News: ${accountContext.news_signals.slice(0, 2).join('; ')}
- T&C State: ${accountContext.tc_state}

ENGAGEMENT PLAN CONTEXT:
- Narrative: ${engagementPlan.narrative.slice(0, 500)}
- Conversation Starters: ${engagementPlan.conversation_starters[0]}
- Recommended Plays: ${engagementPlan.recommended_plays.map(p => p.play_name).join(', ')}
- Pipeline: ${engagementPlan.total_pipeline}
- Proof Points: ${engagementPlan.proof_points.map(p => `${p.customer}: ${p.metric}`).join('; ')}

${userNotes && userNotes.length > 0 ? `ADDITIONAL TOPICS:\n${userNotes.join('\n')}` : ''}

Create a 7-slide pitch deck tailored to ${persona.name}'s perspective as a ${persona.persona}. The speaker notes should coach the presenter on delivery, reactions to watch for, and which proof points to emphasize.`;

    const result = await invokeClaudeJSON<PitchResponse>(
      SYSTEM_PROMPT,
      [{ role: 'user', content: userMessage }],
      { maxTokens: 4096, temperature: 0.7 }
    );

    return success(result);
  } catch (err) {
    console.error('Error generating pitch:', err);
    return error(500, 'Failed to generate pitch deck');
  }
}
