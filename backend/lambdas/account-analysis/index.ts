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
  const docs = accountData.externalDocs || [];
  const docsSig = docs.length + '-' + docs.reduce((n: number, d: any) => n + (d.text || '').length, 0);
  // Version prefix invalidates stale caches. Key changes when attendees, captured/plan data,
  // OR uploaded external docs change → forces fresh analysis that includes the new data.
  return `analysis-v17:${name}:att${attendeeCount}:plan${planLen}:docs${docsSig}`;
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

╔══════════════════════════════════════════════════════════════════╗
║ UNIQUENESS MANDATE — THE #1 RULE. EVERY INSIGHT MUST BE BESPOKE.   ║
╚══════════════════════════════════════════════════════════════════╝
This analysis must be UNIQUE to THIS specific account. If you swapped in a different company, NONE of your output should still make sense. That is the test.
- NO REUSABLE FRAMEWORKS. Do not apply the same recurring template, methodology name, or "signature program" to every account. In particular, DO NOT default to canned phrases like "squad-level AI fluency," "workflow redesign," "capability assessment," "activate managers," "data-literacy program," "90-day pilot," "operating model," or "AI fluency sprint" unless the SPECIFIC data makes that genuinely the right, non-obvious answer for THIS company. If you catch yourself writing advice that could be pasted into any other account's brief, DELETE it and derive something that only fits THIS company.
- The distinctive HOOK you identify for this company (their unique situation — what they sell, their specific market moment, their named executives' real agendas, their actual internal opportunities) must DRIVE every field. who_to_focus, what_conversations, where_to_start, whats_happening, buzz, now, next_steps and key_asks should each read as a different facet of THAT company's specific story, not a generic playbook.
- Escalate specificity as data grows: with only public search, make the angle unique to their public footprint; when Salesforce capture is added, re-derive everything around their real opportunities/spend/stakeholders; when documents/attendees are added, re-derive everything around those drivers/trends/people. More data = MORE bespoke, never a fallback to the template.
- Vary structure and vocabulary between accounts. Two different accounts must not receive the same-shaped recommendations.

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

UNIQUENESS IS THE #1 REQUIREMENT: Every insight must be bespoke to THIS account and would make no sense for a different company. Do NOT reuse the same framework, methodology name, or canned phrasing across accounts (avoid defaulting to "squad-level AI fluency", "workflow redesign", "capability assessment", "90-day pilot", "data-literacy program", "operating model" unless the specific data truly makes it the right answer here). Let this company's distinctive situation shape the vocabulary and structure of the recommendations. If two different accounts would receive the same-shaped advice, you have failed.

DATA INTEGRITY — the line between specific and fabricated:
- ALLOWED: Stating facts that appear in the search results (e.g. if results say the company announced a cloud migration, or is hiring 12 ML engineers, or the CEO posted about AI — use it, cite the substance).
- FORBIDDEN: Inventing facts not in the results. Do NOT invent what the company does if the search didn't reveal it. Do NOT invent executive names/titles as accountable people unless a real person appears in the EXECUTIVE LEADERSHIP search results or Confirmed Attendees. Do NOT invent numbers, quotes, or initiatives.
- If the research genuinely returned little about this company, be honest and consultative: focus on what their INDUSTRY and stated PRIORITY imply for workforce transformation, and recommend specific discovery questions — but do not fabricate company specifics to fill the gap.

ATTENDEES: Confirmed attendees come ONLY from a provided "Confirmed Attendees" list. NEVER write "no confirmed attendees", "attendee list not provided", or any commentary about who is/isn't attending. The words "attendee/attend/attending" must not appear in who_to_focus unless a list was provided. Name real executives found in the research as key people to engage — just never as "attendees".

NAMES: Only name a person if you have their FULL real name from the research. NEVER use initials or partial fragments (e.g. "M.A.", "W.W.", "D.A.V.") — if you only have a fragment, refer to the ROLE instead ("the CEO", "the Head of Engineering"). Never present initials as if they identify a person.

NEVER COMMENT ON ABSENCE OF DATA — anywhere, in any field. Do NOT write phrases like "zero detected hiring", "no visible executive activity", "no social activity found", "without detected data", "no confirmed X". These expose our tooling and add no value to an executive. If you lack a data point, simply omit it and speak to what you DO know or what the industry/priority implies. Silence about a gap is correct; narrating the gap is forbidden.

TRAINING STATE: You have NO data on their certifications/Skill Builder/training maturity unless it's in captured/uploaded data. Never claim "zero certifications" or "greenfield" as fact.

CAPTURED DATA IS PRIMARY: When a "CAPTURED SALESFORCE / ACCOUNT SUMMARY / BRIEF DATA" section is present, it is real internal data and your PRIMARY source — it outranks the public web search. Read every section of it and ground your recommendations in its specifics (real opportunities, real stakeholders, real spend, real priorities). This is what makes the analysis genuinely consultative.`;

async function generateAnalysis(accountData: any, tcData: any): Promise<UnifiedAnalysisResponse> {
    const industry = accountData.industry || 'Technology';
    const companyName = accountData.customer_name || 'Unknown';
    const geo = (accountData.geo || 'NAMER').toUpperCase();

    // Region/language-aware terms. Many non-US companies (e.g. Brazilian) have a mostly
    // local-language web presence, so we localize the "what does the company do" and
    // "strategy/news" queries to surface real, specific data.
    const localeMap: Record<string, { lang: string; profileQ: string; strategyQ: string }> = {
      LATAM: {
        lang: 'Portuguese/Spanish',
        profileQ: `O que faz a empresa ${companyName}? modelo de negócio, produtos, serviços, tamanho, mercado (What does ${companyName} do)`,
        strategyQ: `${companyName} estratégia transformação digital nuvem inteligência artificial IA prioridades 2025 2026 notícias`,
      },
      EMEA: {
        lang: 'local European language / English',
        profileQ: `What does ${companyName} do? business model, products, services, markets (include local-language sources)`,
        strategyQ: `${companyName} digital transformation cloud AI strategy priorities 2025 2026 news (include local-language sources)`,
      },
      APJ: {
        lang: 'local Asian language / English',
        profileQ: `What does ${companyName} do? business model, products, services, markets (include local-language sources)`,
        strategyQ: `${companyName} digital transformation cloud AI strategy priorities 2025 2026 news (include local-language sources)`,
      },
      NAMER: {
        lang: 'English',
        profileQ: `What does ${companyName} do? business model, main products and services, size, markets`,
        strategyQ: `${companyName} strategic priorities AI cloud digital transformation initiatives 2025 2026 announcements`,
      },
    };
    const locale = localeMap[geo] || localeMap.NAMER;

    // ALWAYS research the company deeply — this is what makes the advice consultative and
    // specific rather than generic. Region-aware so non-US accounts surface real data.
    // (Async worker → no 29s limit, so we can search fully.)
    const [mcpDocs, kbDocs, companyProfile, companyProfileEn, strategyNews, hiringResults, executiveResults, sentimentResults] = await Promise.all([
      withTimeout(getTCProductKnowledge(industry, ['workforce transformation', 'talent development']).catch(() => ''), 3000, ''),
      withTimeout(getTCStrategyContext(industry, 'CTO', accountData.ebc_data?.themes || []).catch(() => ''), 3000, ''),
      withTimeout(tavilySearch(locale.profileQ), 6000, ''),
      // Always also try an English profile search so we get both local and global coverage.
      geo === 'NAMER' ? Promise.resolve('') : withTimeout(tavilySearch(`${companyName} company profile industry ${industry} what they do`), 6000, ''),
      withTimeout(tavilySearch(locale.strategyQ), 6000, ''),
      withTimeout(tavilyLinkedInSearch(`${companyName} hiring cloud AI data engineer roles`), 6000, ''),
      withTimeout(tavilyLinkedInSearch(`${companyName} CEO CTO CIO CHRO executive leadership team`), 6000, ''),
      withTimeout(tavilyGlassdoorSearch(`${companyName} employee reviews culture learning development`), 6000, ''),
    ]);

    const awsContext = [mcpDocs, kbDocs].filter(Boolean).join('\n\n');
    const onlineSearch = [
      companyProfile ? `WHAT THE COMPANY DOES (business profile, ${locale.lang} sources):\n${companyProfile}` : '',
      companyProfileEn ? `COMPANY PROFILE (English sources):\n${companyProfileEn}` : '',
      strategyNews ? `STRATEGIC PRIORITIES & RECENT NEWS:\n${strategyNews}` : '',
      hiringResults ? `HIRING / OPEN ROLES:\n${hiringResults}` : '',
      executiveResults ? `EXECUTIVE LEADERSHIP (real people found online):\n${executiveResults}` : '',
      sentimentResults ? `EMPLOYEE SENTIMENT:\n${sentimentResults}` : '',
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

${pi.linkedin_job_postings?.cloud_ai_roles > 0 ? `\nLINKEDIN HIRING:\n${pi.linkedin_job_postings.cloud_ai_roles} cloud/AI roles (${pi.linkedin_job_postings.yoy_change} YoY)` : ''}
${(pi.glassdoor_signals || []).length > 0 ? `\nGLASSDOOR EMPLOYEE SENTIMENT:\n${(pi.glassdoor_signals || []).map((s: string) => `"${s}"`).join('\n')}` : ''}
${pi.industry_context ? `\nINDUSTRY CONTEXT:\n${pi.industry_context}` : ''}
${(pi.news_signals || []).length > 0 ? `\nNEWS SIGNALS:\n${(pi.news_signals || []).join('\n')}` : ''}

EBC DATA:
Date: ${accountData.ebc_data?.meeting_dates?.[0] || 'TBD'}
Location: ${accountData.ebc_data?.location || 'TBD'}
Themes: ${(accountData.ebc_data?.themes || []).join(', ')}${attendees.length > 0 ? `\nConfirmed Attendees: ${attendees.map((a: any) => `${a.name} (${a.title}, ${a.persona})`).join('; ')}` : ''}

${(accountData.accountPlanText || (accountData.externalDocs || []).length > 0 || attendees.length > 0) ? `═══ HOW TO USE YOUR SOURCES — READ FIRST ═══
You have up to three high-value sources. They are not competing versions of the truth — they are LAYERS that you MUST combine into one synthesized view. Do not analyze them in isolation; triangulate across them.
  1. CAPTURED SALESFORCE DATA = our OWN INTERNAL AWS intelligence (what AWS already knows and owns about this account: opportunities, pipeline, spend, engagement history, stakeholders, priorities). This is the authoritative internal foundation. Ground the business reality here.
  2. UPLOADED DOCUMENTS + ATTENDEE LIST = the DEPTH layer. Documents add the drivers, trends, executive intelligence and suggested next steps; the attendee list tells you exactly who is in the room. Together they deepen and sharpen the internal picture.
  3. PUBLIC WEB SEARCH = supplementary color only, used to enrich — never to override the two internal sources above.
SYNTHESIZE: connect an internal Salesforce fact (an open opportunity, a named stakeholder, AWS spend) to a document driver/trend and to a confirmed attendee's role, so every recommendation is grounded in the combined picture. When two sources reinforce each other, say so; that convergence is your strongest insight.
` : ''}${accountData.accountPlanText ? `═══ CAPTURED SALESFORCE / ACCOUNT SUMMARY DATA (INTERNAL AWS INTELLIGENCE — AUTHORITATIVE) ═══
This is REAL, INTERNAL AWS account data captured from Salesforce (or an uploaded brief) — it is what AWS already knows and owns about this customer, and is your authoritative internal foundation. It outranks the public web search. Analyze EVERY section — account plan, opportunities, pipeline, AWS spend, engagement history, contacts/stakeholders, notes, priorities — and let it drive the Approach, Next Steps, Key Asks, Buzz and Now. Where it names real people, priorities, opportunities, or numbers, use them specifically, and connect them to the documents and attendees below.
${accountData.accountPlanText.slice(0, 14000)}` : ''}
${(accountData.externalDocs || []).length > 0 ? `\n═══ UPLOADED EXTERNAL DOCUMENTS (Databook, account brief, intelligence reports) — RICHEST SOURCE ═══
These are REAL documents the user uploaded and are your RICHEST, most-trusted intelligence. MINE THEM DEEPLY for: business drivers, market/industry trends, strategic priorities, executive intelligence (named leaders, their agendas, quotes, priorities), financials/spend, competitive dynamics, and any SUGGESTED NEXT STEPS or recommendations the documents themselves contain. You MUST weave these specifics into every section — Approach, Next Steps, Key Asks, Buzz, Now. When a document already suggests next steps or names a driver/trend/executive priority, build on it explicitly rather than inventing generic advice. Cross-reference these document specifics with the internal Salesforce data above and the confirmed attendees below — where a document driver lines up with an internal opportunity or an attendee's role, connect them into one insight. These specifics are what make the analysis genuinely consultative.
${(accountData.externalDocs || []).map((d: any) => `--- Document: ${d.name} ---\n${(d.text || '').slice(0, 10000)}`).join('\n\n')}` : ''}
${awsContext ? `\nAWS T&C KNOWLEDGE BASE:\n${awsContext.slice(0, 2500)}` : ''}
${onlineSearch ? `\n═══ PUBLIC WEB SEARCH (SUPPLEMENTARY — secondary to the captured data above) ═══\n${onlineSearch.slice(0, 3000)}` : ''}`;

    const userMessage = `You are preparing the AWS T&C team for a HIGH-STAKES executive briefing. The output must be INSIGHTFUL and MIND-SHIFTING — the kind of analysis that makes a C-level leader lean forward, not a generic template. Mediocre, interchangeable advice ("do a capability assessment, activate managers") is a FAILURE. Every account deserves a BESPOKE point of view.

HOW TO BE INSIGHTFUL (do all of this):
0. UNIQUENESS FIRST: Everything below must be bespoke to THIS account. No reusable frameworks or canned program names. If your recommendation could be copy-pasted into another company's brief, it is wrong — re-derive it from this company's specific data. The more data you have (capture, documents, attendees), the MORE specific you get.
1. LEAD WITH THE MOST DISTINCTIVE, NON-OBVIOUS INSIGHT about THIS specific company — the "aha" that only applies to them. Look hard at the documents for the single sharpest angle (e.g. a company that SELLS employee-experience products has a unique credibility story applying the same discipline to its own workforce; a company mid-migration has a specific window; a regulated player has a specific risk-to-capability link). Find their unique hook.
2. MINE THE UPLOADED DOCUMENTS for the real drivers, trends, executive intelligence, and any suggested next steps — and BUILD ON them. If a document already identifies a driver, trend, or recommended action, reference it specifically and advance it. Do not ignore rich document content in favor of generic advice.
3. USE CONCRETE PROOF POINTS from your expertise where they sharpen the argument and would land with an executive: e.g. BCG found only ~6% of companies are AI leaders and they have 13x more AI-skilled workers; 70% of AI value is people/process/org change (10-20-70); Forrester found 229% ROI on structured training; AWS enterprise programs show 234% ROI, 85% participation, 65% pilot-to-production; 88% of managers at mature orgs role-model AI vs 25% at laggards. Cite the RIGHT one for the moment — do not dump them all.
4. AVOID REPETITION across sections. Do not anchor every field on the same one person or one fact. Each section should advance a different part of the argument.
5. BE SPECIFIC AND BOLD in recommendations — tie each to THIS company's actual drivers/trends/products/initiatives from the data, not a reusable checklist.
6. COMBINE THE INTERNAL SOURCES. When present, weave together (a) the captured Salesforce data — our internal AWS view of opportunities, spend, stakeholders and history, (b) the uploaded documents — drivers, trends, executive intelligence and their suggested next steps, and (c) the confirmed attendee list — who is actually in the room. The sharpest insights come from connecting these: e.g. an open internal opportunity that maps to a document-identified driver and is owned by a confirmed attendee. Never treat them as separate silos; the combined picture is the whole point.

INTEGRITY (unchanged): Only use facts present in the data. Never invent people, numbers, or company descriptions. The proof-point STATISTICS above are your own expert knowledge and may always be cited. Never claim anyone is a confirmed attendee unless in the Confirmed Attendees list. Never narrate data gaps.

${context}

Return JSON with exactly these fields (4 items each for next_steps/key_asks/now_initiatives):
{
  "who_to_focus": "1-2 sentences: which real executive(s)/role(s) to focus on and the SPECIFIC reason tied to their agenda/priorities from the data.",
  "who_to_focus_detail": "2-3 sentences: what specifically drives this person (from the documents), and the sharpest angle to engage them — not generic.",
  "what_conversations": "1-2 sentences: the ONE bold, distinctive conversation angle for THIS company — ideally the non-obvious insight/hook.",
  "what_conversations_detail": "2-3 sentences developing that angle with their real drivers/trends/products and a relevant proof point.",
  "where_to_start": "1-2 sentences: the recommended strategic approach, tied to their specific situation (not a generic assessment→activate template).",
  "where_to_start_detail": "2-3 sentences making it concrete to their actual workflows/initiatives; may end with how AWS enables it.",
  "whats_happening": "1-2 sentences: the most important real dynamic in their world creating urgency now.",
  "whats_happening_detail": "2-3 sentences citing real drivers, trends, financials, and executive priorities from the documents.",
  "buzz_summary": "2-3 sentence sharp synthesis of what's really happening at this company.",
  "buzz_executive_insights": ["One insight per REAL executive found in the data — what drives them and how to approach. Empty array if none. Never invent."],
  "buzz_hiring_analysis": { "roles": [{"title": "Role", "url": "https://..."}], "why_this_matters": "What the hiring/skills signals reveal about their capability gap." },
  "buzz_sentiment_analysis": { "signals": ["real employee signal from data"], "why_this_matters": "What it means for their learning culture and readiness." },
  "buzz_tc_opportunity": "The distinctive workforce-development APPROACH for THIS company (methodology tied to their drivers, not products).",
  "now_focus": "The single most important capability issue right now — the sharp, specific insight.",
  "now_initiatives": ["4 bold initiatives, each tied to a specific driver/trend/workflow from the data."],
  "now_key_asks": ["4 consultative discovery questions that prove you understand their specific situation."],
  "now_opening_move": "A specific, compelling opening — reference their distinctive situation and a proof point; may name a real executive; never claim attendance.",
  "next_steps": ["4 CONCRETE, SEQUENCED ACTIONS THE AWS TEAM WILL TAKE after this meeting — each names WHAT to do, WITH/FOR whom (a real person or role from the data), and the OUTCOME/ARTIFACT it produces (e.g. a workshop, a proposal, a pilot scope). Each must trace to a SPECIFIC fact in the captured Salesforce data or uploaded documents — quote or reference that fact. These are ACTIONS WE OWN, and must be DISTINCT from now_initiatives (which are strategic plays) and from key_asks (which are things we request from the customer)."],
  "key_asks": ["4 SPECIFIC THINGS TO SECURE FROM THE CUSTOMER — a commitment, a decision, access to a person, or an answer to a pointed question — each tied to a named opportunity/driver/stakeholder from the data. These are things WE REQUEST FROM THEM (not actions we take), and must be DISTINCT from now_key_asks and from next_steps. Frame each as 'Secure/Confirm/Get access to/Get their view on ...' grounded in a real specific."]
}

CRITICAL — MAKE NEXT STEPS & KEY ASKS DATA-DRIVEN AND DISTINCT:
- next_steps and key_asks MUST visibly reflect the NEWEST captured data and uploaded documents. If a document names a driver, an initiative, a suggested action, or a person — the steps/asks must reference it specifically. Do NOT produce generic, reusable steps that would read the same for any company.
- next_steps (actions WE take) and key_asks (things WE request from THEM) must NOT overlap with each other, and must NOT merely restate now_initiatives / now_key_asks. Each of the four lists serves a different purpose — keep them clearly differentiated.
- Reference specific names, numbers, opportunities, or document facts in the steps/asks so it is obvious they were generated from THIS account's actual current data.`;

    const result = await invokeClaudeJSON<UnifiedAnalysisResponse>(
      CONDENSED_SYSTEM + '\n\n' + SYSTEM_PROMPT,
      [{ role: 'user', content: userMessage }],
      { maxTokens: 5000, temperature: 0.45 }
    );

    return sanitizeAnalysis(result);
}

/**
 * Deterministic safety net: strip any sentence that narrates a data gap or mentions
 * attendee presence/absence. The model is instructed not to write these, but this
 * guarantees they never reach the UI regardless of model behavior.
 */
function sanitizeAnalysis(r: UnifiedAnalysisResponse): UnifiedAnalysisResponse {
  const banned = [
    /without (confirmed |detected |named |visible )?[^.]*?(attendee|executive|leadership|data|hiring|social activity)[^.]*?[.,]/gi,
    /no (confirmed |detected |named |visible )?(attendees?|executives?|social activity|data|hiring)[^.]*?[.,]/gi,
    /(attendee list (is )?(not )?(provided|listed|available)|no attendee list)[^.]*?[.,]/gi,
    /(since|as|because|given) (there are|we have|there is) no [^.]*?(attendee|executive|data|hiring)[^.]*?[.,]/gi,
    /based on (the )?(limited|available|thin|sparse) (search results|data|information)[^.]*?[.,]/gi,
    /the search (results )?(did not|didn't|do not|don't) [^.]*?[.,]/gi,
    /zero (detected |visible )?(hiring|cloud\/ai roles|certifications)[^.]*?[.,]/gi,
  ];
  const clean = (s: string | undefined): string => {
    if (!s) return s || '';
    let out = s;
    for (const re of banned) out = out.replace(re, '');
    // Collapse whitespace, fix leading punctuation/conjunctions left behind, capitalize.
    out = out.replace(/\s{2,}/g, ' ').replace(/^\s*[,.;:]\s*/, '').replace(/^\s*(and|but|however|although|while)\s+/i, '').trim();
    if (out) out = out.charAt(0).toUpperCase() + out.slice(1);
    return out;
  };
  // Detect an item that was clearly cut off mid-sentence (e.g. JSON truncated at max_tokens).
  // Signals: an unbalanced "(", or it ends on a dangling word/connector with no closing punctuation.
  const looksTruncated = (s: string): boolean => {
    const t = s.trim();
    if (!t) return true;
    const opens = (t.match(/\(/g) || []).length;
    const closes = (t.match(/\)/g) || []).length;
    if (opens > closes) return true; // e.g. "...Consultant ("
    // Ends on a connector/article/preposition with no terminal punctuation → mid-sentence cut.
    if (/[a-z0-9,]$/i.test(t) && /\b(the|a|an|to|of|for|with|and|or|in|on|at|by|that|which|who|from|as|is|are|will|would|—|-)$/i.test(t)) return true;
    return false;
  };
  const cleanArr = (arr: string[] | undefined): string[] =>
    (arr || []).map(clean).filter(x => x.length > 3 && !looksTruncated(x));

  return {
    ...r,
    who_to_focus: clean(r.who_to_focus),
    who_to_focus_detail: clean(r.who_to_focus_detail),
    what_conversations: clean(r.what_conversations),
    what_conversations_detail: clean(r.what_conversations_detail),
    where_to_start: clean(r.where_to_start),
    where_to_start_detail: clean(r.where_to_start_detail),
    whats_happening: clean(r.whats_happening),
    whats_happening_detail: clean(r.whats_happening_detail),
    buzz_summary: clean(r.buzz_summary),
    buzz_tc_opportunity: clean(r.buzz_tc_opportunity),
    now_focus: clean(r.now_focus),
    now_opening_move: clean(r.now_opening_move),
    now_initiatives: cleanArr(r.now_initiatives),
    now_key_asks: cleanArr(r.now_key_asks),
    next_steps: cleanArr(r.next_steps),
    key_asks: cleanArr(r.key_asks),
    buzz_executive_insights: cleanArr(r.buzz_executive_insights),
  };
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
