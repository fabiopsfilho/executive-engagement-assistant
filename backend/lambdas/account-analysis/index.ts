import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { invokeClaudeJSON } from '../shared/bedrock';
import { success, error } from '../shared/response';
import { getTCProductKnowledge } from '../shared/mcp';
import { getTCStrategyContext } from '../shared/knowledge-base';
import { tavilySearch, tavilyLinkedInSearch, tavilyGlassdoorSearch } from '../shared/tavily';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const lambdaClient = new LambdaClient({});
const CACHE_TABLE = process.env.INTELLIGENCE_CACHE_TABLE!;

/** Stable cache key from the inputs that affect the analysis. */
function analysisCacheKey(accountData: any): string {
  const name = (accountData.customer_name || 'unknown').toLowerCase().replace(/[^a-z0-9]/g, '-');
  const attendeeCount = accountData.ebc_data?.attendees?.length || 0;
  const planLen = (accountData.accountPlanText || '').length;
  // Version prefix (v2) invalidates any stale cached analyses from earlier prompt versions.
  // Key changes when attendees or captured/plan data change → forces fresh analysis.
  return `analysis-v7:${name}:att${attendeeCount}:plan${planLen}`;
}

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
  // Approach (concise executive summaries + expandable detail)
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
- Each Approach field is a SHORT executive summary (1-2 sentences, plain prose, no markdown). The matching "_detail" field holds 1-3 sentences of expanded reasoning — but ONLY expand using facts actually present in the data. If there isn't enough real data to expand, keep the detail short or make it identical to the summary. NEVER pad the detail with invented company descriptions, made-up markets/sectors, or assumed executive names/titles.
- next_steps and key_asks: exactly 4 each, one concise sentence per item.
- now_initiatives: exactly 4, one sentence each. buzz why_this_matters: 2 sentences max.
- buzz_hiring_analysis.roles: only real roles found in search (title + url).
- Empty arrays are fine when no real data exists — never fill with speculation.

CRITICAL — DO NOT DESCRIBE OR CHARACTERIZE THE COMPANY. Never write claims like "a world leader in X", "a leading provider of Y", "operates across A/B/C sectors", or any statement about their products, business model, market position, or customer base — even if a search snippet hints at it. A single search snippet is NOT enough to authoritatively describe a company; do not amplify it. Refer to the company ONLY by its name and its stated industry (e.g. "Financial Services"). Do NOT name or assume executive titles (CTO, COO, VP of Product, etc.) as accountable individuals unless those exact people appear in the Executive Social data or Confirmed Attendees. When you lack specifics, speak in general terms about the workforce transformation opportunity. Inventing a company description is a critical failure.

Return ONLY valid JSON.`;

const withTimeout = <T,>(p: Promise<T>, ms: number, fallback: T): Promise<T> =>
  Promise.race([p, new Promise<T>(resolve => setTimeout(() => resolve(fallback), ms))]);

// Condensed persona + guardrails for this high-volume unified call, to keep the
// prompt small enough that generation completes within API Gateway's 29s limit.
const CONDENSED_SYSTEM = `You are an AI Skills Transformation expert advising the AWS T&C team for an EBC (executive, business-focused — no technical jargon). Core lens: AI transformation is 70% people/process/org change (BCG 10-20-70); leaders win on TALENT not technology; workflow redesign over tool training; manager activation is critical; measure the chain (capability -> adoption -> workflow -> business outcome). Bridge to AWS T&C only as the execution partner, never a product pitch.

DATA INTEGRITY (zero tolerance): Ground everything in the real data provided. NEVER invent people, quotes, numbers, initiatives, or approaches. Confirmed attendees come ONLY from a provided "Confirmed Attendees" list — never claim anyone attends unless explicitly listed. You MAY name real executives found in the data (e.g. the CEO on LinkedIn) as key people to engage, but never as attendees.

ABSOLUTE RULE ON ATTENDEES: NEVER write phrases like "no confirmed attendees", "no attendees are listed", "attendee list not provided", "recommend pre-engagement to identify attendees", or ANY commentary about who is or isn't attending. Simply give your expert recommendation on which executives/roles to focus on, as if that is naturally your advice. The words "attendee", "attend", and "attending" must NOT appear in who_to_focus unless a Confirmed Attendees list was explicitly provided.

ABSOLUTE RULE ON TRAINING/CERTIFICATION STATE: You do NOT have data on the customer's certifications, Skill Builder usage, training maturity, or activation rates unless it is explicitly present in the captured/uploaded account data. NEVER state "zero certifications", "no prior AWS engagement", "greenfield", or any claim about their current training state based on assumption. If no training data is present, simply focus on the workforce transformation opportunity without characterizing their current certification/training status as a fact.

ABSOLUTE RULE ON COMPANY DESCRIPTION & EXECUTIVES: NEVER characterize the company with claims like "world leader in X", "leading provider of Y", or descriptions of its products/markets/customers — not even from a search snippet (one snippet is not enough to describe a company authoritatively). Refer to the company only by name + stated industry. Do NOT name or assume executive titles (CTO, COO, VP, etc.) as accountable people unless those exact people appear in Executive Social data or Confirmed Attendees. Keep recommendations general when you lack verified specifics. Fabricating a company description or its executives is a critical failure.`;

async function generateAnalysis(accountData: any, tcData: any): Promise<UnifiedAnalysisResponse> {
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
      hasIntel ? Promise.resolve('') : withTimeout(tavilyLinkedInSearch(`${companyName} jobs cloud AI engineer hiring`), 5000, ''),
      hasIntel ? Promise.resolve('') : withTimeout(tavilyGlassdoorSearch(`${companyName} reviews culture training development`), 5000, ''),
      hasIntel ? Promise.resolve('') : withTimeout(tavilySearch(`${companyName} cloud AI digital transformation 2025 2026 news`), 5000, ''),
      hasIntel ? Promise.resolve('') : withTimeout(tavilyLinkedInSearch(`${companyName} CEO CTO CFO CHRO executives`), 5000, ''),
      hasIntel ? Promise.resolve('') : withTimeout(tavilySearch(`${companyName} CHRO HR skills transformation workforce development talent strategy`), 5000, ''),
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

${tcData ? `T&C PIPELINE / OPPORTUNITY DATA (from the T&C opportunities file — this is a VIEW OF POTENTIAL, not current certification state):
Pipeline: $${(tcData.totalPipeline || 0).toLocaleString()}
Open Opportunities: ${tcData.openOpportunities || 0}
Products: ${(tcData.products || []).join(', ')}
Students: ${tcData.totalStudents || 0}` : ''}

IMPORTANT — NO TRAINING/CERTIFICATION STATE DATA IS AVAILABLE unless it appears in the CAPTURED ACCOUNT / BRIEF DATA section below. You do NOT know how many certifications they have, whether they use Skill Builder, or their activation rates. NEVER state or imply anything about their certification counts, training maturity, or "greenfield/zero certifications" status. Do not describe them as a "greenfield opportunity" based on assumed-zero training data. Only discuss training state if it is explicitly present in the captured/uploaded data.

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
Themes: ${(accountData.ebc_data?.themes || []).join(', ')}${attendees.length > 0 ? `\nConfirmed Attendees: ${attendees.map((a: any) => `${a.name} (${a.title}, ${a.persona})`).join('; ')}` : ''}

${accountData.accountPlanText ? `CAPTURED ACCOUNT / SALESFORCE / BRIEF DATA (analyze for training status, engagement history, pipeline, workforce info — use to inform ALL sections):\n${accountData.accountPlanText.slice(0, 6000)}` : ''}
${awsContext ? `\nAWS T&C KNOWLEDGE BASE:\n${awsContext.slice(0, 2500)}` : ''}
${onlineSearch ? `\nREAL-TIME ONLINE SEARCH RESULTS:\n${onlineSearch.slice(0, 3000)}` : ''}`;

    const userMessage = `Produce ONE unified, internally-consistent account analysis. Ground everything in the real data below. Reference real executives (e.g. the CEO found online) by name where relevant. Never fabricate people or claim anyone is a confirmed attendee unless they are in the Confirmed Attendees list.

${context}

Return JSON with exactly these fields (4 items each for next_steps/key_asks/now_initiatives):
{
  "who_to_focus": "1-2 sentence summary: who to focus on (real executives by name) and why.",
  "who_to_focus_detail": "2-3 sentences expanding on each key person's role, public activity, and how to approach them.",
  "what_conversations": "1-2 sentence summary: the strategic conversation angle to drive.",
  "what_conversations_detail": "2-3 sentences expanding it, referencing named executives' activity and real challenges.",
  "where_to_start": "1-2 sentence summary: the recommended strategic approach (methodology, not products).",
  "where_to_start_detail": "2-3 sentences: assessment -> strategy -> execution -> measurement. May briefly note AWS can enable this at the end.",
  "whats_happening": "1-2 sentence summary: what's happening in their world creating urgency now.",
  "whats_happening_detail": "2-3 sentences on industry, hiring, sentiment, and named executives' public statements.",
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
      { maxTokens: 3500, temperature: 0.3 }
    );

    return result;
}

/**
 * Async orchestration handler.
 * - Worker mode (invoked async with { __worker: true }): runs generateAnalysis and
 *   writes the result to the cache table. Never hits API Gateway, so no 29s limit.
 * - API mode (from the frontend): returns cached result if ready; otherwise kicks off
 *   the worker asynchronously and returns { status: 'processing' } immediately.
 *   The frontend polls until the result is ready.
 */
export async function handler(event: any): Promise<APIGatewayProxyResult | void> {
  // ── Worker mode (async self-invocation) ──
  if (event && event.__worker === true) {
    const { accountData, tcData, cacheKey } = event;
    try {
      const result = await generateAnalysis(accountData, tcData);
      await ddb.send(new PutCommand({
        TableName: CACHE_TABLE,
        Item: { cacheKey, status: 'ready', data: result, ttl: Math.floor(Date.now() / 1000) + 86400, createdAt: new Date().toISOString() },
      }));
    } catch (err) {
      console.error('Worker analysis failed:', err);
      await ddb.send(new PutCommand({
        TableName: CACHE_TABLE,
        Item: { cacheKey, status: 'error', ttl: Math.floor(Date.now() / 1000) + 600, createdAt: new Date().toISOString() },
      })).catch(() => {});
    }
    return;
  }

  // ── API mode (from API Gateway / frontend) ──
  try {
    const accountId = (event as APIGatewayProxyEvent).pathParameters?.accountId;
    if (!accountId) return error(400, 'accountId is required');

    const body = JSON.parse((event as APIGatewayProxyEvent).body || '{}');
    const { accountData, tcData, refresh } = body;
    if (!accountData) return error(400, 'accountData is required');

    const cacheKey = analysisCacheKey(accountData);

    // Check for an existing result/job.
    const cached = await ddb.send(new GetCommand({ TableName: CACHE_TABLE, Key: { cacheKey } })).catch(() => null);
    const item = cached?.Item;

    if (!refresh && item?.status === 'ready' && item.data) {
      return success({ status: 'ready', ...item.data });
    }
    if (item?.status === 'processing' && item.startedAt && (Date.now() - item.startedAt) < 90000) {
      // A job is already running — tell the client to keep polling.
      return success({ status: 'processing' });
    }

    // Mark a job as processing, then kick off the worker asynchronously.
    await ddb.send(new PutCommand({
      TableName: CACHE_TABLE,
      Item: { cacheKey, status: 'processing', startedAt: Date.now(), ttl: Math.floor(Date.now() / 1000) + 600 },
    }));

    await lambdaClient.send(new InvokeCommand({
      FunctionName: process.env.AWS_LAMBDA_FUNCTION_NAME!,
      InvocationType: 'Event', // async — returns immediately, no 29s limit on the worker
      Payload: Buffer.from(JSON.stringify({ __worker: true, accountData, tcData, cacheKey })),
    }));

    return success({ status: 'processing' });
  } catch (err) {
    console.error('Error orchestrating account analysis:', err);
    return error(500, 'Failed to start account analysis');
  }
}
