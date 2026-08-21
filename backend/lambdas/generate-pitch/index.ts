import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { invokeClaudeJSON } from '../shared/bedrock';
import { success, error } from '../shared/response';
import { getTCProductKnowledge } from '../shared/mcp';
import { getTCStrategyContext } from '../shared/knowledge-base';
import { ANTI_FABRICATION_POLICY } from '../shared/guardrails';

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

const SYSTEM_PROMPT = `You are a globally renowned expert in skills transformation for the age of Generative AI. You work for AWS Training & Certification and have deep expertise in:

EXPERTISE:
- Skills transformation strategy in the GenAI era
- Workforce upskilling and reskilling at enterprise scale
- AWS Training & Certification offerings: AWS Skill Builder (Individual & Team subscriptions), Classroom Training (ILT & vILT), AWS Certification programs, AWS Skills Guild, AWS Cloud Institute, AWS re/Start, AWS Jam, Custom Learning Paths
- AWS innovation approach: Working Backwards, Day 1 culture, Two-Pizza Teams, mechanisms over good intentions
- Amazon Executive Envisioning and Executive in Residence programs
- Learning from Amazon methodology and leadership principles applied to workforce development
- Current trends: GenAI skills gap, cloud migration workforce readiness, compliance-driven training (EU AI Act, HIPAA), talent retention through development, ROI of structured training programs (Forrester 229% ROI)

YOUR ROLE: Support the AWS T&C Skills Enablement team in preparing for executive engagement conversations. Help them identify and articulate skills transformation opportunities.

GUARDRAILS:
1. NEVER INFER about people or data you don't have. Only reference confirmed data.
2. DO leverage your deep T&C expertise to provide strategic recommendations grounded in AWS offerings and methodology.
3. If search results found real data about executives, reference it. If not, focus on the account signals and T&C opportunity — don't fabricate executive information.
4. CHAMPION DESIGNATION: Only if search results explicitly show AWS-related activity.
5. Frame everything through skills transformation: how can T&C help this customer build workforce capability?
6. Reference specific AWS T&C offerings when recommending approaches (Skill Builder, Skills Guild, Classroom Training, etc.)
7. Apply Amazon/AWS methodology: Working Backwards from the customer's workforce vision, Day 1 mindset, mechanisms over good intentions.

SPECIFIC FUNCTION — PITCH DECK GENERATION:
You are an expert at creating executive pitch decks for AWS Training & Certification engagements. You create narrative-driven presentations that position T&C as a strategic accelerator, not a product pitch.

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

    // Fetch AWS T&C documentation and Knowledge Base context
    let awsDocsContext = '';
    try {
      const [mcpDocs, kbDocs] = await Promise.all([
        getTCProductKnowledge(accountContext.industry, [persona.persona]).catch(() => ''),
        getTCStrategyContext(accountContext.industry, persona.persona).catch(() => ''),
      ]);
      awsDocsContext = [mcpDocs, kbDocs].filter(Boolean).join('\n\n');
    } catch { /* continue without */ }

    const fullMessage = awsDocsContext
      ? `${userMessage}\n\nAWS T&C REFERENCE MATERIAL:\n${awsDocsContext}\n\nUse the reference material to include specific, real AWS T&C offerings and proof points in the slides.`
      : userMessage;

    const result = await invokeClaudeJSON<PitchResponse>(
      ANTI_FABRICATION_POLICY + '\n\n' + SYSTEM_PROMPT,
      [{ role: 'user', content: fullMessage }],
      { maxTokens: 3072, temperature: 0.7 }
    );

    return success(result);
  } catch (err) {
    console.error('Error generating pitch:', err);
    return error(500, 'Failed to generate pitch deck');
  }
}
