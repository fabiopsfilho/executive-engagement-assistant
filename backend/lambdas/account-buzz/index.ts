import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { invokeClaudeJSON } from '../shared/bedrock';
import { success, error } from '../shared/response';
import { getTCProductKnowledge } from '../shared/mcp';
import { getTCStrategyContext } from '../shared/knowledge-base';
import { tavilySearch, tavilyLinkedInSearch, tavilyGlassdoorSearch } from '../shared/tavily';

const ddbClient = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(ddbClient);

export interface BuzzNowResponse {
  buzz_summary: string;
  buzz_executive_insights: string[];
  buzz_hiring_analysis: {
    roles: { title: string; url: string }[];
    why_this_matters: string;
  };
  buzz_sentiment_analysis: {
    signals: string[];
    why_this_matters: string;
  };
  buzz_tc_opportunity: string;
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
    const { accountData, tcData, existingInsights } = body;
    if (!accountData) return error(400, 'accountData is required');



    // Fetch real-time intelligence from Tavily + AWS docs + Knowledge Base in parallel
    const industry = accountData.industry || 'Technology';
    const companyName = accountData.customer_name || 'Unknown';
    const [mcpDocs, kbDocs, linkedinResults, glassdoorResults, newsResults, executiveResults, chroSkillsResults] = await Promise.all([
      getTCProductKnowledge(industry, ['workforce transformation', 'talent development']).catch(() => ''),
      getTCStrategyContext(industry, 'CTO', accountData.ebc_data?.themes || []).catch(() => ''),
      tavilyLinkedInSearch(`${companyName} jobs cloud AI engineer hiring`),
      tavilyGlassdoorSearch(`${companyName} reviews culture training development`),
      tavilySearch(`${companyName} cloud AI digital transformation 2025 2026 news`),
      tavilyLinkedInSearch(`${companyName} CEO CTO CFO CHRO executives`),
      tavilySearch(`${companyName} CHRO HR skills transformation workforce development talent strategy`),
    ]);
    const awsContext = [mcpDocs, kbDocs].filter(Boolean).join('\n\n');
    const onlineSearch = [
      linkedinResults ? `LINKEDIN SEARCH RESULTS:\n${linkedinResults}` : '',
      glassdoorResults ? `GLASSDOOR SEARCH RESULTS:\n${glassdoorResults}` : '',
      newsResults ? `NEWS & TRANSFORMATION SEARCH:\n${newsResults}` : '',
      executiveResults ? `EXECUTIVE LINKEDIN PROFILES:\n${executiveResults}` : '',
      chroSkillsResults ? `CHRO / HR / SKILLS TRANSFORMATION PRACTICES:\n${chroSkillsResults}` : '',
    ].filter(Boolean).join('\n\n');

    // Build the context
    const pi = accountData.public_intelligence || {};
    const context = `
COMPANY: ${accountData.customer_name} (${industry}, ${accountData.segment}, ${accountData.geo})
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
Attendees: ${(accountData.ebc_data?.attendees || []).length > 0 ? accountData.ebc_data.attendees.map((a: any) => `${a.name} (${a.persona})`).join(', ') : 'NONE PROVIDED — do NOT invent attendee names; refer to executive roles generically'}

${accountData.accountPlanText ? `CAPTURED ACCOUNT DATA (from Salesforce or uploaded document — analyze for training status, Polaris level, T&C engagement history, opportunity pipeline, skills/workforce development info. Use this to inform ALL recommendations):\n${accountData.accountPlanText.slice(0, 6000)}` : ''}
${existingInsights ? `EXISTING APPROACH & STRATEGY (already generated — use this as foundation for NOW recommendations):
Who to focus on: ${existingInsights.approach?.who_to_focus || 'Not yet determined'}
What conversations to drive: ${existingInsights.approach?.what_conversations || 'Not yet determined'}
Where to start: ${existingInsights.approach?.where_to_start || 'Not yet determined'}
What's happening in their world: ${existingInsights.approach?.whats_happening || 'Not yet determined'}
Next Steps: ${(existingInsights.next_steps || []).join(' | ') || 'None generated'}
Key Asks: ${(existingInsights.key_asks || []).join(' | ') || 'None generated'}` : ''}
${awsContext ? `AWS T&C KNOWLEDGE BASE & DOCUMENTATION:\n${awsContext.slice(0, 3000)}` : ''}
${onlineSearch ? `\nREAL-TIME ONLINE SEARCH RESULTS:\n${onlineSearch.slice(0, 3000)}` : ''}`;

    const userMessage = `Analyze this account's intelligence and generate both BUZZ and NOW insights. Be highly specific — reference actual names, numbers, and quotes from the data.

ATTENDEE ACCURACY (ZERO TOLERANCE): Never state or imply that any specific person will attend the EBC unless their name is in the Attendees list above. If Attendees is "NONE PROVIDED", do not name attendees — you may reference real executives from the Executive Social data as "worth knowing about" but never as confirmed attendees. Never invent names or biographical details.

Use the T&C Knowledge Base content as your primary reference for recommendations. The online search results supplement this with real-time data about the specific company.

${context}

Return JSON with these STRICT formatting rules:

1. buzz_hiring_analysis: Return as a structured object:
   - "roles": An array of objects, each with "title" (the job title found) and "url" (the LinkedIn or job posting URL if found, empty string if not). Only include roles actually found in search results.
   - "why_this_matters": A single concise paragraph (2-3 sentences max) written in Amazon's writing style — data-driven, specific, no filler words. Explain what these hiring patterns signal about the company's workforce capability gaps. Do NOT mention any T&C products or offerings here. Focus on the business implication.

2. buzz_sentiment_analysis: Return as a structured object:
   - "signals": An array of strings — each is a direct quote or paraphrased insight from Glassdoor/employee reviews. Keep each signal to 1 sentence max.
   - "why_this_matters": A single concise paragraph (2-3 sentences max) written in Amazon's writing style. Explain what this sentiment reveals about the company's learning culture and readiness for change. Do NOT mention T&C products. Focus on the organizational implication.

3. buzz_tc_opportunity: A single paragraph explaining the workforce development APPROACH that would address the gaps. Think methodology — how should this company develop people differently? Not about specific products or tools.

4. NOW SECTION — CRITICAL: The NOW section must be DIRECTLY GROUNDED in the Buzz findings. Specifically:
   - "now_focus": Must reference the specific skills gap revealed by the hiring data AND the employee sentiment. What is the ONE thing that connects the roles they can't fill with what employees are saying? That intersection is the focus.
   - "now_initiatives": Each initiative must trace back to a concrete signal — a specific open role, a specific Glassdoor quote, a specific executive post, or a specific news signal. No generic recommendations.
   - "now_key_asks": These are consultative discovery questions that demonstrate you already know their situation. Reference their specific hiring patterns, employee feedback, or industry pressures. These questions should make the executive think "this person has done their homework."
   - "now_opening_move": Must name a specific person (from attendees or executives found), reference a specific signal (role they're hiring for, something an employee said, or something the executive posted), and explain exactly why leading with this angle works for THIS company.

WRITING STYLE: Write like an Amazon 6-pager — concise, data-backed, no weasel words, no filler. Every sentence should carry information. Be consultative and proactive — show you understand their workforce challenge before they explain it.

{
  "buzz_summary": "2-3 sentence synthesis of what's happening at this company",
  "buzz_executive_insights": ["One insight per confirmed executive — what they care about and how to approach them"],
  "buzz_hiring_analysis": {
    "roles": [{"title": "Cloud Solutions Architect", "url": "https://linkedin.com/jobs/..."}, {"title": "ML Engineer", "url": ""}],
    "why_this_matters": "Concise paragraph on what the hiring pattern signals about capability gaps."
  },
  "buzz_sentiment_analysis": {
    "signals": ["Direct quote or paraphrased signal from employees", "Another signal"],
    "why_this_matters": "Concise paragraph on what sentiment reveals about learning culture."
  },
  "buzz_tc_opportunity": "The workforce development approach that addresses these gaps.",
  "now_focus": "Ground this in the hiring gaps + sentiment. What is the critical workforce capability issue right now?",
  "now_initiatives": ["Each traces to a specific signal from the Buzz analysis"],
  "now_key_asks": ["Consultative questions that prove you've done your homework on their skills situation"],
  "now_opening_move": "Name the person, reference the specific signal, explain the angle"
}`;

    const result = await invokeClaudeJSON<BuzzNowResponse>(
      SYSTEM_PROMPT,
      [{ role: 'user', content: userMessage }],
      { maxTokens: 2048, temperature: 0.7 }
    );

    return success(result);
  } catch (err) {
    console.error('Error generating buzz/now insights:', err);
    return error(500, 'Failed to generate buzz/now insights');
  }
}
