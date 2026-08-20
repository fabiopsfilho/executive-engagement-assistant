import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { invokeClaudeJSON } from '../shared/bedrock';
import { success, error } from '../shared/response';
import { getTCStrategyContext } from '../shared/knowledge-base';
import { tavilySearch, tavilyLinkedInSearch, tavilyGlassdoorSearch } from '../shared/tavily';

const ddbClient = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(ddbClient);

interface IntelligenceResponse {
  earnings_call_signals: string[];
  linkedin_job_postings: { cloud_ai_roles: number; yoy_change: string };
  executive_social: { name: string; title: string; post_theme: string; url?: string }[];
  glassdoor_signals: string[];
  industry_context: string;
  news_signals: string[];
  signals: { severity: 'HIGH' | 'MEDIUM'; label: string; evidence: string }[];
  tc_opportunity_score: number;
}

const SYSTEM_PROMPT = `You are an intelligence analyst supporting the AWS Training & Certification Skills Enablement team. You will receive REAL Google search results about a company. Extract and structure ONLY factual information found in the search results into JSON.

CRITICAL GUARDRAILS:
1. ONLY include information that is DIRECTLY supported by the search results provided.
2. For executive_social: ONLY include executives where you found REAL LinkedIn posts or profiles in the search results. Include the LinkedIn URL if visible. If no executive social data was found, return an empty array [].
3. NEVER fabricate names, titles, quotes, or data. If search results are empty or irrelevant, return empty arrays/zero values.
4. For linkedin_job_postings: Only include real numbers if found in search results. If not found, use 0 and empty string.
5. For glassdoor_signals: Only include REAL review excerpts found in search results. If none found, return empty array [].
6. Do NOT label anything as an estimate or unavailable — just omit what wasn't found.

JSON structure:
{"earnings_call_signals":["quote1","quote2"],"linkedin_job_postings":{"cloud_ai_roles":number,"yoy_change":"+X%"},"executive_social":[{"name":"Real Name","title":"Real Title","post_theme":"What they posted about","url":"https://linkedin.com/..."}],"glassdoor_signals":["real review excerpt"],"industry_context":"context from news","news_signals":["real news"],"signals":[{"severity":"HIGH","label":"label","evidence":"evidence from search"}],"tc_opportunity_score":number}

Return ONLY valid JSON, no markdown.`;

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const accountId = event.pathParameters?.accountId;
    if (!accountId) {
      return error(400, 'accountId is required');
    }

    const companyName = event.queryStringParameters?.company || accountId;
    const industry = event.queryStringParameters?.industry || 'Technology';

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
      // Cache miss — continue
    }

    // Fetch REAL data from Tavily search (parallel requests) + Knowledge Base
    const [linkedinResults, glassdoorResults, newsResults, dataBookResults, executivePostsResults, chroSkillsResults, kbDocs] = await Promise.all([
      tavilyLinkedInSearch(`${companyName} jobs cloud AI engineer hiring`),
      tavilyGlassdoorSearch(`${companyName} reviews culture training learning`),
      tavilySearch(`${companyName} cloud AI digital transformation 2025 2026 news`),
      tavilySearch(`${companyName} AWS cloud spend revenue technology investment`),
      tavilyLinkedInSearch(`${companyName} CEO CTO CFO CHRO executives`),
      tavilySearch(`${companyName} CHRO HR skills transformation workforce development talent strategy`),
      getTCStrategyContext(industry, 'CTO', []).catch(() => ''),
    ]);

    // Build context from real search results
    const searchContext = [
      linkedinResults ? `LINKEDIN JOB POSTINGS:\n${linkedinResults}` : '',
      executivePostsResults ? `EXECUTIVE LINKEDIN PROFILES & POSTS:\n${executivePostsResults}` : '',
      chroSkillsResults ? `CHRO / HR / SKILLS TRANSFORMATION:\n${chroSkillsResults}` : '',
      glassdoorResults ? `GLASSDOOR EMPLOYEE REVIEWS:\n${glassdoorResults}` : '',
      newsResults ? `COMPANY NEWS & TRANSFORMATION:\n${newsResults}` : '',
      dataBookResults ? `COMPANY DATA, REVENUE & INVESTMENT:\n${dataBookResults}` : '',
    ].filter(Boolean).join('\n\n');

    let userMessage: string;
    if (searchContext || kbDocs) {
      const kbSection = kbDocs ? `\n\nT&C KNOWLEDGE BASE (PRIMARY REFERENCE):\n${kbDocs.slice(0, 3000)}` : '';
      const searchSection = searchContext ? `\n\nONLINE SEARCH RESULTS (SUPPLEMENTARY):\n${searchContext}` : '';
      userMessage = `Based on the available intelligence about ${companyName} (${industry}), extract and structure the intelligence into JSON. Use the T&C Knowledge Base content as your primary reference for recommendations. The online search results supplement this with real-time data about the specific company.${kbSection}${searchSection}`;
    } else {
      userMessage = `Generate workforce intelligence JSON for: ${companyName} (${industry}). Focus on the company name, industry, and T&C Knowledge Base context to provide relevant intelligence. Do not label anything as an estimate.`;
    }

    const result = await invokeClaudeJSON<IntelligenceResponse>(
      SYSTEM_PROMPT,
      [{ role: 'user', content: userMessage }],
      { maxTokens: 2048, temperature: 0.3 }
    );

    // Cache for 24 hours
    try {
      await ddb.send(new PutCommand({
        TableName: process.env.INTELLIGENCE_CACHE_TABLE!,
        Item: {
          cacheKey,
          data: result,
          ttl: Math.floor(Date.now() / 1000) + 86400,
          createdAt: new Date().toISOString(),
        },
      }));
    } catch (cacheErr) {
      console.warn('Failed to cache:', cacheErr);
    }

    return success(result);
  } catch (err) {
    console.error('Error generating intelligence:', err);
    return error(500, 'Failed to generate intelligence');
  }
}
