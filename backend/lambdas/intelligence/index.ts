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

const SYSTEM_PROMPT = `You are an intelligence analyst specializing in workforce transformation signals for enterprise technology companies. Your job is to analyze a company and its executives to identify signals that indicate readiness for AWS Training & Certification engagement.

You must generate realistic, grounded intelligence based on what you know about the company, its industry, and its executives. If you have specific knowledge about the company, use it. If not, generate plausible intelligence based on the industry, company size, and transformation context provided.

SIGNAL TYPES TO IDENTIFY:
1. TALENT WAR — Evidence of aggressive hiring for cloud/AI roles, talent competition, skills gaps
2. BOARD PRESSURE — Board or investor questions about workforce readiness, transformation execution
3. GREENFIELD T&C — No structured training engagement despite significant cloud investment
4. COMPLIANCE TRIGGER — Regulatory requirements (EU AI Act, SOX, HIPAA) that require documented workforce competency
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
  "earnings_call_signals": ["CEO: quote...", "CFO: quote..."],
  "linkedin_job_postings": {"cloud_ai_roles": number, "yoy_change": "+X%"},
  "executive_social": [{"name": "...", "title": "...", "post_theme": "..."}],
  "glassdoor_signals": ["signal 1", "signal 2"],
  "industry_context": "...",
  "news_signals": ["news 1", "news 2"],
  "signals": [{"severity": "HIGH|MEDIUM", "label": "...", "evidence": "..."}],
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

    // Generate intelligence via Bedrock
    const userMessage = `Analyze the following company and generate workforce transformation intelligence:

COMPANY: ${companyName}
INDUSTRY: ${industry}
AWS SPEND: $${(parseInt(awsSpend) / 1_000_000).toFixed(1)}M
EXECUTIVES TO RESEARCH: ${executives || 'Research the C-suite (CEO, CFO, CTO/CIO, CHRO)'}

Generate realistic intelligence signals based on what you know about this company. Include:
1. Earnings call signals related to AI, cloud, workforce, skills, transformation
2. LinkedIn hiring data for cloud/AI roles
3. Executive social media activity and thought leadership themes
4. Glassdoor employee sentiment about training, skills development, culture
5. Industry context and competitive landscape
6. Recent news signals
7. Severity-rated signals (HIGH/MEDIUM) with evidence
8. An overall T&C opportunity score (1-10)

Be specific and grounded. Use real information where available. Where you must infer, make it realistic for a ${industry} company of this scale.`;

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
