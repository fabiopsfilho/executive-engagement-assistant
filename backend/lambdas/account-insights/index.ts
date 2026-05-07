import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { invokeClaudeJSON } from '../shared/bedrock';
import { success, error } from '../shared/response';
import { getTCStrategyContext } from '../shared/knowledge-base';
import { getTCProductKnowledge } from '../shared/mcp';

const ddbClient = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(ddbClient);

export interface AccountInsightsResponse {
  who_to_focus: string;
  what_conversations: string;
  where_to_start: string;
  whats_happening: string;
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

Your responses must be:
- Based ONLY on confirmed data provided (reference real data points, names, numbers)
- Actionable for the T&C Skills Enablement team (what skills transformation conversations to drive)
- Grounded in the T&C framework (Skill Builder, Certification, Private Training, Skills Guild, Cloud Institute, re/Start, Jam)
- Written in a direct, conversational tone (2-3 sentences max per answer)
- Honest about data limitations — if limited data, say so briefly

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

    // Check cache (1-hour TTL for insights — include attendee count in key so uploading new attendees busts cache)
    const attendeeCount = accountData.ebc_data?.attendees?.length || 0;
    const cacheKey = `insights:${accountData.customer_name?.toLowerCase().replace(/\s+/g, '-')}:${attendeeCount}`;
    try {
      const cached = await ddb.send(new GetCommand({
        TableName: process.env.INTELLIGENCE_CACHE_TABLE!,
        Key: { cacheKey },
      }));
      if (cached.Item && cached.Item.ttl > Math.floor(Date.now() / 1000)) {
        return success(cached.Item.data);
      }
    } catch {
      // Cache miss — continue
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

    const userMessage = `Generate four strategic insights for this account. Be HIGHLY SPECIFIC — reference actual names, numbers, and signals from the data. Use the T&C Knowledge Base context to recommend specific plays, proof points, and approaches that are documented in our strategy materials.

ACCOUNT DATA:
${context}
${allContext ? `\nAWS T&C KNOWLEDGE & DOCUMENTATION:\n${allContext}` : ''}

Return JSON with exactly these fields:
{
  "who_to_focus": "Which specific executive(s) to prioritize and WHY based on their signals",
  "what_conversations": "What specific conversation angles to drive based on their signals and pain points",
  "where_to_start": "The specific first move — what T&C play to lead with and why it fits THIS account",
  "whats_happening": "What's happening in their world that creates urgency for T&C NOW"
}`;

    const result = await invokeClaudeJSON<AccountInsightsResponse>(
      SYSTEM_PROMPT,
      [{ role: 'user', content: userMessage }],
      { maxTokens: 1024, temperature: 0.7 }
    );

    // Cache for 1 hour
    try {
      await ddb.send(new PutCommand({
        TableName: process.env.INTELLIGENCE_CACHE_TABLE!,
        Item: {
          cacheKey,
          data: result,
          ttl: Math.floor(Date.now() / 1000) + 3600,
          createdAt: new Date().toISOString(),
        },
      }));
    } catch (cacheErr) {
      console.warn('Failed to cache insights:', cacheErr);
    }

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
  lines.push(`AWS Spend: $${(accountData.aws_spend?.current_year || 0).toLocaleString()} (prior year: $${(accountData.aws_spend?.prior_year || 0).toLocaleString()})`);
  lines.push(`PPA: ${accountData.aws_spend?.ppa || 'None'}`);

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
    lines.push(`\nT&C OPPORTUNITY DATA:`);
    lines.push(`Total Pipeline: $${(tcData.totalPipeline || 0).toLocaleString()}`);
    lines.push(`Open T&C Opportunities: ${tcData.openOpportunities || 0}`);
    lines.push(`Closed Won Revenue: $${(tcData.closedWonRevenue || 0).toLocaleString()}`);
    lines.push(`Products: ${(tcData.products || []).join(', ') || 'None'}`);
    lines.push(`Total Students: ${tcData.totalStudents || 0}`);
  }

  // EBC Data
  if (accountData.ebc_data) {
    lines.push(`\nEBC DATA:`);
    lines.push(`Meeting Dates: ${(accountData.ebc_data.meeting_dates || []).join(', ')}`);
    lines.push(`Themes: ${(accountData.ebc_data.themes || []).join(', ')}`);
    lines.push(`Attendees: ${(accountData.ebc_data.attendees || []).map((a: any) => `${a.name} (${a.title}, ${a.persona})`).join('; ')}`);
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

  // Account Plan (if uploaded by user)
  if (accountData.accountPlanText) {
    lines.push(`\nACCOUNT PLAN DOCUMENT (uploaded by user — this is the customer's strategic plan, analyze it for T&C opportunities):`);
    lines.push(accountData.accountPlanText.slice(0, 8000));
  }

  return lines.join('\n');
}
