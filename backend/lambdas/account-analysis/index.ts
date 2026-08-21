import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { invokeClaudeJSON } from '../shared/bedrock';
import { success, error } from '../shared/response';
import { getTCProductKnowledge } from '../shared/mcp';
import { getTCStrategyContext } from '../shared/knowledge-base';
import { ANTI_FABRICATION_POLICY } from '../shared/guardrails';
import { EXPERT_PERSONA } from '../shared/persona';
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
  // Approach
  who_to_focus: string;
  who_to_focus_detail: string;
  what_conversations: string;
  what_conversations_detail: string;
  where_to_start: string;
  where_to_start_detail: string;
  whats_happening: string;
  whats_happening_detail: string;
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

FORMAT:
- Each Approach field is a SHORT executive summary (1-2 sentences, plain prose, no asterisks/markdown). The matching "_detail" field holds 2-4 sentences of expanded reasoning.
- next_steps and key_asks: exactly 4 each, one concise executive sentence per item.
- buzz_hiring_analysis.roles: only real roles found in search (title + url).
- Empty arrays are fine when no real data exists — never fill with speculation.

Return ONLY valid JSON.`;

const withTimeout = <T,>(p: Promise<T>, ms: number, fallback: T): Promise<T> =>
  Promise.race([p, new Promise<T>(resolve => setTimeout(() => resolve(fallback), ms))]);

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const accountId = event.pathParameters?.accountId;
    if (!accountId) return error(400, 'accountId is required');

    const body = JSON.parse(event.body || '{}');
    const { accountData, tcData } = body;
    if (!accountData) return error(400, 'accountData is required');

    const industry = accountData.industry || 'Technology';
    const companyName = accountData.customer_name || 'Unknown';

    // Gather all intelligence ONCE (parallel, each capped so nothing hangs).
    const [mcpDocs, kbDocs, linkedinResults, glassdoorResults, newsResults, executiveResults, chroSkillsResults] = await Promise.all([
      withTimeout(getTCProductKnowledge(industry, ['workforce transformation', 'talent development']).catch(() => ''), 4000, ''),
      withTimeout(getTCStrategyContext(industry, 'CTO', accountData.ebc_data?.themes || []).catch(() => ''), 4000, ''),
      tavilyLinkedInSearch(`${companyName} jobs cloud AI engineer hiring`),
      tavilyGlassdoorSearch(`${companyName} reviews culture training development`),
      tavilySearch(`${companyName} cloud AI digital transformation 2025 2026 news`),
      tavilyLinkedInSearch(`${companyName} CEO CTO CFO CHRO executives`),
      tavilySearch(`${companyName} CHRO HR skills transformation workforce development talent strategy`),
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

Return JSON with exactly these fields (summaries brief, details expanded, 4 items each for next_steps/key_asks/now_initiatives):
{
  "who_to_focus": "1-2 sentence exec summary of who to focus on (real executives by name, or confirmed attendees if provided).",
  "who_to_focus_detail": "2-4 sentences on each key person's role, public activity, and how to approach them.",
  "what_conversations": "1-2 sentence summary of the strategic conversation angle to drive.",
  "what_conversations_detail": "2-4 sentences expanding it, referencing named executives' activity and real challenges.",
  "where_to_start": "1-2 sentence summary of the recommended strategic approach (methodology, not products).",
  "where_to_start_detail": "2-4 sentences: assessment -> strategy -> execution -> measurement. May briefly note AWS can enable this at the end.",
  "whats_happening": "1-2 sentence summary of what's happening in their world creating urgency now.",
  "whats_happening_detail": "2-4 sentences on industry, hiring, sentiment, and named executives' public statements.",
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
      EXPERT_PERSONA + '\n' + ANTI_FABRICATION_POLICY + '\n\n' + SYSTEM_PROMPT,
      [{ role: 'user', content: userMessage }],
      { maxTokens: 4096, temperature: 0.6 }
    );

    return success(result);
  } catch (err) {
    console.error('Error generating unified account analysis:', err);
    return error(500, 'Failed to generate account analysis');
  }
}
