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
  return `analysis-v8:${name}:att${attendeeCount}:plan${planLen}`;
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

BE SPECIFIC USING THE RESEARCH: Reference this company's actual business, strategic initiatives, hiring, and named executives AS FOUND in the search results. That specificity is what makes this consultative. But only state what the research actually supports — if the research is thin, ground the advice in their industry + stated priority and recommend discovery questions, rather than inventing company facts or executive names. Do NOT amplify a single vague snippet into a bold claim like "world leader in X"; state what's actually supported, at the confidence the evidence warrants.

Return ONLY valid JSON.`;

const withTimeout = <T,>(p: Promise<T>, ms: number, fallback: T): Promise<T> =>
  Promise.race([p, new Promise<T>(resolve => setTimeout(() => resolve(fallback), ms))]);

// Condensed persona + guardrails for this high-volume unified call, to keep the
// prompt small enough that generation completes within API Gateway's 29s limit.
const CONDENSED_SYSTEM = `You are a world-class AI Skills Transformation expert from AWS Training & Certification, preparing the team for an executive (EBC) conversation. Executives expect SPECIFIC, CONSULTATIVE, practical insight about THEIR company — not generic "skills transformation" platitudes. Your value comes from grounding every recommendation in what this specific company actually does, their real strategic priorities, their real hiring, and their real leaders. Core lens: AI transformation is 70% people/process/org change (BCG 10-20-70); leaders win on talent not technology; workflow redesign over tool training; manager activation; measure capability->adoption->workflow->business outcome. Bridge to AWS T&C only as the execution partner, never a product pitch.

USE THE RESEARCH — BE SPECIFIC: The provided search results tell you what this company does, their strategic moves, hiring, and executives. USE these facts to make the advice specific and consultative. Reference their actual business, actual initiatives, actual named executives (from the search), and actual open roles. Generic advice that could apply to any company is a FAILURE — an executive would find it worthless.

DATA INTEGRITY — the line between specific and fabricated:
- ALLOWED: Stating facts that appear in the search results (e.g. if results say the company announced a cloud migration, or is hiring 12 ML engineers, or the CEO posted about AI — use it, cite the substance).
- FORBIDDEN: Inventing facts not in the results. Do NOT invent what the company does if the search didn't reveal it. Do NOT invent executive names/titles as accountable people unless a real person appears in the EXECUTIVE LEADERSHIP search results or Confirmed Attendees. Do NOT invent numbers, quotes, or initiatives.
- If the research genuinely returned little about this company, be honest and consultative: focus on what their INDUSTRY and stated PRIORITY imply for workforce transformation, and recommend specific discovery questions — but do not fabricate company specifics to fill the gap.

ATTENDEES: Confirmed attendees come ONLY from a provided "Confirmed Attendees" list. NEVER write "no confirmed attendees", "attendee list not provided", or any commentary about who is/isn't attending. The words "attendee/attend/attending" must not appear in who_to_focus unless a list was provided. Name real executives found in the research as key people to engage — just never as "attendees".

TRAINING STATE: You have NO data on their certifications/Skill Builder/training maturity unless it's in captured/uploaded data. Never claim "zero certifications" or "greenfield" as fact.`;

async function generateAnalysis(accountData: any, tcData: any): Promise<UnifiedAnalysisResponse> {
    const industry = accountData.industry || 'Technology';
    const companyName = accountData.customer_name || 'Unknown';

    // ALWAYS research the company deeply — this is what makes the advice consultative and
    // specific rather than generic. We search their actual business, strategy, initiatives,
    // hiring, executives, and sentiment. (Async worker → no 29s limit, so we can search fully.)
    const [mcpDocs, kbDocs, companyProfile, strategyNews, hiringResults, executiveResults, sentimentResults, skillsResults] = await Promise.all([
      withTimeout(getTCProductKnowledge(industry, ['workforce transformation', 'talent development']).catch(() => ''), 3000, ''),
      withTimeout(getTCStrategyContext(industry, 'CTO', accountData.ebc_data?.themes || []).catch(() => ''), 3000, ''),
      withTimeout(tavilySearch(`What does ${companyName} do? business model, main products and services, size, markets`), 6000, ''),
      withTimeout(tavilySearch(`${companyName} strategic priorities AI cloud digital transformation initiatives 2025 2026 announcements`), 6000, ''),
      withTimeout(tavilyLinkedInSearch(`${companyName} hiring cloud AI data engineer roles`), 6000, ''),
      withTimeout(tavilyLinkedInSearch(`${companyName} CEO CTO CIO CHRO executive leadership`), 6000, ''),
      withTimeout(tavilyGlassdoorSearch(`${companyName} employee reviews culture learning development`), 6000, ''),
      withTimeout(tavilySearch(`${companyName} workforce skills talent AI upskilling training strategy`), 6000, ''),
    ]);

    const awsContext = [mcpDocs, kbDocs].filter(Boolean).join('\n\n');
    const onlineSearch = [
      companyProfile ? `WHAT THE COMPANY DOES (business profile):\n${companyProfile}` : '',
      strategyNews ? `STRATEGIC PRIORITIES & RECENT NEWS:\n${strategyNews}` : '',
      hiringResults ? `HIRING / OPEN ROLES:\n${hiringResults}` : '',
      executiveResults ? `EXECUTIVE LEADERSHIP (real people found online):\n${executiveResults}` : '',
      sentimentResults ? `EMPLOYEE SENTIMENT:\n${sentimentResults}` : '',
      skillsResults ? `WORKFORCE / SKILLS SIGNALS:\n${skillsResults}` : '',
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
