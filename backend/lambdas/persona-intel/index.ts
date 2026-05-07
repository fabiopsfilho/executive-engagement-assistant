import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { invokeClaudeJSON } from '../shared/bedrock';
import { success, error } from '../shared/response';

const ddbClient = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(ddbClient);

export interface PersonaIntelResponse {
  name: string;
  title: string;
  company: string;
  linkedin_summary: string;
  recent_activity: string[];
  interests: string[];
  engagement_angle: string;
  is_aws_champion: boolean;
}

/**
 * Google search for real-time intelligence about a person
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

const SYSTEM_PROMPT = `You are a globally renowned expert in skills transformation for the age of Generative AI. You work for AWS Training & Certification and have deep expertise in:

EXPERTISE:
- Skills transformation strategy in the GenAI era
- Workforce upskilling and reskilling at enterprise scale
- AWS Training & Certification offerings: AWS Skill Builder, Classroom Training, AWS Certification programs, AWS Skills Guild, AWS Cloud Institute
- Executive engagement and relationship building
- Understanding executive motivations and communication styles

YOUR ROLE: Build a persona intelligence profile for a specific executive to help the AWS T&C Skills Enablement team prepare for an engagement conversation.

GUARDRAILS:
1. NEVER INFER about people or data you don't have. Only reference confirmed data from search results.
2. If search results found real data about this person, reference it. If not, focus on what their role/title typically cares about.
3. CHAMPION DESIGNATION: Only set is_aws_champion to true if search results EXPLICITLY show AWS-related activity (posts about AWS, AWS certifications, AWS events attendance).
4. Be honest about what you know vs. don't know.
5. Frame the engagement angle through skills transformation: how can T&C help this person achieve their goals?`;

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const body = JSON.parse(event.body || '{}');
    const { personaName, personaTitle, company, industry } = body;

    if (!personaName || !company) {
      return error(400, 'personaName and company are required');
    }

    // Check cache (24-hour TTL for persona intel)
    const cacheKey = `persona-intel:${personaName.toLowerCase().replace(/\s+/g, '-')}:${company.toLowerCase().replace(/\s+/g, '-')}`;
    try {
      const cached = await ddb.send(new GetCommand({
        TableName: process.env.INTELLIGENCE_CACHE_TABLE!,
        Key: { cacheKey },
      }));
      if (cached.Item && cached.Item.ttl > Math.floor(Date.now() / 1000)) {
        return success(cached.Item.data);
      }
    } catch { /* cache miss */ }

    // Run multiple Google searches in parallel
    const [linkedinResults, cloudAIResults, companyResults] = await Promise.all([
      googleSearch(`"${personaName}" "${company}" site:linkedin.com`).catch(() => ''),
      googleSearch(`"${personaName}" "${company}" cloud OR AI OR training OR transformation`).catch(() => ''),
      googleSearch(`"${personaName}" "${company}" ${industry}`).catch(() => ''),
    ]);

    const searchContext = [
      linkedinResults ? `LINKEDIN SEARCH:\n${linkedinResults}` : '',
      cloudAIResults ? `CLOUD/AI ACTIVITY SEARCH:\n${cloudAIResults}` : '',
      companyResults ? `COMPANY/INDUSTRY SEARCH:\n${companyResults}` : '',
    ].filter(Boolean).join('\n\n');

    const userMessage = `Build a persona intelligence profile for this executive:

NAME: ${personaName}
TITLE: ${personaTitle || 'Unknown'}
COMPANY: ${company}
INDUSTRY: ${industry || 'Technology'}

SEARCH RESULTS:
${searchContext || 'No search results found for this person.'}

Return JSON:
{
  "name": "${personaName}",
  "title": "${personaTitle || 'Unknown'}",
  "company": "${company}",
  "linkedin_summary": "What we found about them on LinkedIn (or 'No LinkedIn data found' if nothing)",
  "recent_activity": ["Recent posts, talks, or activity found — empty array if none found"],
  "interests": ["Topics they care about based on search results and their role"],
  "engagement_angle": "How to approach this person for a T&C/skills transformation conversation — be specific and actionable",
  "is_aws_champion": false
}

IMPORTANT: Only include information that was ACTUALLY found in the search results. Do not fabricate LinkedIn profiles or activity. If no data was found, say so honestly and base recommendations on their role/title.`;

    const result = await invokeClaudeJSON<PersonaIntelResponse>(
      SYSTEM_PROMPT,
      [{ role: 'user', content: userMessage }],
      { maxTokens: 1024, temperature: 0.5 }
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
    } catch { /* continue */ }

    return success(result);
  } catch (err) {
    console.error('Error generating persona intelligence:', err);
    return error(500, 'Failed to generate persona intelligence');
  }
}
