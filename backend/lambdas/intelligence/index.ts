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
  executive_social: { name: string; title: string; post_theme: string; url?: string }[];
  glassdoor_signals: string[];
  industry_context: string;
  news_signals: string[];
  signals: { severity: 'HIGH' | 'MEDIUM'; label: string; evidence: string }[];
  tc_opportunity_score: number;
}

/**
 * Fetch Google search results for a query.
 * Returns titles, snippets, and URLs from the search results page.
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

    // Extract URLs and snippets from Google results
    const urlMatches = html.match(/href="\/url\?q=([^&"]+)/g) || [];
    const urls = urlMatches.map(m => decodeURIComponent(m.replace('href="/url?q=', ''))).filter(u => u.startsWith('http') && !u.includes('google.com'));
    if (urls.length > 0) {
      snippets.push(`URLS FOUND: ${urls.slice(0, 5).join(' | ')}`);
    }

    // Extract text content from result snippets
    const matches = html.match(/<div[^>]*class="[^"]*"[^>]*>([^<]{40,300})<\/div>/g) || [];
    for (const match of matches.slice(0, 10)) {
      const text = match.replace(/<[^>]+>/g, '').trim();
      if (text.length > 40 && !text.includes('Google') && !text.includes('Sign in') && !text.includes('cookie')) {
        snippets.push(text);
      }
    }

    // Also extract from BNeawe patterns
    const textMatches = html.match(/class="BNeawe[^"]*"[^>]*>([^<]{20,500})/g) || [];
    for (const match of textMatches.slice(0, 8)) {
      const text = match.replace(/class="BNeawe[^"]*"[^>]*>/, '').trim();
      if (text.length > 20) {
        snippets.push(text);
      }
    }

    return snippets.slice(0, 10).join('\n');
  } catch (e) {
    console.warn('Google search failed for:', query, e);
    return '';
  }
}

const SYSTEM_PROMPT = `You are an intelligence analyst. You will receive REAL Google search results about a company. Extract and structure the factual information into JSON. For executive_social, extract REAL executive names and titles from the LinkedIn results — include what they posted about and include the LinkedIn URL if visible in the search results. Only include information supported by the search results. Return ONLY valid JSON, no markdown.

JSON structure:
{"earnings_call_signals":["quote1","quote2"],"linkedin_job_postings":{"cloud_ai_roles":number,"yoy_change":"+X%"},"executive_social":[{"name":"Real Name","title":"Real Title","post_theme":"What they posted about","url":"https://linkedin.com/in/... or https://linkedin.com/posts/..."}],"glassdoor_signals":["real review excerpt"],"industry_context":"context from news","news_signals":["real news"],"signals":[{"severity":"HIGH","label":"label","evidence":"evidence from search"}],"tc_opportunity_score":number}`;

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

    // Fetch REAL data from Google search (parallel requests)
    const [linkedinResults, glassdoorResults, newsResults, dataBookResults, executivePostsResults] = await Promise.all([
      googleSearch(`${companyName} site:linkedin.com/jobs cloud AI engineer`),
      googleSearch(`${companyName} site:glassdoor.com reviews culture training`),
      googleSearch(`${companyName} cloud AI digital transformation 2025 2026 news`),
      googleSearch(`${companyName} AWS cloud spend revenue technology investment`),
      googleSearch(`"${companyName}" CEO OR CTO OR CFO OR CHRO site:linkedin.com`),
    ]);

    // Build context from real search results
    const searchContext = [
      linkedinResults ? `LINKEDIN JOB POSTINGS:\n${linkedinResults}` : '',
      executivePostsResults ? `EXECUTIVE LINKEDIN PROFILES & POSTS:\n${executivePostsResults}` : '',
      glassdoorResults ? `GLASSDOOR EMPLOYEE REVIEWS:\n${glassdoorResults}` : '',
      newsResults ? `COMPANY NEWS & TRANSFORMATION:\n${newsResults}` : '',
      dataBookResults ? `COMPANY DATA, REVENUE & INVESTMENT:\n${dataBookResults}` : '',
    ].filter(Boolean).join('\n\n');

    const userMessage = searchContext
      ? `Based on these REAL Google search results about ${companyName} (${industry}), extract and structure the intelligence into JSON. Only use facts from the search results:\n\n${searchContext}`
      : `Generate workforce intelligence JSON for: ${companyName} (${industry}). Note: no search results available — use your training knowledge but mark estimates clearly.`;

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
