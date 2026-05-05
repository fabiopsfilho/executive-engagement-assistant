import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { invokeClaudeJSON } from '../shared/bedrock';
import { success, error } from '../shared/response';

const ddbClient = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(ddbClient);

interface IntelligenceResponse {
  earnings_call_signals: string[];
  linkedin_job_postings: { cloud_ai_roles: number; yoy_change: string };
  executive_social: { name: string; title: string; post_theme: string }[];
  glassdoor_signals: string[];
  industry_context: string;
  news_signals: string[];
  signals: { severity: 'HIGH' | 'MEDIUM'; label: string; evidence: string }[];
  tc_opportunity_score: number;
}

async function searchWeb(query: string): Promise<string> {
  // Use a simple fetch to get search results from a public search API
  // This uses the Google Custom Search JSON API or falls back to generating from knowledge
  const searchApiKey = process.env.SEARCH_API_KEY;
  const searchEngineId = process.env.SEARCH_ENGINE_ID;
  
  if (searchApiKey && searchEngineId) {
    try {
      const url = `https://www.googleapis.com/customsearch/v1?key=${searchApiKey}&cx=${searchEngineId}&q=${encodeURIComponent(query)}&num=5`;
      const response = await fetch(url);
      const data = await response.json();
      if (data.items) {
        return data.items.map((item: { title: string; snippet: string }) => `${item.title}: ${item.snippet}`).join('\n');
      }
    } catch (e) {
      console.warn('Search API failed, falling back to Claude knowledge:', e);
    }
  }
  return ''; // Empty means Claude will use its training knowledge
}

const SYSTEM_PROMPT = `You are an intelligence analyst specializing in workforce transformation signals for enterprise technology companies. Your job is to analyze a company and its executives to identify signals that indicate readiness for AWS Training & Certification engagement.

You MUST generate intelligence that is as realistic and specific as possible. Use your knowledge of the company, its leadership, recent news, and industry context. Be specific with names, dates, and quotes where possible.

For EXECUTIVE SOCIAL: Identify real C-suite executives at this company by name and title. Generate realistic LinkedIn post themes based on what executives at this type of company typically discuss publicly.

For LINKEDIN JOB POSTINGS: Estimate the number of cloud/AI roles based on company size and industry. Provide a realistic YoY growth percentage.

For EARNINGS CALL SIGNALS: Generate realistic quotes that would come from this company's leadership about cloud, AI, workforce, and digital transformation.

For GLASSDOOR SIGNALS: Generate realistic employee sentiment about training, skills development, and culture at this company.

For NEWS SIGNALS: Reference real or highly plausible recent news about this company related to cloud, AI, partnerships, or transformation.

For INDUSTRY CONTEXT: Describe the competitive landscape and transformation pressures in this company's industry.

SIGNAL TYPES TO IDENTIFY:
1. TALENT WAR — Evidence of aggressive hiring for cloud/AI roles, talent competition, skills gaps
2. BOARD PRESSURE — Board or investor questions about workforce readiness, transformation execution
3. GREENFIELD T&C — No structured training engagement despite significant cloud investment
4. COMPLIANCE TRIGGER — Regulatory requirements that require documented workforce competency
5. SUBSCRIPTION UNDERPERFORMANCE — Low activation on existing training subscriptions
6. TRANSFORMATION ACCELERATION — Major cloud migration, AI initiative, or digital transformation underway

SCORING (1-10):
- Talent Signals (25%): Open cloud/AI roles, hiring velocity, skills gap evidence
- Business Signals (25%): AWS spend, open opportunities, strategic priority alignment
- Training State (20%): Greenfield opportunity or renewal risk
- Engagement Timing (15%): Proximity to decisions, budget cycles, transformation milestones
- Public Intelligence (15%): Richness of available signals

Return JSON matching this structure:
{
  "earnings_call_signals": ["CEO Name: quote about cloud/AI/workforce...", "CFO Name: quote..."],
  "linkedin_job_postings": {"cloud_ai_roles": number, "yoy_change": "+X%"},
  "executive_social": [{"name": "Real Executive Name", "title": "Their Real Title", "post_theme": "What they recently posted about on LinkedIn"}],
  "glassdoor_signals": ["Specific employee sentiment about training/skills/culture"],
  "industry_context": "Detailed competitive landscape and transformation pressures",
  "news_signals": ["Specific recent news about this company"],
  "signals": [{"severity": "HIGH|MEDIUM", "label": "Signal Type", "evidence": "Specific evidence"}],
  "tc_opportunity_score": number
}`;

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const accountId = event.pathParameters?.accountId;
    if (!accountId) {
      return error(400, 'accountId is required');
    }

    // Parse query parameters for company context
    const companyName = event.queryStringParameters?.company || accountId;
    const industry = event.queryStringParameters?.industry || 'Technology';
    const awsSpend = event.queryStringParameters?.awsSpend || '0';
    const executives = event.queryStringParameters?.executives || '';

    // Check cache first (24-hour TTL)
    const cacheKey = `intelligence:${companyName.toLowerCase().replace(/\s+/g, '-')}`;
    try {
      const cached = await ddb.send(new GetCommand({
        TableName: process.env.INTELLIGENCE_CACHE_TABLE!,
        Key: { cacheKey },
      }));
      if (cached.Item && cached.Item.ttl > Math.floor(Date.now() / 1000)) {
        return success(cached.Item.data);
      }
    } catch {
      // Cache miss — continue to generate
    }

    // Search the web for recent information about this company
    const [newsResults, linkedinResults, glassdoorResults] = await Promise.all([
      searchWeb(`${companyName} cloud AI transformation 2025 2026`),
      searchWeb(`${companyName} hiring cloud AI engineer jobs`),
      searchWeb(`${companyName} glassdoor employee reviews training culture`),
    ]);

    // Also try to read T&C opportunity data from S3 for this account
    let tcContext = '';
    try {
      const { S3Client: S3, GetObjectCommand: GetObj } = await import('@aws-sdk/client-s3');
      const s3Client = new S3({});
      const xlsxMod = await import('xlsx');
      const tcResponse = await s3Client.send(new GetObj({ Bucket: process.env.EBC_DATA_BUCKET!, Key: 'tc-opportunities.xlsx' }));
      const tcBuffer = await tcResponse.Body?.transformToByteArray();
      if (tcBuffer) {
        const wb = xlsxMod.read(tcBuffer, { type: 'buffer' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = xlsxMod.utils.sheet_to_json<Record<string, string | number>>(sheet);
        const accountRows = rows.filter(r => {
          const name = String(r['Account Name'] || '').toLowerCase();
          return name.includes(companyName.toLowerCase()) || companyName.toLowerCase().includes(name);
        });
        if (accountRows.length > 0) {
          const products = [...new Set(accountRows.map(r => String(r['Product Name'] || '')).filter(Boolean))];
          const totalPipeline = accountRows.filter(r => !['Closed Won', 'Closed Lost'].includes(String(r['Stage'] || ''))).reduce((sum, r) => sum + Number(r['Total Opportunity (converted)'] || 0), 0);
          const closedWon = accountRows.filter(r => String(r['Stage']) === 'Closed Won').reduce((sum, r) => sum + Number(r['Product Net Amount (converted)'] || 0), 0);
          const students = accountRows.reduce((sum, r) => sum + Number(r['Number of Students'] || 0), 0);
          const stages = [...new Set(accountRows.map(r => String(r['Stage'] || '')).filter(Boolean))];
          tcContext = `\n\nEXISTING T&C ENGAGEMENT DATA FOR THIS ACCOUNT:\n- Products: ${products.join(', ')}\n- Open Pipeline: $${totalPipeline.toLocaleString()}\n- Closed Won Revenue: $${closedWon.toLocaleString()}\n- Total Students Trained: ${students}\n- Opportunity Stages: ${stages.join(', ')}\n- Number of Opportunities: ${accountRows.length}\nUse this data to inform your intelligence analysis. Reference specific products and pipeline when generating signals and recommendations.`;
        }
      }
    } catch (tcErr) {
      console.warn('Could not read T&C data:', tcErr);
    }

    const webContext = [
      newsResults ? `\nWEB SEARCH RESULTS (News & Transformation):\n${newsResults}` : '',
      linkedinResults ? `\nWEB SEARCH RESULTS (Hiring):\n${linkedinResults}` : '',
      glassdoorResults ? `\nWEB SEARCH RESULTS (Employee Sentiment):\n${glassdoorResults}` : '',
    ].filter(Boolean).join('\n');

    // Generate intelligence via Bedrock
    const userMessage = `Analyze the following company and generate workforce transformation intelligence. Use SPECIFIC, REAL information about this company. Include real executive names and titles. Be as factual as possible.

COMPANY: ${companyName}
INDUSTRY: ${industry}
AWS SPEND: $${(parseInt(awsSpend) / 1_000_000).toFixed(1)}M
EXECUTIVES TO RESEARCH: ${executives || 'Research the C-suite (CEO, CFO, CTO/CIO, CHRO) — use their REAL names'}
${webContext}${tcContext}

Generate intelligence signals based on what you know about this company AND the web search results above. Include:
1. Earnings call signals — use REAL executive names and realistic quotes about AI, cloud, workforce, skills, transformation
2. LinkedIn hiring data — estimate cloud/AI roles based on company size and what you know about their hiring
3. Executive social media activity — use REAL executive names and their likely LinkedIn post themes
4. Glassdoor employee sentiment — realistic reviews about training, skills development, culture
5. Industry context and competitive landscape — who are their competitors and what are they doing
6. Recent news signals — real or highly plausible recent news
7. Severity-rated signals (HIGH/MEDIUM) with specific evidence
8. An overall T&C opportunity score (1-10)

Be SPECIFIC. Use real names. Reference real initiatives. Make this indistinguishable from manually researched intelligence.`;

    const result = await invokeClaudeJSON<IntelligenceResponse>(
      SYSTEM_PROMPT,
      [{ role: 'user', content: userMessage }],
      { maxTokens: 4096, temperature: 0.6 }
    );

    // Cache the result for 24 hours
    try {
      await ddb.send(new PutCommand({
        TableName: process.env.INTELLIGENCE_CACHE_TABLE!,
        Item: {
          cacheKey,
          data: result,
          ttl: Math.floor(Date.now() / 1000) + 86400, // 24 hours
          createdAt: new Date().toISOString(),
        },
      }));
    } catch (cacheErr) {
      console.warn('Failed to cache intelligence:', cacheErr);
    }

    return success(result);
  } catch (err) {
    console.error('Error generating intelligence:', err);
    return error(500, 'Failed to generate intelligence');
  }
}
