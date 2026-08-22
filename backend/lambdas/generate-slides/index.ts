import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { invokeClaudeJSON } from '../shared/bedrock';
import { success, error } from '../shared/response';
import { EXPERT_PERSONA } from '../shared/persona';
import { ANTI_FABRICATION_POLICY } from '../shared/guardrails';

/**
 * GENERATE PRESENTATION SLIDES
 *
 * Produces a tight, MAX 2-slide executive presentation to support articulating
 * the customer discussion. It works from the SAME unified analysis the rest of
 * the app already computed (Approach + Buzz + Now + Next Steps + Key Asks) plus
 * the account context, so the slides stay perfectly consistent with everything
 * else the user sees. This is a single, fast Bedrock call (no data gathering),
 * so it returns well within the API Gateway limit.
 */

export interface SlideBullet {
  text: string;
}

export interface Slide {
  title: string;        // Slide headline
  subtitle?: string;    // Optional one-line framing under the title
  bullets: string[];    // 3-5 concise talking points
  footer?: string;      // Optional punch line / proof point / call to action
}

export interface SlidesResponse {
  deck_title: string;   // Overall title for the 2-slide view
  slides: Slide[];      // EXACTLY 1-2 slides, never more
}

const SYSTEM_PROMPT = `You create a MAXIMUM TWO-SLIDE executive presentation that an AWS Training & Certification team can put on screen to support a live customer conversation. This is a talking-support aid, NOT a full deck.

${EXPERT_PERSONA}

${ANTI_FABRICATION_POLICY}

THIS IS THE ACTUAL PITCH. These two slides ARE the pitch the AWS team will put on screen and speak to in front of C-level executives. They synthesize EVERYTHING the advisor generated (Approach, Buzz, Now, Next Steps, Key Asks) into the single, sharp story to tell this customer.

C-LEVEL BAR — MIND-BLOWING, NOT DETAILED:
- These are for CEOs/CFOs/CDOs. They must be INSIGHTFUL and provocative — the kind of slide that makes an executive stop and think "how did they see that about us?" — NOT a dense working document.
- LIGHT ON DETAIL. Few words, high impact. Each bullet is a punchy, board-ready statement, not a paragraph. No process minutiae, no jargon, no product mechanics.
- Lead with insight and business consequence (competitive position, growth, risk, ROI), not activities.

UNIQUENESS: The slides must be unmistakably about THIS company — their real situation, drivers, named executives, and opportunities from the data. If these slides could belong to another company, they are wrong. No reusable templates or canned program names.

SLIDE STRUCTURE (AT MOST 2 slides, never more):
- Slide 1 = "WHERE THEY ARE / WHY NOW" — their distinctive situation and the urgent, non-obvious insight. Ground it in their real drivers, trends, executives, and internal opportunities. This is the "we understand your world" slide that earns the right to advise.
- Slide 2 = "HOW AWS HELPS YOU WIN + THE RETURN" — the recommended approach AND, explicitly, HOW AWS helps this customer based on our lessons learned and best practices, framed to a measurable RETURN/ROI. This slide MUST:
    • State the AWS approach for THEIR specific situation (drawn from the analysis' recommended approach — not a generic program).
    • Explicitly connect it to AWS's proven track record / lessons learned and a RETURN the executive cares about (revenue enablement, speed-to-value, risk reduction, cost, retention) — cite a relevant proof point (e.g. AWS enterprise programs ~234% ROI, 65% pilot-to-production; Forrester 229% ROI; BCG: AI leaders have 13x more AI-skilled workers) where it sharpens the ROI case, but only where it fits.
    • End on a clear, confident call to action / the ask.
- Each slide: a sharp TITLE (max ~8 words), an optional one-line SUBTITLE, 3-5 SHORT bullets (board-ready one-liners, no markdown), and an optional FOOTER (the single sharpest proof point or the call to action).
- NEVER invent people, numbers, or company facts not present in the provided analysis/data. The proof-point statistics are your own expert knowledge and may be cited. Never claim someone attends unless listed as a confirmed attendee.

Return ONLY valid JSON of the exact shape:
{
  "deck_title": "string",
  "slides": [
    { "title": "string", "subtitle": "string", "bullets": ["string", "string", "string"], "footer": "string" }
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
    const analysisContext = analysis ? `UNIFIED ANALYSIS (already generated for this account — the slides MUST be consistent with this):
- Who to focus on: ${analysis.who_to_focus || ''} ${analysis.who_to_focus_detail || ''}
- Conversation angle: ${analysis.what_conversations || ''} ${analysis.what_conversations_detail || ''}
- Where to start: ${analysis.where_to_start || ''} ${analysis.where_to_start_detail || ''}
- What's happening / why now: ${analysis.whats_happening || ''} ${analysis.whats_happening_detail || ''}
- Buzz summary: ${analysis.buzz_summary || ''}
- Now focus: ${analysis.now_focus || ''}
- Opening move: ${analysis.now_opening_move || ''}
- T&C opportunity: ${analysis.buzz_tc_opportunity || ''}
- Next steps: ${(analysis.next_steps || []).join(' | ')}
- Key asks: ${(analysis.key_asks || []).join(' | ')}` : 'No unified analysis was provided; work only from the account data below and do not fabricate.';

    const context = `CUSTOMER: ${accountData.customer_name || 'Unknown'}
INDUSTRY: ${accountData.industry || 'Unknown'}
${attendees.length > 0 ? `CONFIRMED ATTENDEES: ${attendees.map((a: any) => `${a.name} (${a.title})`).join('; ')}` : ''}

${analysisContext}
${accountData.accountPlanText ? `\nINTERNAL AWS / SALESFORCE DATA (authoritative — real opportunities, spend, stakeholders):\n${String(accountData.accountPlanText).slice(0, 6000)}` : ''}
${docs.length > 0 ? `\nUPLOADED DOCUMENTS (drivers, trends, executive intelligence):\n${docs.map((d: any) => `--- ${d.name} ---\n${String(d.text || '').slice(0, 4000)}`).join('\n\n')}` : ''}`;

    const userMessage = `Create the MAX 2-slide C-LEVEL pitch for the conversation with ${accountData.customer_name || 'this customer'}. This IS the pitch we will present. Synthesize the whole analysis below into the sharpest possible story — insightful and mind-blowing, LIGHT on detail, board-ready one-liners only. Make it unmistakably about ${accountData.customer_name || 'this company'} (never generic). Slide 1 = their situation + the non-obvious insight. Slide 2 = HOW AWS helps them win based on our lessons learned/best practices, tied to a concrete RETURN/ROI the executive cares about, ending on the ask.

${context}`;

    const result = await invokeClaudeJSON<SlidesResponse>(
      SYSTEM_PROMPT,
      [{ role: 'user', content: userMessage }],
      { maxTokens: 1600, temperature: 0.5 }
    );

    // Hard guarantee: never more than 2 slides, always at least 1 with bullets.
    const slides = Array.isArray(result?.slides) ? result.slides.slice(0, 2) : [];
    const clean: SlidesResponse = {
      deck_title: result?.deck_title || `${accountData.customer_name || 'Account'} — Executive Conversation`,
      slides: slides
        .filter(s => s && (s.title || (s.bullets && s.bullets.length > 0)))
        .map(s => ({
          title: s.title || '',
          subtitle: s.subtitle || undefined,
          bullets: (s.bullets || []).filter(b => typeof b === 'string' && b.trim().length > 2).slice(0, 5),
          footer: s.footer || undefined,
        })),
    };

    return success(clean);
  } catch (err) {
    console.error('generate-slides failed:', err);
    return error(500, 'Failed to generate slides');
  }
}
