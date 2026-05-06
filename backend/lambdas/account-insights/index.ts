import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { invokeClaudeJSON } from '../shared/bedrock';
import { success, error } from '../shared/response';
import { getTCStrategyContext } from '../shared/knowledge-base';

const ddbClient = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(ddbClient);

export interface AccountInsightsResponse {
  who_to_focus: string;
  what_conversations: string;
  where_to_start: string;
  whats_happening: string;
}

const SYSTEM_PROMPT = `You are a senior AWS Training & Certification (T&C) strategist helping Account Managers prepare for executive engagements. You generate highly specific, actionable insights for each account based on their unique data.

Your responses must be:
- Specific to THIS account (reference real data points, names, numbers)
- Actionable (tell the AM exactly what to do, not generic advice)
- Grounded in the T&C framework (Skill Builder, Certification, Private Training, Skills Guild, Cloud Institute, re/Start, Jam)
- Written in a direct, conversational tone (2-3 sentences max per answer)
- Different for every account — never use generic templates

T&C Engagement Patterns to consider:
- Talent War: losing talent to competitors, high open roles
- Board Pressure: board asking about AI/cloud ROI, workforce readiness
- Compliance Trigger: regulatory requirements (EU AI Act, HIPAA, etc.)
- Subscription Underperformance: low activation, upcoming renewal

Persona-specific first moves:
- CHRO: Learning Needs Assessment
- CFO: Custom ROI model (Forrester 229% ROI)
- CIO/CTO: Role-based Skill Builder pilot
- CEO: Skills Transformation Partnership vision

Return ONLY valid JSON with these four fields. Each field should be 2-3 sentences of highly specific, data-grounded insight.`;

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

    // Check cache (1-hour TTL for insights — shorter than intelligence since these are more dynamic)
    const cacheKey = `insights:${accountData.customer_name?.toLowerCase().replace(/\s+/g, '-')}`;
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

    // Retrieve relevant T&C strategy content from Knowledge Base
    const persona = accountData.ebc_data?.attendees?.[0]?.persona || 'CTO';
    const industry = accountData.industry || 'Technology';
    const themes = accountData.ebc_data?.themes || [];
    const kbContext = await getTCStrategyContext(industry, persona, themes);

    const userMessage = `Generate four strategic insights for this account. Be HIGHLY SPECIFIC — reference actual names, numbers, and signals from the data. Use the T&C Knowledge Base context to recommend specific plays, proof points, and approaches that are documented in our strategy materials.

ACCOUNT DATA:
${context}
${kbContext}

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

  return lines.join('\n');
}
