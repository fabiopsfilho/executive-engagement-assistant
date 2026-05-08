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

export interface NextStepsResponse {
  next_steps: string[];
  key_asks: string[];
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

SPECIFIC FUNCTION — NEXT STEPS & KEY ASKS:
You are a senior AWS Training & Certification strategist generating specific, actionable next steps and key asks for an account engagement.

Your output must be:
- Grounded in the ACTUAL data provided (reference specific numbers, names, quotes)
- Actionable (tell the Account Manager exactly what to do)
- Connected to T&C opportunities (how does each step create a training/certification opportunity?)
- Specific to THIS account (never generic)

For NEXT STEPS: Generate 5 specific, actionable next steps that the AM should take. Each should reference real data from the account (hiring numbers, executive names, Glassdoor feedback, financial data, etc.)

For KEY ASKS: Generate 5 specific questions or commitments to secure from the customer. Each should be grounded in the account's actual situation and data signals.

Return ONLY valid JSON.`;

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const accountId = event.pathParameters?.accountId;
    if (!accountId) return error(400, 'accountId is required');

    const body = JSON.parse(event.body || '{}');
    const { accountData, tcData } = body;
    if (!accountData) return error(400, 'accountData is required');



    // Fetch real-time intelligence from Google + AWS docs + Knowledge Base in parallel
    const industry = accountData.industry || 'Technology';
    const companyName = accountData.customer_name || 'Unknown';
    const [mcpDocs, kbDocs, linkedinResults, glassdoorResults, newsResults, databookResults] = await Promise.all([
      getTCProductKnowledge(industry, ['workforce transformation', 'talent development']).catch(() => ''),
      getTCStrategyContext(industry, 'CTO', accountData.ebc_data?.themes || []).catch(() => ''),
      googleSearch(`${companyName} site:linkedin.com cloud AI engineer jobs`).catch(() => ''),
      googleSearch(`${companyName} site:glassdoor.com reviews culture training development`).catch(() => ''),
      googleSearch(`${companyName} cloud AI digital transformation 2025 2026 news`).catch(() => ''),
      googleSearch(`${companyName} revenue earnings financial results 2025`).catch(() => ''),
    ]);
    const awsContext = [mcpDocs, kbDocs].filter(Boolean).join('\n\n');
    const onlineSearch = [
      linkedinResults ? `LINKEDIN SEARCH RESULTS:\n${linkedinResults}` : '',
      glassdoorResults ? `GLASSDOOR SEARCH RESULTS:\n${glassdoorResults}` : '',
      newsResults ? `NEWS & TRANSFORMATION SEARCH:\n${newsResults}` : '',
      databookResults ? `FINANCIAL/DATABOOK SEARCH:\n${databookResults}` : '',
    ].filter(Boolean).join('\n\n');

    // Build the context
    const pi = accountData.public_intelligence || {};
    const isGreenfield = !accountData.tc_current_state?.skill_builder;
    const context = `
COMPANY: ${companyName} (${industry}, ${accountData.segment}, ${accountData.geo})
STRATEGIC PRIORITY: ${accountData.sfdc_data?.account_plan_priority || 'Unknown'}
SMGS PHASE: ${accountData.sfdc_data?.smgs_phase || 'Unknown'}
T2K: ${accountData.sfdc_data?.t2k ? 'Yes' : 'No'}

T&C STATE:
${isGreenfield ? `Greenfield — ${accountData.tc_current_state?.certifications || 0} organic certifications, no structured program` : `Existing — ${accountData.tc_current_state?.skill_builder_seats || 0} Skill Builder seats, ${accountData.tc_current_state?.activation_rate || 0}% activation, renewal: ${accountData.tc_current_state?.renewal_date || 'N/A'}`}
Prior Engagement: ${accountData.tc_current_state?.prior_engagement || 'None'}

${tcData ? `T&C PIPELINE DATA:
Pipeline: ${(tcData.totalPipeline || 0).toLocaleString()}
Open Opportunities: ${tcData.openOpportunities || 0}
Closed Won: ${(tcData.closedWonRevenue || 0).toLocaleString()}
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

    const userMessage = `Based on all the intelligence gathered for ${companyName}, generate specific next steps and key asks for the T&C engagement.

Use the T&C Knowledge Base content as your primary reference for recommendations. The online search results supplement this with real-time data about the specific company.

${context}

Return JSON:
{
  "next_steps": [
    "5 specific, actionable next steps — each referencing real data (names, numbers, quotes). Example: 'Conduct a Learning Needs Assessment targeting the 45 open cloud/AI roles identified on LinkedIn...' NOT generic like 'Schedule a meeting'"
  ],
  "key_asks": [
    "5 specific questions or commitments to secure — each grounded in account data. Example: 'Secure Maria Santos (CHRO) as executive sponsor — she posted about talent development last week' NOT generic like 'Get executive buy-in'"
  ]
}`;

    const result = await invokeClaudeJSON<NextStepsResponse>(
      SYSTEM_PROMPT,
      [{ role: 'user', content: userMessage }],
      { maxTokens: 2048, temperature: 0.7 }
    );


    return success(result);
  } catch (err) {
    console.error('Error generating next steps:', err);
    return error(500, 'Failed to generate next steps and key asks');
  }
}
