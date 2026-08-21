import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { invokeClaudeJSON } from '../shared/bedrock';
import { success, error } from '../shared/response';
import { tavilySearch, tavilyLinkedInSearch } from '../shared/tavily';
import { ANTI_FABRICATION_POLICY } from '../shared/guardrails';

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
  communication_style: {
    disc_type: string;
    disc_label: string;
    confidence: number;
    confidence_level: 'High' | 'Medium' | 'Low';
    data_sources: string[];
    do_list: string[];
    avoid_list: string[];
    suggested_opening: string;
  };
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
    const { personaName, personaTitle, company, industry, linkedinUrl } = body;

    if (!personaName || !company) {
      return error(400, 'personaName and company are required');
    }

    // Cache key includes LinkedIn URL so changing it busts cache
    const urlHash = linkedinUrl ? linkedinUrl.replace(/[^a-z0-9]/gi, '').slice(-20) : 'no-url';
    const cacheKey = `persona-intel:${personaName.toLowerCase().replace(/\s+/g, '-')}:${company.toLowerCase().replace(/\s+/g, '-')}:${urlHash}`;
    try {
      const cached = await ddb.send(new GetCommand({
        TableName: process.env.INTELLIGENCE_CACHE_TABLE!,
        Key: { cacheKey },
      }));
      if (cached.Item && cached.Item.ttl > Math.floor(Date.now() / 1000)) {
        return success(cached.Item.data);
      }
    } catch { /* cache miss */ }

    // Run multiple Tavily searches in parallel — use LinkedIn URL if provided
    const searches = [
      linkedinUrl
        ? tavilyLinkedInSearch(`"${personaName}" ${linkedinUrl.split('/in/')[1]?.replace('/', '') || ''}`)
        : tavilyLinkedInSearch(`"${personaName}" "${company}"`),
      tavilySearch(`"${personaName}" "${company}" cloud OR AI OR training OR transformation`),
      tavilySearch(`"${personaName}" "${company}" ${industry}`),
    ];
    // If LinkedIn URL provided, also search for their posts specifically
    if (linkedinUrl) {
      searches.push(tavilyLinkedInSearch(`"${personaName}" posts articles`));
    }
    const [linkedinResults, cloudAIResults, companyResults, postsResults] = await Promise.all(searches);

    const searchContext = [
      linkedinResults ? `LINKEDIN SEARCH:\n${linkedinResults}` : '',
      cloudAIResults ? `CLOUD/AI ACTIVITY SEARCH:\n${cloudAIResults}` : '',
      companyResults ? `COMPANY/INDUSTRY SEARCH:\n${companyResults}` : '',
      postsResults ? `LINKEDIN POSTS & ARTICLES:\n${postsResults}` : '',
    ].filter(Boolean).join('\n\n');

    const userMessage = `Build a persona intelligence profile for this executive, including a DISC communication style assessment:

NAME: ${personaName}
TITLE: ${personaTitle || 'Unknown'}
COMPANY: ${company}
INDUSTRY: ${industry || 'Technology'}
${linkedinUrl ? `LINKEDIN URL: ${linkedinUrl}` : ''}
${body.buzzContext ? `\nACCOUNT INTELLIGENCE (from Buzz/Now analysis):\n${body.buzzContext}` : ''}

SEARCH RESULTS:
${searchContext || 'No search results found for this person.'}

DISC CLASSIFICATION RULES:
Analyze the search results for communication signals and classify into one of these types (or blends):
- D (Dominance) — Direct & Results-Oriented: Short posts, decisive language, focus on outcomes, competitive tone
- I (Influence) — Energetic & People-Oriented: Frequent posting, storytelling, enthusiasm, large networks, collaborative language
- S (Steadiness) — Calm & Relationship-Oriented: Consistent but infrequent posting, team-focused language, long tenure, supportive tone
- C (Conscientiousness) — Analytical & Detail-Oriented: Technical content, data-heavy posts, methodical career, precision language, risk-aware tone

Confidence scoring:
- High (70%+): Rich LinkedIn profile + writing samples + social activity found
- Medium (40-70%): LinkedIn profile with job history but limited content found
- Low (<40%): Sparse profile, minimal public footprint found

T&C TAILORING for DO/AVOID/OPENING:
- D-type: Lead with ROI metrics, certification velocity, workforce readiness KPIs
- I-type: Lead with success stories, peer company examples, the vision of a transformed workforce
- S-type: Lead with the support structure, phased rollout plan, low disruption to current teams
- C-type: Lead with the methodology, assessment framework, data on skill gap measurement

Return JSON:
{
  "name": "${personaName}",
  "title": "${personaTitle || 'Unknown'}",
  "company": "${company}",
  "linkedin_summary": "What we found about them on LinkedIn (or 'No LinkedIn data found' if nothing)",
  "recent_activity": ["Recent posts, talks, or activity found — empty array if none found"],
  "interests": ["Topics they care about based on search results and their role"],
  "engagement_angle": "How to approach this person for a T&C/skills transformation conversation — be specific and actionable",
  "is_aws_champion": false,
  "communication_style": {
    "disc_type": "D or I or S or C or blend like DC",
    "disc_label": "Direct & Results-Oriented",
    "confidence": 65,
    "confidence_level": "Medium",
    "data_sources": ["LinkedIn profile", "2 articles", "1 conference talk"],
    "do_list": ["4 specific DO recommendations tailored to T&C conversation with this DISC type"],
    "avoid_list": ["3 specific AVOID recommendations tailored to this DISC type"],
    "suggested_opening": "A specific opening statement for a T&C skills transformation conversation with this person, referencing their company's actual situation"
  }
}

IMPORTANT: Only include information that was ACTUALLY found in the search results. Do not fabricate LinkedIn profiles or activity. If no data was found, say so honestly, set confidence to Low, base DISC on their role/title/industry patterns, and add disclaimer.`;

    const result = await invokeClaudeJSON<PersonaIntelResponse>(
      ANTI_FABRICATION_POLICY + '\n\n' + SYSTEM_PROMPT,
      [{ role: 'user', content: userMessage }],
      { maxTokens: 2048, temperature: 0.5 }
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
