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

const SYSTEM_PROMPT = `You are an intelligence analyst. Given a company name and industry, return a JSON object with workforce transformation signals. Be specific — use real executive names where possible. Return ONLY valid JSON, no markdown.

JSON structure:
{"earnings_call_signals":["quote1","quote2"],"linkedin_job_postings":{"cloud_ai_roles":number,"yoy_change":"+X%"},"executive_social":[{"name":"Name","title":"Title","post_theme":"theme"}],"glassdoor_signals":["signal1","signal2"],"industry_context":"context","news_signals":["news1"],"signals":[{"severity":"HIGH","label":"label","evidence":"evidence"}],"tc_opportunity_score":number}`;

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

    // Note: Web search and T&C data integration disabled for speed
    // These will be handled by separate endpoints

    // Generate intelligence via Bedrock
    const userMessage = `Generate workforce intelligence JSON for: ${companyName} (${industry}). Include real executive names, LinkedIn hiring estimates, Glassdoor sentiment, and industry context.`;

    const result = await invokeClaudeJSON<IntelligenceResponse>(
      SYSTEM_PROMPT,
      [{ role: 'user', content: userMessage }],
      { maxTokens: 2048, temperature: 0.6 }
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
