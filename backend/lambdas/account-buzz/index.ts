import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { invokeClaudeJSON } from '../shared/bedrock';
import { success, error } from '../shared/response';
import { getTCProductKnowledge } from '../shared/mcp';
import { getTCStrategyContext } from '../shared/knowledge-base';

const ddbClient = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(ddbClient);

export interface BuzzNowResponse {
  buzz_summary: string;
  buzz_executive_insights: string[];
  buzz_hiring_analysis: string;
  buzz_sentiment_analysis: string;
  now_focus: string;
  now_initiatives: string[];
  now_key_asks: string[];
  now_opening_move: string;
}

const SYSTEM_PROMPT = `You are a senior AWS Training & Certification strategist analyzing real-time intelligence about a customer account. You synthesize multiple data signals into actionable insights.

Your analysis must be:
- Grounded in the ACTUAL data provided (reference specific numbers, names, quotes)
- Actionable (tell the Account Manager exactly what to do with this information)
- Connected to T&C opportunities (how does each signal create a training/certification opportunity?)
- Specific to THIS account (never generic)

For BUZZ (What people are saying): Synthesize executive social activity, hiring trends, employee sentiment, and industry news into a coherent narrative about what's happening at this company and what it means for T&C.

For NOW (What to focus on): Based on the signals, tell the AM exactly what to prioritize, what conversations to have, what questions to ask, and what their opening move should be.

Return ONLY valid JSON.`;

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const accountId = event.pathParameters?.accountId;
    if (!accountId) return error(400, 'accountId is required');

    const body = JSON.parse(event.body || '{}');
    const { accountData, tcData } = body;
    if (!accountData) return error(400, 'accountData is required');

    // Check cache (1-hour TTL)
    const cacheKey = `buzz:${accountData.customer_name?.toLowerCase().replace(/\s+/g, '-')}`;
    try {
      const cached = await ddb.send(new GetCommand({
        TableName: process.env.INTELLIGENCE_CACHE_TABLE!,
        Key: { cacheKey },
      }));
      if (cached.Item && cached.Item.ttl > Math.floor(Date.now() / 1000)) {
        return success(cached.Item.data);
      }
    } catch { /* cache miss */ }

    // Fetch AWS T&C documentation and Knowledge Base context in parallel
    const industry = accountData.industry || 'Technology';
    const [mcpDocs, kbDocs] = await Promise.all([
      getTCProductKnowledge(industry, ['workforce transformation', 'talent development']).catch(() => ''),
      getTCStrategyContext(industry, 'CTO', accountData.ebc_data?.themes || []).catch(() => ''),
    ]);
    const awsContext = [mcpDocs, kbDocs].filter(Boolean).join('\n\n');

    // Build the context
    const pi = accountData.public_intelligence || {};
    const context = `
COMPANY: ${accountData.customer_name} (${industry}, ${accountData.segment}, ${accountData.geo})
AWS SPEND: $${(accountData.aws_spend?.current_year || 0).toLocaleString()} (prior: $${(accountData.aws_spend?.prior_year || 0).toLocaleString()})
STRATEGIC PRIORITY: ${accountData.sfdc_data?.account_plan_priority || 'Unknown'}
SMGS PHASE: ${accountData.sfdc_data?.smgs_phase || 'Unknown'}
T2K: ${accountData.sfdc_data?.t2k ? 'Yes' : 'No'}

T&C STATE:
${accountData.tc_current_state?.skill_builder ? `Skill Builder: ${accountData.tc_current_state.skill_builder_seats} seats, ${accountData.tc_current_state.activation_rate}% activation` : 'No Skill Builder (Greenfield)'}
Certifications: ${accountData.tc_current_state?.certifications || 0}
Prior Engagement: ${accountData.tc_current_state?.prior_engagement || 'None'}
Renewal: ${accountData.tc_current_state?.renewal_date || 'N/A'}

${tcData ? `T&C PIPELINE DATA:
Pipeline: $${(tcData.totalPipeline || 0).toLocaleString()}
Open Opportunities: ${tcData.openOpportunities || 0}
Closed Won: $${(tcData.closedWonRevenue || 0).toLocaleString()}
Products: ${(tcData.products || []).join(', ')}
Students: ${tcData.totalStudents || 0}` : 'No T&C pipeline data available'}

SIGNALS:
${(accountData.signals || []).map((s: any) => `[${s.severity}] ${s.label}: ${s.evidence}`).join('\n')}

EXECUTIVE SOCIAL ACTIVITY:
${(pi.executive_social || []).map((e: any) => `${e.name} (${e.title}): "${e.post_theme}"${e.url ? ` [${e.url}]` : ''}`).join('\n') || 'None detected'}

LINKEDIN HIRING:
${pi.linkedin_job_postings ? `${pi.linkedin_job_postings.cloud_ai_roles} cloud/AI roles (${pi.linkedin_job_postings.yoy_change} YoY)` : 'No data'}

GLASSDOOR EMPLOYEE SENTIMENT:
${(pi.glassdoor_signals || []).map((s: string) => `"${s}"`).join('\n') || 'No data'}

EARNINGS CALL SIGNALS:
${(pi.earnings_call_signals || []).join('\n') || 'No data'}

INDUSTRY CONTEXT:
${pi.industry_context || 'No data'}

NEWS SIGNALS:
${(pi.news_signals || []).join('\n') || 'No data'}

EBC DATA:
Date: ${accountData.ebc_data?.meeting_dates?.[0] || 'TBD'}
Location: ${accountData.ebc_data?.location || 'TBD'}
Themes: ${(accountData.ebc_data?.themes || []).join(', ')}
Attendees: ${(accountData.ebc_data?.attendees || []).map((a: any) => `${a.name} (${a.persona})`).join(', ')}

${awsContext ? `AWS T&C KNOWLEDGE BASE & DOCUMENTATION:\n${awsContext.slice(0, 3000)}` : ''}`;

    const userMessage = `Analyze this account's intelligence and generate both BUZZ and NOW insights. Be highly specific — reference actual names, numbers, and quotes from the data.

${context}

Return JSON:
{
  "buzz_summary": "2-3 sentence synthesis of what's happening at this company based on all signals",
  "buzz_executive_insights": ["Insight about each executive's activity and what it means for T&C — 1 per executive"],
  "buzz_hiring_analysis": "What the hiring data tells us about their skills gap and T&C opportunity",
  "buzz_sentiment_analysis": "What employees are saying and what it means for training programs",
  "now_focus": "The single most important thing to focus on right now and why",
  "now_initiatives": ["Top 3 specific initiatives to drive, each connected to a signal"],
  "now_key_asks": ["4 specific questions to ask in the next conversation, grounded in the data"],
  "now_opening_move": "The exact opening move — what to say, who to say it to, and why it works"
}`;

    const result = await invokeClaudeJSON<BuzzNowResponse>(
      SYSTEM_PROMPT,
      [{ role: 'user', content: userMessage }],
      { maxTokens: 2048, temperature: 0.7 }
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
    } catch { /* continue */ }

    return success(result);
  } catch (err) {
    console.error('Error generating buzz/now insights:', err);
    return error(500, 'Failed to generate buzz/now insights');
  }
}
