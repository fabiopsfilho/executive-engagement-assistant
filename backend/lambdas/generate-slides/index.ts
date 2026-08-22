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

SLIDE DESIGN RULES:
- Produce AT MOST 2 slides. One slide is fine if that is enough. NEVER more than 2.
- Slide 1 = "Where they are / why now" — the customer's situation, the distinctive insight, the urgency. Ground it in their real drivers, trends, executives, and internal opportunities from the data.
- Slide 2 = "Where to go together / what's next" — the recommended approach and the concrete next steps / asks. May reference how AWS T&C enables it, at a business (not product) level.
- Each slide: a sharp TITLE (max ~8 words), an optional one-line SUBTITLE, 3-5 BULLETS (each one concise line, boardroom language, no markdown), and an optional FOOTER (a punchy proof point or call-to-action).
- Executive tone: business outcomes, competitive position, workforce strategy, ROI. No technical jargon, no product mechanics.
- Be SPECIFIC to THIS company using the analysis and data provided. Generic slides that could apply to any company are a failure.
- You MAY cite the proof-point statistics from your expert knowledge (e.g. BCG 10-20-70, ~6% AI leaders with 13x more AI-skilled workers, Forrester 229% ROI, AWS 234% ROI) where they sharpen a point — but only where relevant, never dumped.
- NEVER invent people, numbers, or company facts not present in the provided analysis/data. Never claim someone attends unless they are listed as a confirmed attendee.

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

    const userMessage = `Create the MAX 2-slide executive support deck for the conversation with ${accountData.customer_name || 'this customer'}. Ground everything in the analysis and data below — be specific and consultative, never generic. Combine the internal Salesforce data, the uploaded documents, and the confirmed attendees into a coherent story.

${context}`;

    const result = await invokeClaudeJSON<SlidesResponse>(
      SYSTEM_PROMPT,
      [{ role: 'user', content: userMessage }],
      { maxTokens: 1600, temperature: 0.4 }
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
