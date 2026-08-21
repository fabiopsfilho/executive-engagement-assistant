import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { invokeClaudeJSON } from '../shared/bedrock';
import { success, error } from '../shared/response';
import { getTCProductKnowledge } from '../shared/mcp';
import { getTCStrategyContext } from '../shared/knowledge-base';
import { tavilySearch, tavilyLinkedInSearch, tavilyGlassdoorSearch } from '../shared/tavily';

/**
 * UNIFIED ACCOUNT ANALYSIS
 *
 * Single Bedrock call that produces every insight the UI needs — Approach,
 * Buzz, Now, Next Steps, and Key Asks — from ONE shared body of gathered
 * intelligence. This guarantees all sections are consistent and reference the
 * same conclusions (Buzz findings inform the Approach, and both inform the
 * Now / Next Steps / Key Asks).
 */

export interface UnifiedAnalysisResponse {
  // Approach (concise executive summaries)
  who_to_focus: string;
  what_conversations: string;
  where_to_start: string;
  whats_happening: string;
  // Buzz
  buzz_summary: string;
  buzz_executive_insights: string[];
  buzz_hiring_analysis: { roles: { title: string; url: string }[]; why_this_matters: string };
  buzz_sentiment_analysis: { signals: string[]; why_this_matters: string };
  buzz_tc_opportunity: string;
  // Now
  now_focus: string;
  now_initiatives: string[];
  now_key_asks: string[];
  now_opening_move: string;
  // Next Steps & Key Asks
  next_steps: string[];
  key_asks: string[];
}

const SYSTEM_PROMPT = `You are supporting the AWS Training & Certification team preparing for an Executive Briefing Center (EBC) session. You produce ONE unified, internally-consistent analysis of a customer account.

EVERYTHING you produce must tell ONE connected story: the Buzz findings (hiring gaps, employee sentiment) inform the Approach; the Approach, Buzz and Now all reinforce each other; the Next Steps and Key Asks follow directly from that same analysis. No section may contradict another.

EXECUTIVE TONE — THIS IS AN EBC (business, not technical). Speak the language of the boardroom: business outcomes, competitive position, workforce strategy, talent, ROI. Do NOT go into technical services, architectures, or product mechanics. No jargon.

ATTENDEE RULE:
- The ONLY confirmed EBC attendees are those in the "Confirmed Attendees" list.
- If that list has names: "who_to_focus" centers on them.
- If it is empty: "who_to_focus" centers on the REAL executives found online (name them, e.g. the CEO from LinkedIn) as the key people to engage and research. Do NOT call them attendees, do NOT claim they will attend, and do NOT add any disclaimer about a missing/unimported list — just give the recommendation naturally.
- Never invent a person, tenure, or biography.

FORMAT (BE CONCISE — this keeps the response fast and complete):
- Each Approach field: 2 tight executive sentences max.
- next_steps and key_asks: exactly 4 each, one concise sentence per item.
- now_initiatives: exactly 4, one sentence each. buzz why_this_matters: 2 sentences max.
- buzz_hiring_analysis.roles: only real roles found in search (title + url).
- Empty arrays are fine when no real data exists — never fill with speculation.

Return ONLY valid JSON.`;

const withTimeout = <T,>(p: Promise<T>, ms: number, fallback: T): Promise<T> =>
  Promise.race([p, new Promise<T>(resolve => setTimeout(() => resolve(fallback), ms))]);

// Condensed persona + guardrails for this high-volume unified call, to keep the
// prompt small enough that generation completes within API Gateway's 29s limit.
const CONDENSED_SYSTEM = `You are an AI Skills Transformation expert advising the AWS T&C team for an EBC (executive, business-focused — no technical jargon). Core lens: AI transformation is 70% people/process/org change (BCG 10-20-70); leaders win on TALENT not technology; workflow redesign over tool training; manager activation is critical; measure the chain (capability -> adoption -> workflow -> business outcome). Bridge to AWS T&C only as the execution partner, never a product pitch.

DATA INTEGRITY (zero tolerance): Ground everything in the real data provided. NEVER invent people, quotes, numbers, initiatives, or approaches. Confirmed attendees come ONLY from the "Confirmed Attendees" list — never claim anyone attends unless listed. You MAY name real executives found in the data (e.g. the CEO on LinkedIn) as key people to engage, but never as attendees, and never add a disclaimer about a missing list. If data is thin, give a smaller honest recommendation.`;

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const accountId = event.pathParameters?.accountId;
    if (!accountId) return error(400, 'accountId is required');

    const body = JSON.parse(event.body || '{}');
    const { accountData, tcData } = body;
    if (!accountData) return error(400, 'accountData is required');

    const industry = accountData.industry || 'Technology';
    const companyName = accountData.customer_name || 'Unknown';
    const existingPi = accountData.public_intelligence || {};
    // The intelligence Lambda usually already populated executive_social / hiring / glassdoor
    // on the account. If so, we SKIP re-searching (saves ~6s and keeps us under 29s) and only
    // do a light CHRO/skills search. If the account has no intelligence yet, we search fully.
    const hasIntel = (existingPi.executive_social?.length > 0) ||
      (existingPi.linkedin_job_postings?.cloud_ai_roles > 0) ||
      (existingPi.glassdoor_signals?.length > 0);

    const [mcpDocs, kbDocs, linkedinResults, glassdoorResults, newsResults, executiveResults, chroSkillsResults] = await Promise.all([
      withTimeout(getTCProductKnowledge(industry, ['workforce transformation', 'talent development']).catch(() => ''), 3000, ''),
      withTimeout(getTCStrategyContext(industry, 'CTO', accountData.ebc_data?.themes || []).catch(() => ''), 3000, ''),
      hasIntel ? Promise.resolve('') : withTimeout(tavilyLinkedInSearch(`${companyName} jobs cloud AI engineer hiring`), 6000, ''),
      hasIntel ? Promise.resolve('') : withTimeout(tavilyGlassdoorSearch(`${companyName} reviews culture training development`), 6000, ''),
      hasIntel ? Promise.resolve('') : withTimeout(tavilySearch(`${companyName} cloud AI digital transformation 2025 2026 news`), 6000, ''),
      hasIntel ? Promise.resolve('') : withTimeout(tavilyLinkedInSearch(`${companyName} CEO CTO CFO CHRO executives`), 6000, ''),
      withTimeout(tavilySearch(`${companyName} CHRO HR skills transformation workforce development talent strategy`), 6000, ''),
    ]);

    const awsContext = [mcpDocs, kbDocs].filter(Boolean).join('\n\n');
    const onlineSearch = [
      linkedinResults ? `LINKEDIN JOB POSTINGS:\n${linkedinResults}` : '',
      executiveResults ? `EXECUTIVE LINKEDIN PROFILES & POSTS:\n${executiveResults}` : '',
      chroSkillsResults ? `CHRO / HR / SKILLS TRANSFORMATION PRACTICES:\n${chroSkillsResults}` : '',
      glassdoorResults ? `GLASSDOOR EMPLOYEE REVIEWS:\n${glassdoorResults}` : '',
      newsResults ? `COMPANY NEWS & TRANSFORMATION:\n${newsResults}` : '',
    ].filter(Boolean).join('\n\n');

    const pi = accountData.public_intelligence || {};
    const attendees = accountData.ebc_data?.attendees || [];
    const context = `
COMPANY: ${companyName} (${industry}, ${accountData.segment}, ${accountData.geo})
STRATEGIC PRIORITY: ${accountData.sfdc_data?.account_plan_priority || 'Unknown'}
SMGS PHASE: ${accountData.sfdc_data?.smgs_phase || 'Unknown'}
T2K: ${accountData.sfdc_data?.t2k ? 'Yes' : 'No'}

T&C STATE:
${accountData.tc_current_state?.skill_builder ? `Skill Builder: ${accountData.tc_current_state.skill_builder_seats} seats, ${accountData.tc_current_state.activation_rate}% activation` : 'No Skill Builder (Greenfield)'}
Certifications: ${accountData.tc_current_state?.certifications || 0}
Prior Engagement: ${accountData.tc_current_state?.prior_engagement || 'None'}

${tcData ? `T&C PIPELINE DATA:
Pipeline: $${(tcData.totalPipeline || 0).toLocaleString()}
Open Opportunities: ${tcData.openOpportunities || 0}
Products: ${(tcData.products || []).join(', ')}
Students: ${tcData.totalStudents || 0}` : ''}

SIGNALS:
${(accountData.signals || []).map((s: any) => `[${s.severity}] ${s.label}: ${s.evidence}`).join('\n') || 'None'}

EXECUTIVE SOCIAL ACTIVITY (real executives found online — name them freely as key people to engage, but NOT as confirmed attendees):
${(pi.executive_social || []).map((e: any) => `${e.name} (${e.title}): "${e.post_theme}"${e.url ? ` [${e.url}]` : ''}`).join('\n') || 'None detected'}

LINKEDIN HIRING:
${pi.linkedin_job_postings ? `${pi.linkedin_job_postings.cloud_ai_roles} cloud/AI roles (${pi.linkedin_job_postings.yoy_change} YoY)` : 'No data'}

GLASSDOOR EMPLOYEE SENTIMENT:
${(pi.glassdoor_signals || []).map((s: string) => `"${s}"`).join('\n') || 'No data'}

INDUSTRY CONTEXT:
${pi.industry_context || 'No data'}

NEWS SIGNALS:
${(pi.news_signals || []).join('\n') || 'No data'}

EBC DATA:
Date: ${accountData.ebc_data?.meeting_dates?.[0] || 'TBD'}
Location: ${accountData.ebc_data?.location || 'TBD'}
Themes: ${(accountData.ebc_data?.themes || []).join(', ')}
Confirmed Attendees: ${attendees.length > 0 ? attendees.map((a: any) => `${a.name} (${a.title}, ${a.persona})`).join('; ') : 'none provided — use real executives found online as key people to engage; do NOT mention that a list is missing'}

${accountData.accountPlanText ? `CAPTURED ACCOUNT / SALESFORCE / BRIEF DATA (analyze for training status, engagement history, pipeline, workforce info — use to inform ALL sections):\n${accountData.accountPlanText.slice(0, 6000)}` : ''}
${awsContext ? `\nAWS T&C KNOWLEDGE BASE:\n${awsContext.slice(0, 2500)}` : ''}
${onlineSearch ? `\nREAL-TIME ONLINE SEARCH RESULTS:\n${onlineSearch.slice(0, 3000)}` : ''}`;

    const userMessage = `Produce ONE unified, internally-consistent account analysis. Ground everything in the real data below. Reference real executives (e.g. the CEO found online) by name where relevant. Never fabricate people or claim anyone is a confirmed attendee unless they are in the Confirmed Attendees list.

${context}

Return JSON with exactly these fields (4 items each for next_steps/key_asks/now_initiatives):
{
  "who_to_focus": "2 tight sentences: who to focus on (real executives by name, or confirmed attendees if provided) and why.",
  "what_conversations": "2 tight sentences: the strategic conversation angle to drive, grounded in real signals.",
  "where_to_start": "2 tight sentences: the recommended strategic approach (methodology, not products).",
  "whats_happening": "2 tight sentences: what's happening in their world creating urgency now.",
  "buzz_summary": "2-3 sentence synthesis of what's happening at this company.",
  "buzz_executive_insights": ["One insight per REAL executive found — empty array if none. Never invent."],
  "buzz_hiring_analysis": { "roles": [{"title": "Role", "url": "https://..."}], "why_this_matters": "Concise paragraph on the capability gap the hiring signals." },
  "buzz_sentiment_analysis": { "signals": ["real employee signal"], "why_this_matters": "Concise paragraph on learning culture." },
  "buzz_tc_opportunity": "The workforce development APPROACH (methodology, not products) that addresses the gaps.",
  "now_focus": "The single most important workforce capability issue right now, grounded in hiring + sentiment.",
  "now_initiatives": ["4 initiatives, each tracing to a concrete signal."],
  "now_key_asks": ["4 consultative discovery questions grounded in the data."],
  "now_opening_move": "How to open — reference a specific signal; may name a real executive; never claim attendance.",
  "next_steps": ["4 concise consultative next steps grounded in the data."],
  "key_asks": ["4 concise discovery-oriented questions/commitments."]
}`;

    const result = await invokeClaudeJSON<UnifiedAnalysisResponse>(
      CONDENSED_SYSTEM + '\n\n' + SYSTEM_PROMPT,
      [{ role: 'user', content: userMessage }],
      { maxTokens: 3000, temperature: 0.5 }
    );

    return success(result);
  } catch (err) {
    console.error('Error generating unified account analysis:', err);
    return error(500, 'Failed to generate account analysis');
  }
}
