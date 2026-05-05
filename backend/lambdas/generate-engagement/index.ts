import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { invokeClaudeJSON } from '../shared/bedrock';
import { success, error } from '../shared/response';

interface EngagementRequest {
  accountData: {
    customer_name: string;
    industry: string;
    segment: string;
    geo: string;
    aws_spend: { current_year: number; prior_year: number; ppa: string };
    sfdc_data: { open_opps: number; t2k: boolean; account_plan_priority: string; smgs_phase: string };
    tc_current_state: { skill_builder: boolean; skill_builder_seats: number; activation_rate: number; certifications: number; prior_engagement: string; renewal_date: string };
    public_intelligence: {
      earnings_call_signals: string[];
      linkedin_job_postings: { cloud_ai_roles: number; yoy_change: string };
      executive_social: { name: string; title: string; post_theme: string }[];
      glassdoor_signals: string[];
      industry_context: string;
      news_signals: string[];
    };
  };
  persona: {
    name: string;
    title: string;
    persona: string; // CEO, CFO, CTO, CIO, CHRO, Other
  };
  userNotes?: string[];
}

interface EngagementPlanResponse {
  persona: string;
  persona_name: string;
  persona_title: string;
  narrative: string;
  conversation_starters: string[];
  recommended_plays: { play_name: string; description: string }[];
  revenue_estimate: { offering: string; estimated_value: string; timeline: string }[];
  total_pipeline: string;
  proof_points: { customer: string; industry: string; metric: string; demonstrates: string }[];
}

const SYSTEM_PROMPT = `You are an expert AWS Training & Certification (T&C) engagement strategist. Your job is to generate persona-specific executive engagement plans that position AWS T&C as a strategic accelerator for the customer's cloud transformation.

You have deep knowledge of:
- AWS T&C offerings: Skill Builder (self-paced digital), Skills Guild (enterprise program), Private Training (ILT), Certifications, Learning Needs Assessments, Executive AI Literacy programs
- Proof points: Bell Canada (67% cloud sales increase), Holcim (85% participation, 38% team growth), UNSW (70% skill uplift, 54% AWS proficiency growth), CloudCall (50% time-to-market reduction), LTIMindtree (40,000+ trained), Fortinet (83% sales opportunity increase Year 2), Forrester TEI (229% ROI, <6 month payback)
- Persona priorities: CEO (competitive positioning, board readiness, transformation vision), CFO (ROI, payback, build vs. buy economics), CTO/CIO (delivery acceleration, time-to-competency, technical credibility), CHRO (retention, participation, culture, talent strategy)

CRITICAL RULES:
1. Ground every conversation starter in a SPECIFIC data point from the account intelligence (an earnings call quote, a LinkedIn post theme, a hiring number, a Glassdoor signal). Never be generic.
2. The narrative must tell a STORY about this specific executive at this specific company — not a generic pitch about training.
3. Revenue estimates must be realistic and phased. Use ranges. Base them on account size, current T&C state, and industry benchmarks.
4. Proof points must be matched to the persona type and industry context.
5. Recommended plays must connect to the customer's specific transformation priorities, not just list products.

Return your response as a JSON object matching this exact structure:
{
  "persona": "CEO|CFO|CTO|CIO|CHRO|Other",
  "persona_name": "Full Name",
  "persona_title": "Full Title",
  "narrative": "2-3 paragraph narrative...",
  "conversation_starters": ["starter 1", "starter 2", "starter 3"],
  "recommended_plays": [{"play_name": "...", "description": "..."}],
  "revenue_estimate": [{"offering": "...", "estimated_value": "$X-$Y", "timeline": "Q_ 20__"}],
  "total_pipeline": "$X-$Y over N months",
  "proof_points": [{"customer": "...", "industry": "...", "metric": "...", "demonstrates": "..."}]
}`;

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    if (!event.body) {
      return error(400, 'Request body is required');
    }

    const request: EngagementRequest = JSON.parse(event.body);
    const { accountData, persona, userNotes } = request;

    if (!accountData || !persona) {
      return error(400, 'accountData and persona are required');
    }

    const userMessage = `Generate a persona-specific engagement plan for the following:

ACCOUNT: ${accountData.customer_name}
INDUSTRY: ${accountData.industry}
SEGMENT: ${accountData.segment} (${accountData.geo})
AWS SPEND: $${(accountData.aws_spend.current_year / 1_000_000).toFixed(1)}M (up from $${(accountData.aws_spend.prior_year / 1_000_000).toFixed(1)}M prior year)
PPA: ${accountData.aws_spend.ppa || 'None'}

SALESFORCE DATA:
- Open Opportunities: ${accountData.sfdc_data.open_opps}
- T2K: ${accountData.sfdc_data.t2k ? 'Yes' : 'No'}
- Account Plan Priority: ${accountData.sfdc_data.account_plan_priority}
- SMGS Phase: ${accountData.sfdc_data.smgs_phase}

T&C CURRENT STATE:
- Skill Builder: ${accountData.tc_current_state.skill_builder ? `Yes (${accountData.tc_current_state.skill_builder_seats} seats, ${accountData.tc_current_state.activation_rate}% activation)` : 'No structured engagement'}
- Certifications: ${accountData.tc_current_state.certifications}
- Prior Engagement: ${accountData.tc_current_state.prior_engagement}
- Renewal Date: ${accountData.tc_current_state.renewal_date || 'N/A'}

PUBLIC INTELLIGENCE:
- Earnings Call Signals: ${accountData.public_intelligence.earnings_call_signals.join('; ')}
- LinkedIn Job Postings: ${accountData.public_intelligence.linkedin_job_postings.cloud_ai_roles} cloud/AI roles (${accountData.public_intelligence.linkedin_job_postings.yoy_change} YoY)
- Executive Social Activity: ${accountData.public_intelligence.executive_social.map(e => `${e.name} (${e.title}): "${e.post_theme}"`).join('; ')}
- Glassdoor Signals: ${accountData.public_intelligence.glassdoor_signals.join('; ')}
- Industry Context: ${accountData.public_intelligence.industry_context}
- News: ${accountData.public_intelligence.news_signals.join('; ')}

TARGET PERSONA:
- Name: ${persona.name}
- Title: ${persona.title}
- Type: ${persona.persona}

${userNotes && userNotes.length > 0 ? `ADDITIONAL CONTEXT FROM SELLER:\n${userNotes.join('\n')}` : ''}

IMPORTANT: When generating conversation starters and recommended plays, reference the T&C current state and any existing training engagement. If they have existing products, build on that. If they're greenfield, lead with assessment and pilot approaches.

Generate the engagement plan. Remember: ground everything in the specific data above. Reference ${persona.name}'s own words and public activity. Make the narrative tell THEIR story, not ours.`;

    const result = await invokeClaudeJSON<EngagementPlanResponse>(
      SYSTEM_PROMPT,
      [{ role: 'user', content: userMessage }],
      { maxTokens: 4096, temperature: 0.7 }
    );

    return success(result);
  } catch (err) {
    console.error('Error generating engagement plan:', err);
    return error(500, 'Failed to generate engagement plan');
  }
}
