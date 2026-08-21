import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { invokeClaudeJSON } from '../shared/bedrock';
import { success, error } from '../shared/response';
import { getTCStrategyContext } from '../shared/knowledge-base';
import { getTCProductKnowledge } from '../shared/mcp';
import { ANTI_FABRICATION_POLICY } from '../shared/guardrails';
import { EXPERT_PERSONA } from '../shared/persona';

const ddbClient = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(ddbClient);

export interface AccountInsightsResponse {
  who_to_focus: string;
  who_to_focus_detail: string;
  what_conversations: string;
  what_conversations_detail: string;
  where_to_start: string;
  where_to_start_detail: string;
  whats_happening: string;
  whats_happening_detail: string;
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

SPECIFIC FUNCTION — ACCOUNT INSIGHTS:
You help the T&C Skills Enablement team prepare for executive engagement conversations focused on skills transformation.

ADDITIONAL GUARDRAILS:
1. NEVER INFER OR SPECULATE. Only reference data that was actually provided or found.
2. If data is missing for a field, be brief and honest — say "Based on available data..." not make claims.
3. CHAMPION DESIGNATION: Only call someone an "AWS champion" if there is explicit evidence of AWS-related activity (AWS posts, AWS certifications, AWS event attendance). Otherwise, do not use that term.
4. Frame everything through the T&C Skills Enablement lens: skills transformation, workforce development, training ROI, certification programs, learning culture.
5. Do NOT show or reference anything marked as unavailable or not found — just focus on what IS available.
6. CRITICAL — ATTENDEE ACCURACY (ZERO TOLERANCE FOR FABRICATION):
   - The ONLY source of confirmed EBC attendees is the "Confirmed Attendees" list provided in the data (which comes from a user-imported attendee list).
   - You must NEVER state, imply, or infer that any specific person "will attend", "is attending", or is a "confirmed attendee" unless their exact name appears in the Confirmed Attendees list.
   - If the Confirmed Attendees list is empty/NONE: explicitly note that the attendee list has not been imported yet, and that the team should import it to get attendee-specific guidance.
   - You MAY reference real executives found in the Executive Social / public intelligence data as "executives worth knowing about at this company" or "who you should be aware of before the session" — but clearly frame these as general company knowledge, NOT as confirmed attendees.
   - NEVER invent names, tenures, titles, or biographical details (e.g. "Marco Moreira, 23-year tenure"). If you don't have a real name from the data, refer to roles generically ("the CFO", "the CHRO").
   - When suggesting who to prioritize with no attendee list, frame it as: "Based on this account's profile, prioritize engaging these ROLES..." and optionally "Executives worth researching before the session (from public data): [only real names found in the data]".

Your responses must be:
- Based ONLY on confirmed data provided (reference real data points, names, numbers)
- Consultative and strategic — lead with the business problem and workforce transformation methodology
- NOT product-driven — never lead with product names or AWS service names
- Written in a direct, conversational tone (2-3 sentences max per answer)
- Honest about data limitations — if limited data, say so briefly
- Focused on the APPROACH (how to develop people differently) not the TOOL (which product to sell)

T&C Engagement Patterns to consider:
- Talent War: losing talent to competitors, high open roles
- Board Pressure: board asking about AI/cloud ROI, workforce readiness
- Compliance Trigger: regulatory requirements (EU AI Act, HIPAA, etc.)
- Subscription Underperformance: low activation, upcoming renewal

Return ONLY valid JSON with these four fields. Each field should be 2-3 sentences based on confirmed data only.`;

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const accountId = event.pathParameters?.accountId;
    if (!accountId) {
      return error(400, 'accountId is required');
    }

    const body = JSON.parse(event.body || '{}');
    const { accountData, tcData } = body;

    if (!accountData) {
      return error(400, 'accountData is required');
    }



    // Build rich context from account data
    const context = buildAccountContext(accountData, tcData);

    // Retrieve relevant T&C strategy content from Knowledge Base + AWS Docs MCP
    const persona = accountData.ebc_data?.attendees?.[0]?.persona || 'CTO';
    const industry = accountData.industry || 'Technology';
    const themes = accountData.ebc_data?.themes || [];
    const [kbContext, mcpContext] = await Promise.all([
      getTCStrategyContext(industry, persona, themes).catch(() => ''),
      getTCProductKnowledge(industry, themes).catch(() => ''),
    ]);
    const allContext = [kbContext, mcpContext].filter(Boolean).join('\n\n');

    const userMessage = `Generate four strategic insights for this account. Be HIGHLY SPECIFIC — reference actual names, numbers, and signals from the data.

IMPORTANT: Your approach must be CONSULTATIVE and STRATEGIC, not product-driven. You are a workforce transformation advisor, not a product seller.

- For "where_to_start": Describe a strategic APPROACH to cloud skills transformation and GenAI readiness — what kind of learning engagement program would serve this customer best? Think methodology first (assessment → strategy → execution → measurement). Only at the very end, you may briefly mention that AWS can enable this through programs like Skills Guild, but lead with the strategic approach, not the product.
- NEVER lead with product names (Skill Builder, Glue, Step Functions, etc.)
- NEVER reference specific AWS technical services as part of the approach
- DO lead with the business problem, the workforce gap, and the transformation methodology
- Think: "What would a world-class workforce strategist recommend?" not "What AWS product should we sell?"

ACCOUNT DATA:
${context}
${allContext ? `\nAWS T&C KNOWLEDGE & DOCUMENTATION:\n${allContext}` : ''}

RULES FOR THIS OUTPUT:

1. USE THE ONLINE EXECUTIVE INTELLIGENCE. Real executives found in the Executive Social / public search data (names, roles, LinkedIn activity) are valuable — reference them BY NAME and weave their public activity into who to focus on, what conversations to drive, and what's happening. This is the good intelligence the AM needs.

2. NEVER claim a named executive "will attend" / "is attending" / "is a confirmed attendee" unless their name is in the Confirmed Attendees list.
   - IF a Confirmed Attendees list IS provided: "who_to_focus" centers on THOSE attendees by name.
   - IF NO Confirmed Attendees list: "who_to_focus" centers on the real key executives found online (name them, e.g. the CEO from LinkedIn) as the people who matter and are worth engaging/researching — do NOT frame them as session attendees, and do NOT add any disclaimer about the list not being imported. Just give the consultative recommendation naturally.

3. EXECUTIVE TONE — THIS IS AN EBC (business, not technical). Speak the language of the boardroom: business outcomes, competitive position, workforce strategy, ROI, talent. Do NOT go into technical services, architectures, or product mechanics. No jargon.

4. FORMAT — BRIEVITY FIRST. Each main field is a SHORT executive summary: 1-2 sentences, plain readable prose, NO asterisks, NO bullet lists, NO markdown. The matching "_detail" field holds the fuller reasoning (a few sentences, still executive-level, still no heavy markdown) for a "more info" expansion.

Return JSON with exactly these fields (summary = brief; detail = expanded):
{
  "who_to_focus": "1-2 sentence executive summary. Name real executives found online (or confirmed attendees if imported) and why they matter.",
  "who_to_focus_detail": "2-4 sentences expanding on each key person's role, public activity, and how to approach them — executive tone, no technical jargon.",
  "what_conversations": "1-2 sentence summary of the strategic conversation angle to drive, grounded in their real business signals.",
  "what_conversations_detail": "2-4 sentences expanding the conversation strategy, referencing named executives' public activity and the company's real challenges.",
  "where_to_start": "1-2 sentence summary of the recommended strategic approach to their skills transformation (methodology, not products).",
  "where_to_start_detail": "2-4 sentences expanding the approach: assessment → strategy → execution → measurement. May briefly note AWS can enable this at the end.",
  "whats_happening": "1-2 sentence summary of what's happening in their world creating urgency now.",
  "whats_happening_detail": "2-4 sentences expanding on industry, hiring, sentiment, and named executives' public statements found online."
}`;

    const result = await invokeClaudeJSON<AccountInsightsResponse>(
      EXPERT_PERSONA + '\n' + ANTI_FABRICATION_POLICY + '\n\n' + SYSTEM_PROMPT,
      [{ role: 'user', content: userMessage }],
      { maxTokens: 2048, temperature: 0.7 }
    );



    return success(result);
  } catch (err) {
    console.error('Error generating account insights:', err);
    return error(500, 'Failed to generate account insights');
  }
}

function buildAccountContext(accountData: any, tcData: any): string {
  const lines: string[] = [];

  lines.push(`Company: ${accountData.customer_name}`);
  lines.push(`Industry: ${accountData.industry} | Segment: ${accountData.segment} | Geo: ${accountData.geo}`);
  // Salesforce data
  if (accountData.sfdc_data) {
    lines.push(`\nSALESFORCE:`);
    lines.push(`Open Opportunities: ${accountData.sfdc_data.open_opps}`);
    lines.push(`T2K: ${accountData.sfdc_data.t2k ? 'Yes' : 'No'}`);
    lines.push(`Account Plan Priority: ${accountData.sfdc_data.account_plan_priority}`);
    lines.push(`SMGS Phase: ${accountData.sfdc_data.smgs_phase}`);
  }

  // T&C Current State
  if (accountData.tc_current_state) {
    lines.push(`\nT&C CURRENT STATE:`);
    lines.push(`Skill Builder: ${accountData.tc_current_state.skill_builder ? `Yes (${accountData.tc_current_state.skill_builder_seats} seats, ${accountData.tc_current_state.activation_rate}% activation)` : 'No'}`);
    lines.push(`Certifications: ${accountData.tc_current_state.certifications}`);
    lines.push(`Prior Engagement: ${accountData.tc_current_state.prior_engagement || 'None'}`);
    lines.push(`Renewal Date: ${accountData.tc_current_state.renewal_date || 'N/A'}`);
  }

  // T&C Opportunity Data (from T&C pipeline system)
  if (tcData) {
    lines.push(`\nT&C OPPORTUNITY DATA (IMPORTANT — use this to inform your recommendations):`);
    lines.push(`Total Pipeline: $${(tcData.totalPipeline || 0).toLocaleString()}`);
    lines.push(`Open T&C Opportunities: ${tcData.openOpportunities || 0}`);
    lines.push(`Closed Won Revenue: $${(tcData.closedWonRevenue || 0).toLocaleString()}`);
    lines.push(`Products: ${(tcData.products || []).join(', ') || 'None'}`);
    lines.push(`Total Students: ${tcData.totalStudents || 0}`);
    if (tcData.openOpportunities > 0) {
      lines.push(`NOTE: This customer has ACTIVE T&C opportunities. Reference these in your recommendations — build on existing engagement.`);
    }
  }

  // EBC Data
  if (accountData.ebc_data) {
    lines.push(`\nEBC DATA:`);
    lines.push(`Meeting Dates: ${(accountData.ebc_data.meeting_dates || []).join(', ')}`);
    lines.push(`Themes: ${(accountData.ebc_data.themes || []).join(', ')}`);
    const attendees = accountData.ebc_data.attendees || [];
    if (attendees.length > 0) {
      lines.push(`Confirmed Attendees: ${attendees.map((a: any) => `${a.name} (${a.title}, ${a.persona})`).join('; ')}`);
    } else {
      lines.push(`Confirmed Attendees: NONE — no attendee list has been provided for this EBC. Do NOT invent or name any specific individuals. Refer only to executive ROLES/personas (e.g. "the CFO", "the CHRO") in general terms.`);
    }
  }

  // Signals
  if (accountData.signals?.length) {
    lines.push(`\nSIGNALS:`);
    accountData.signals.forEach((s: any) => {
      lines.push(`[${s.severity}] ${s.label}: ${s.evidence}`);
    });
  }

  // Public Intelligence
  if (accountData.public_intelligence) {
    const pi = accountData.public_intelligence;
    lines.push(`\nPUBLIC INTELLIGENCE:`);
    if (pi.earnings_call_signals?.length) lines.push(`Earnings Calls: ${pi.earnings_call_signals.join('; ')}`);
    if (pi.linkedin_job_postings) lines.push(`LinkedIn: ${pi.linkedin_job_postings.cloud_ai_roles} cloud/AI roles (${pi.linkedin_job_postings.yoy_change} YoY)`);
    if (pi.executive_social?.length) {
      lines.push(`Executive Social:`);
      pi.executive_social.forEach((e: any) => lines.push(`  - ${e.name} (${e.title}): "${e.post_theme}"`));
    }
    if (pi.glassdoor_signals?.length) lines.push(`Glassdoor: ${pi.glassdoor_signals.join('; ')}`);
    if (pi.industry_context) lines.push(`Industry Context: ${pi.industry_context}`);
    if (pi.news_signals?.length) lines.push(`News: ${pi.news_signals.join('; ')}`);
  }

  // Account Plan / Captured Page Content (if uploaded or captured by user)
  if (accountData.accountPlanText) {
    lines.push(`\nCAPTURED ACCOUNT DATA (from Salesforce page or uploaded document — IMPORTANT: analyze this for training status, Polaris level, T&C engagement history, opportunity pipeline, and any skills/workforce development information. Use this data to inform ALL your recommendations):`);
    lines.push(accountData.accountPlanText.slice(0, 8000));
  }

  return lines.join('\n');
}
