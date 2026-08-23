import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { invokeClaudeJSON } from '../shared/bedrock';
import { success, error } from '../shared/response';
import { EXPERT_PERSONA } from '../shared/persona';
import { ANTI_FABRICATION_POLICY } from '../shared/guardrails';

/**
 * GENERATE PRESENTATION SLIDES
 *
 * Produces a tight, conversational 2-3 slide executive deck to DRIVE a live
 * C-level conversation — not a dense read-out. Each slide leads with ONE big
 * insight, offers a suggested trend/graphic to anchor the discussion, and ends
 * with a question that opens dialogue. All the supporting detail is pushed to a
 * separate APPENDIX so the main slides stay sparse and provocative.
 *
 * It works from the SAME unified analysis the rest of the app already computed
 * (Approach + Buzz + Now + Next Steps + Key Asks) plus the account context and
 * the uploaded documents, and leverages EVERY section, so the deck stays
 * consistent with everything else and reflects any newly added documents.
 * This is a single, fast Bedrock call (no data gathering).
 */

export interface Slide {
  title: string;            // Sharp headline (max ~8 words)
  subtitle?: string;        // One-line framing under the title
  insight: string;          // THE single big idea for this slide (one strong sentence)
  bullets: string[];        // 2-3 short talking points MAX (board-ready, not paragraphs)
  visual: string;           // Suggested trend/graphic to put on the slide (chart/diagram description)
  talking_point: string;    // The question / provocation that drives the conversation
  footer?: string;          // Optional proof point / call to action
}

export interface AppendixItem {
  heading: string;          // What the detail is about
  detail: string;           // The dense supporting detail we deliberately kept OFF the main slides
}

export interface SlidesResponse {
  deck_title: string;       // Overall title for the deck
  slides: Slide[];          // 2-3 conversational slides, never more than 3
  appendix: AppendixItem[]; // The "read more" detail (numbers, mechanisms, methodology)
}

const SYSTEM_PROMPT = `You create a SHORT, CONVERSATIONAL executive slide deck (2-3 slides) that an AWS Training & Certification team puts on screen to DRIVE a live conversation with C-level executives. These slides are a conversation catalyst, NOT a document to be read.

${EXPERT_PERSONA}

${ANTI_FABRICATION_POLICY}

THE JOB OF THESE SLIDES: Provoke thinking and open dialogue. An executive should look at a slide and think "how did they see that about us?" and immediately want to respond. The AWS team speaks to the slide; the slide does not speak for them. Dense slides are a FAILURE.

CONVERSATIONAL / NOT DENSE — hard rules:
- Each slide leads with ONE big insight (a single strong sentence). Not five points competing for attention.
- MAX 2-3 short bullets per slide. Each bullet is a board-ready phrase, never a paragraph, never a run-on.
- Every slide includes a SUGGESTED VISUAL — a trend line, comparison, gap chart, or simple diagram that anchors the point (e.g. "Gap chart: 13% AI-skilled workers at leaders vs 1% at laggards"). Describe the graphic so it can be drawn. Prefer a trend or a gap the executive will feel.
- Every slide includes a TALKING POINT — the open question or provocation the presenter uses to turn the slide into a two-way conversation (e.g. "Where in your platform org would a 6-week capability sprint change a real number this quarter?").
- ALL the dense detail — full statistics, methodology, the mechanics of the mechanisms, extra proof points — goes into the APPENDIX, never on the main slides. The appendix is the "read more."

INSIGHTFUL AND PRESCRIPTIVE, NOT VAGUE: A bullet like "governance-first capability design" is a FAILURE. Be concrete, specific to this customer, and prescriptive. Lead with business consequence (competitive position, growth, risk, ROI).

UNIQUENESS: The deck must be unmistakably about THIS company — their real situation, named teams/executives, competitors, and opportunities from the data. If it could belong to another company, it is wrong. When new documents are provided, the deck MUST reflect what is new in them — never recycle a prior framing.

LEVERAGE THE WHOLE ANALYSIS + THE DOCUMENTS: Draw on EVERY section of the unified analysis (Approach, Buzz, Now, Next Steps, Key Asks) AND the uploaded documents and captured Salesforce data. Do not ignore a section or the documents.

SLIDE STRUCTURE (2 OR 3 slides — prefer 3 when there is enough real material):

── SLIDE 1 — "WHAT WE SEE ABOUT YOU" (customer intelligence: Approach + Buzz + documents) ──
The insight that earns the right to advise. ONE non-obvious observation about THEIR world: their market position and competitive dynamics (named competitors/market), a real team or executive, a Buzz signal (hiring, sentiment), and why the capability gap matters NOW. Visual: a trend or gap that makes their situation visible. Talking point: a question that gets them talking about their own reality.

── SLIDE 2 — "WHAT GREAT LOOKS LIKE / HOW WE HELP" (prescriptive approach) ──
ONE clear picture of the path, prescriptive but not dense. Name the ACTUAL AWS T&C mechanism that fits THIS customer best (the Skills Guild — Excitement→Enablement→Advocacy; the Foundation→Applied→Embedded curriculum mapped to their real roles; a role-based path like AI Practitioner→ML Engineer→Gen AI Developer; manager activation; performance-based credentials; the Capability→Adoption→Workflow→Business measurement chain). Put ONE mechanism forward as the headline move; keep the mechanics in the appendix. Visual: a simple maturity/tiered diagram or the measurement chain. Talking point: a question about where to start with them.

── SLIDE 3 — "THE FIRST MOVE + THE RETURN" (Now + Next Steps + Key Asks) ──
The momentum slide. The immediate first mission (a phased pilot with a 90-180 day proof point — from Now + Next Steps), the specific commitment to secure (from Key Asks), and ONE relevant ROI proof point. Visual: a simple ROI/impact bar or a 90-180 day timeline. Footer = the single clear ask that closes the meeting. Talking point: a question that gets a yes to the first step.
If there is not enough distinct material for a strong third slide, fold this into Slide 2 and produce 2 slides — never pad.

APPENDIX (3-6 items): This is where the detail lives. Move here: the full proof-point statistics with attribution (AWS enterprise 234% ROI / 65% pilot-to-production / 85% participation; Forrester 229% ROI; BCG AI leaders 13x more AI-skilled workers, 88% vs 25% manager role-modeling, 10-20-70), the mechanics of the recommended mechanism, the measurement methodology (baseline→target→proof), and any supporting document/Salesforce detail. Each appendix item is a heading + a concise detail paragraph. Cite proof points ONLY in the appendix and only where relevant — never invent numbers.

RULES:
- NEVER invent people, numbers, or company facts not present in the provided analysis/data. The proof-point statistics and the T&C mechanisms are YOUR expert knowledge and SHOULD be used (in the appendix). Never claim someone attends unless listed as a confirmed attendee.
- Keep the main slides sparse. If you are tempted to add a 4th bullet, move it to the appendix.

Return ONLY valid JSON of the exact shape:
{
  "deck_title": "string",
  "slides": [
    {
      "title": "string",
      "subtitle": "string",
      "insight": "string",
      "bullets": ["string", "string"],
      "visual": "string",
      "talking_point": "string",
      "footer": "string"
    }
  ],
  "appendix": [
    { "heading": "string", "detail": "string" }
  ]
}`;

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const accountId = event.pathParameters?.accountId;
    if (!accountId) return error(400, 'accountId is required');

    const body = JSON.parse(event.body || '{}');
    const { accountData, analysis } = body;
    if (!accountData) return error(400, 'accountData is required');

    const attendees = accountData.ebc_data?.attendees || [];
    const docs = accountData.externalDocs || [];

    // Build a compact context from the ALREADY-COMPUTED unified analysis plus the
    // combined internal sources, so the slides are consistent with the rest of the app.
    const hiring = analysis?.buzz_hiring_analysis;
    const sentiment = analysis?.buzz_sentiment_analysis;
    const analysisContext = analysis ? `UNIFIED ANALYSIS (already generated for this account — the slides MUST leverage ALL of this: Approach, Buzz, Now, Next Steps, Key Asks. Do not drop a section.):

APPROACH —
- Who to focus on: ${analysis.who_to_focus || ''} ${analysis.who_to_focus_detail || ''}
- Conversation angle: ${analysis.what_conversations || ''} ${analysis.what_conversations_detail || ''}
- Where to start: ${analysis.where_to_start || ''} ${analysis.where_to_start_detail || ''}
- What's happening / why now: ${analysis.whats_happening || ''} ${analysis.whats_happening_detail || ''}

BUZZ (what's happening around them) —
- Summary: ${analysis.buzz_summary || ''}
- Executive insights: ${(analysis.buzz_executive_insights || []).join(' | ') || '(none)'}
- Hiring signal: ${hiring ? `${(hiring.roles || []).map((r: any) => r.title).join(', ')} — ${hiring.why_this_matters || ''}` : '(none)'}
- Employee sentiment: ${sentiment ? `${(sentiment.signals || []).join('; ')} — ${sentiment.why_this_matters || ''}` : '(none)'}
- T&C opportunity: ${analysis.buzz_tc_opportunity || ''}

NOW (what to act on immediately) —
- Focus: ${analysis.now_focus || ''}
- Initiatives to drive: ${(analysis.now_initiatives || []).join(' | ')}
- Asks right now: ${(analysis.now_key_asks || []).join(' | ')}
- Opening move: ${analysis.now_opening_move || ''}

NEXT STEPS: ${(analysis.next_steps || []).join(' | ')}
KEY ASKS: ${(analysis.key_asks || []).join(' | ')}` : 'No unified analysis was provided; work only from the account data below and do not fabricate.';

    const context = `CUSTOMER: ${accountData.customer_name || 'Unknown'}
INDUSTRY: ${accountData.industry || 'Unknown'}
${attendees.length > 0 ? `CONFIRMED ATTENDEES: ${attendees.map((a: any) => `${a.name} (${a.title})`).join('; ')}` : ''}

${analysisContext}
${accountData.accountPlanText ? `\nINTERNAL AWS / SALESFORCE DATA (authoritative — real opportunities, spend, stakeholders):\n${String(accountData.accountPlanText).slice(0, 6000)}` : ''}
${docs.length > 0 ? `\nUPLOADED DOCUMENTS (drivers, trends, executive intelligence — reflect any NEW documents here):\n${docs.map((d: any) => `--- ${d.name} ---\n${String(d.text || '').slice(0, 4000)}`).join('\n\n')}` : ''}`;

    const userMessage = `Create a SHORT, CONVERSATIONAL C-level deck (3 slides, or 2 if there truly isn't enough material) for the conversation with ${accountData.customer_name || 'this customer'}. This is a conversation catalyst — sparse and provocative, NOT a dense read-out. Make it unmistakably about ${accountData.customer_name || 'this company'}. If new documents are present below, the deck MUST reflect what is new in them. Leverage EVERY section of the analysis — Approach, Buzz, Now, Next Steps, Key Asks — plus the documents and Salesforce data.

Each slide: ONE big insight, MAX 2-3 short bullets, a SUGGESTED VISUAL (trend/gap/diagram), and a TALKING POINT (the question that drives the conversation). Push all dense detail (full stats, mechanism mechanics, methodology) into the APPENDIX.

SLIDE 1 = WHAT WE SEE ABOUT THEM (Approach + Buzz + docs): one non-obvious insight about their world — competitive dynamics, real teams/executives, Buzz signals, why the gap matters now.
SLIDE 2 = WHAT GREAT LOOKS LIKE / HOW WE HELP: one prescriptive headline move naming the actual T&C mechanism that fits them; mechanics go to the appendix.
SLIDE 3 = FIRST MOVE + RETURN (Now + Next Steps + Key Asks): the phased first mission with a 90-180 day proof point, the commitment to secure, one relevant ROI proof; footer = the closing ask.

${context}`;

    const result = await invokeClaudeJSON<SlidesResponse>(
      SYSTEM_PROMPT,
      [{ role: 'user', content: userMessage }],
      { maxTokens: 2800, temperature: 0.5 }
    );

    // Hard guarantee: never more than 3 slides, always at least 1 with content; keep slides sparse.
    const slides = Array.isArray(result?.slides) ? result.slides.slice(0, 3) : [];
    const clean: SlidesResponse = {
      deck_title: result?.deck_title || `${accountData.customer_name || 'Account'} — Executive Conversation`,
      slides: slides
        .filter(s => s && (s.title || s.insight || (s.bullets && s.bullets.length > 0)))
        .map(s => ({
          title: s.title || '',
          subtitle: s.subtitle || undefined,
          insight: s.insight || '',
          // Keep the main slide sparse: at most 3 short bullets.
          bullets: (s.bullets || []).filter(b => typeof b === 'string' && b.trim().length > 2).slice(0, 3),
          visual: s.visual || '',
          talking_point: s.talking_point || '',
          footer: s.footer || undefined,
        })),
      appendix: Array.isArray(result?.appendix)
        ? result.appendix
            .filter(a => a && (a.heading || a.detail))
            .map(a => ({ heading: a.heading || '', detail: a.detail || '' }))
            .slice(0, 6)
        : [],
    };

    return success(clean);
  } catch (err) {
    console.error('generate-slides failed:', err);
    return error(500, 'Failed to generate slides');
  }
}
