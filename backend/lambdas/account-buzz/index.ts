import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { invokeClaudeJSON } from '../shared/bedrock';
import { success, error } from '../shared/response';
import { getTCProductKnowledge } from '../shared/mcp';
import { getTCStrategyContext } from '../shared/knowledge-base';

const ddbClient = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(ddbClient);

/**
 * Google search for real-time intelligence
 */
async function googleSearch(query: string): Promise<string> {
  try {
    const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=5&hl=en`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    if (!response.ok) return '';
    const html = await response.text();
    const snippets: string[] = [];
    const matches = html.match(/<div[^>]*class="[^"]*"[^>]*>([^<]{40,300})<\/div>/g) || [];
    for (const match of matches.slice(0, 8)) {
      const text = match.replace(/<[^>]+>/g, '').trim();
      if (text.length > 40 && !text.includes('Google') && !text.includes('Sign in') && !text.includes('cookie')) {
        snippets.push(text);
      }
    }
    const textMatches = html.match(/class="BNeawe[^"]*"[^>]*>([^<]{20,500})/g) || [];
    for (const match of textMatches.slice(0, 6)) {
      const text = match.replace(/class="BNeawe[^"]*"[^>]*>/, '').trim();
      if (text.length > 20) snippets.push(text);
    }
    return snippets.slice(0, 8).join('\n');
  } catch {
    return '';
  }
}

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

SPECIFIC FUNCTION — INTELLIGENCE ANALYSIS:
Your role here is to help the T&C Skills Enablement team identify opportunities for skills transformation conversations with customer executives.

ADDITIONAL GUARDRAILS:
1. NEVER INFER OR SPECULATE. Only report what was ACTUALLY FOUND in search results or provided data.
2. If no data was found for a person or topic, DO NOT include them. Omit them entirely — never say "unavailable" or "no data found".
3. CHAMPION DESIGNATION: Only designate someone as an "AWS champion" if search results explicitly show AWS-related activity (posts about AWS, AWS certifications, AWS events attendance). Otherwise, do not use that term.
4. EXECUTIVE VOICES: Only include executives where REAL public data was found (LinkedIn posts, conference talks, published articles). If the search returned nothing for a person, exclude them completely from the response.
5. Frame everything through the T&C lens: skills transformation, workforce development, training ROI, certification programs, learning culture.
6. Be honest about what you know vs. don't know. If data is limited, say "Based on available data..." not "This person is..."

For BUZZ (What people are saying): Only report what was actually found in search results — real LinkedIn posts, real Glassdoor reviews, real news articles. If nothing was found, say so briefly and focus on what IS available.

For NOW (What to focus on): Based on CONFIRMED signals only, recommend what the T&C team should prioritize for skills transformation conversations.

Return ONLY valid JSON. For any array field, return an empty array [] if no real data was found — do NOT fill with speculation.`;

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const accountId = event.pathParameters?.accountId;
    if (!accountId) return error(400, 'accountId is required');

    const body = JSON.parse(event.body || '{}');
    const { accountData, tcData } = body;
    if (!accountData) return error(400, 'accountData is required');

    // Check cache (1-hour TTL — include attendee count so uploading new attendees busts cache)
    const attendeeCount = accountData.ebc_data?.attendees?.length || 0;
    const cacheKey = `buzz:${accountData.customer_name?.toLowerCase().replace(/\s+/g, '-')}:${attendeeCount}:${accountData.accountPlanText ? 'plan' : 'noplan'}`;
    try {
      const cached = await ddb.send(new GetCommand({
        TableName: process.env.INTELLIGENCE_CACHE_TABLE!,
        Key: { cacheKey },
      }));
      if (cached.Item && cached.Item.ttl > Math.floor(Date.now() / 1000)) {
        return success(cached.Item.data);
      }
    } catch { /* cache miss */ }

    // Fetch real-time intelligence from Google + AWS docs + Knowledge Base in parallel
    const industry = accountData.industry || 'Technology';
    const companyName = accountData.customer_name || 'Unknown';
    const [mcpDocs, kbDocs, linkedinResults, glassdoorResults, newsResults, executiveResults] = await Promise.all([
      getTCProductKnowledge(industry, ['workforce transformation', 'talent development']).catch(() => ''),
      getTCStrategyContext(industry, 'CTO', accountData.ebc_data?.themes || []).catch(() => ''),
      googleSearch(`${companyName} site:linkedin.com cloud AI engineer jobs`).catch(() => ''),
      googleSearch(`${companyName} site:glassdoor.com reviews culture training development`).catch(() => ''),
      googleSearch(`${companyName} cloud AI digital transformation 2025 2026 news`).catch(() => ''),
      googleSearch(`"${companyName}" CEO OR CTO OR CFO OR CHRO site:linkedin.com`).catch(() => ''),
    ]);
    const awsContext = [mcpDocs, kbDocs].filter(Boolean).join('\n\n');
    const onlineSearch = [
      linkedinResults ? `LINKEDIN SEARCH RESULTS:\n${linkedinResults}` : '',
      glassdoorResults ? `GLASSDOOR SEARCH RESULTS:\n${glassdoorResults}` : '',
      newsResults ? `NEWS & TRANSFORMATION SEARCH:\n${newsResults}` : '',
      executiveResults ? `EXECUTIVE LINKEDIN PROFILES:\n${executiveResults}` : '',
    ].filter(Boolean).join('\n\n');

    // Build the context
    const pi = accountData.public_intelligence || {};
    const context = `
COMPANY: ${accountData.customer_name} (${industry}, ${accountData.segment}, ${accountData.geo})
AWS SPEND: ${(accountData.aws_spend?.current_year && accountData.aws_spend.current_year > 0) ? '$' + accountData.aws_spend.current_year.toLocaleString() : 'Data not available (do NOT assume zero)'}
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

${accountData.accountPlanText ? `ACCOUNT PLAN DOCUMENT (analyze for T&C opportunities and executive engagement angles):\n${accountData.accountPlanText.slice(0, 6000)}` : ''}
${awsContext ? `AWS T&C KNOWLEDGE BASE & DOCUMENTATION:\n${awsContext.slice(0, 3000)}` : ''}
${onlineSearch ? `\nREAL-TIME ONLINE SEARCH RESULTS:\n${onlineSearch.slice(0, 3000)}` : ''}`;

    const userMessage = `Analyze this account's intelligence and generate both BUZZ and NOW insights. Be highly specific — reference actual names, numbers, and quotes from the data.

Use the T&C Knowledge Base content as your primary reference for recommendations. The online search results supplement this with real-time data about the specific company.

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
