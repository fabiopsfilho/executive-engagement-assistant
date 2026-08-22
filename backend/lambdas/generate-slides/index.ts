import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { invokeClaudeJSON } from '../shared/bedrock';
import { success, error } from '../shared/response';
import { EXPERT_PERSONA } from '../shared/persona';
import { ANTI_FABRICATION_POLICY } from '../shared/guardrails';

/**
 * GENERATE PRESENTATION SLIDES
 *
 * Produces a tight, 2-3 slide executive presentation to support articulating
 * the customer discussion. It works from the SAME unified analysis the rest of
 * the app already computed (Approach + Buzz + Now + Next Steps + Key Asks) plus
 * the account context, and leverages EVERY section of it, so the slides stay
 * perfectly consistent with everything else the user sees. This is a single,
 * fast Bedrock call (no data gathering), so it returns within the API GW limit.
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
  deck_title: string;   // Overall title for the deck
  slides: Slide[];      // 2-3 slides, never more than 3
}

const SYSTEM_PROMPT = `You create a MAXIMUM TWO-SLIDE executive presentation that an AWS Training & Certification team can put on screen to support a live customer conversation. This is a talking-support aid, NOT a full deck.

${EXPERT_PERSONA}

${ANTI_FABRICATION_POLICY}

THIS IS THE ACTUAL PITCH. These two slides ARE the pitch the AWS team will put on screen and speak to in front of C-level executives. They synthesize EVERYTHING the advisor generated (Approach, Buzz, Now, Next Steps, Key Asks) into the single, sharp story to tell this customer.

C-LEVEL BAR — INSIGHTFUL AND PRESCRIPTIVE:
- These are for CEOs/CFOs/CDOs. They must be INSIGHTFUL and provocative — the kind of slide that makes an executive think "how did they see that about us?"
- Board-ready one-liners, not paragraphs. But NOT vague — a bullet like "governance-first capability design" is a FAILURE. Be concrete and prescriptive.
- Lead with insight and business consequence (competitive position, growth, risk, ROI), not filler activities.

UNIQUENESS: The slides must be unmistakably about THIS company — their real situation, drivers, named teams/executives, and opportunities from the data. If these slides could belong to another company, they are wrong. No reusable templates.

LEVERAGE THE WHOLE ANALYSIS: The slides MUST draw on EVERY section of the unified analysis provided — Approach (who/what/where/why-now), Buzz (executive insights, hiring signal, employee sentiment), Now (focus, initiatives, opening move), Next Steps, and Key Asks. Do not ignore a section. Slide 1 pulls from Approach + Buzz; Slide 2 pulls from Approach (where-to-start) + the T&C playbook; Slide 3 pulls from Now + Next Steps + Key Asks.

SLIDE STRUCTURE (2 OR 3 slides — prefer 3 when there is enough real material):

── SLIDE 1 — "WHAT WE KNOW ABOUT YOU" (customer intelligence: Approach + Buzz) ──
The "we understand your world" slide that earns the right to advise. Ground it entirely in the REAL data about this company:
  • Their specific business, market position, and competitive dynamics (named competitors, the market they play in).
  • Their real teams, named executives (from Approach + Buzz executive insights), and the internal opportunities/priorities from the captured/document data (e.g. a specific engineering or platform team, a specific initiative).
  • The real signals from Buzz — hiring moves, employee sentiment, what's being said — and the urgent, non-obvious insight on why the capability gap matters NOW.
This slide is about THEM, not about AWS. It proves we did our homework.

── SLIDE 2 — "OUR PRESCRIPTIVE APPROACH: HOW WE HELP YOU" (this is where you MUST be specific and prescriptive) ──
This slide answers, concretely: "What would we actually DO with you, based on our lessons learned?" It is NOT a vague 'capability program.' You MUST name and describe the ACTUAL AWS T&C mechanisms from your expert playbook, tailored to THIS customer's situation. Draw specifically from:
  • THE SKILLS GUILD — describe what a Guild looks like for them (the Excitement → Enablement → Advocacy model; a coalition of internal champions; office hours; a community that sustains adoption beyond training). Say concretely what it is and does for their teams.
  • THE PROGRAM STRUCTURE — the three-tier curriculum (Foundation → Applied → Embedded) and the learning-audience segments (Executive, Manager, Enterprise-foundation, Role/Practitioner, Advanced/Builder + reinforcement). Map it to THEIR real roles (e.g. their platform-engineering team, their data team, their frontline).
  • ROLE-BASED LEARNING PATHS — name relevant paths (e.g. AI Practitioner → ML Engineer → Gen AI Developer) tied to their actual roles, not generic literacy.
  • MANAGER ACTIVATION — because training doesn't stick without it (88% of managers at AI-mature orgs role-model AI vs 25% at laggards).
  • PERFORMANCE-BASED CREDENTIALS — the stackable micro-credential ladder that proves capability (work-product credentials, manager/peer validation), not completion certificates.
  • THE MEASUREMENT CHAIN — Capability → Adoption → Workflow → Business outcome, with a 90-180 day proof point / phased pilot.
  • THE RETURN — connect to a measurable ROI the executive cares about, citing a relevant proof point (AWS enterprise programs: 234% ROI, 65% pilot-to-production, 85% participation; Forrester 229% ROI; BCG: AI leaders have 13x more AI-skilled workers). Cite the ONE that fits.
Pick the 3-5 of these that fit THIS customer best and make each bullet concrete and prescriptive.

── SLIDE 3 — "WHAT WE DO NEXT + THE RETURN" (Now + Next Steps + Key Asks) ──
The action slide that turns the approach into momentum. Draw directly from the analysis' Now, Next Steps and Key Asks:
  • The immediate focus and the first concrete moves (a phased pilot / first mission with a 90-180 day proof point) — from Now initiatives and Next Steps.
  • The specific asks/commitments to secure from the customer (sponsorship, access, the first workflow to baseline) — from Key Asks.
  • The measurable RETURN framed to what these executives care about, citing the ONE most relevant proof point (AWS enterprise programs: 234% ROI, 65% pilot-to-production, 85% participation; Forrester 229% ROI; BCG: AI leaders have 13x more AI-skilled workers).
  • Footer = the single clear call to action / the ask that closes the meeting.
If there is not enough distinct material for a strong third slide, fold this into Slide 2 and produce 2 slides — never pad.

FORMAT:
- Produce 2 OR 3 slides (prefer 3 when the analysis is rich). Never more than 3, never fewer than 2.
- Each slide: a sharp TITLE (max ~8 words), a one-line SUBTITLE, 3-5 bullets (board-ready, concrete — prescriptive on slides 2 and 3), and a FOOTER (proof point or the call to action).
- NEVER invent people, numbers, or company facts not present in the provided analysis/data. The proof-point statistics and the T&C mechanisms above are YOUR expert knowledge and SHOULD be used. Never claim someone attends unless listed as a confirmed attendee.

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
${docs.length > 0 ? `\nUPLOADED DOCUMENTS (drivers, trends, executive intelligence):\n${docs.map((d: any) => `--- ${d.name} ---\n${String(d.text || '').slice(0, 4000)}`).join('\n\n')}` : ''}`;

    const userMessage = `Create a 3-slide C-LEVEL pitch (2 if there truly isn't enough material for 3) for the conversation with ${accountData.customer_name || 'this customer'}. This IS the pitch we will present. Make it unmistakably about ${accountData.customer_name || 'this company'} (never generic). Leverage EVERY section of the analysis below — Approach, Buzz, Now, Next Steps, Key Asks — do not drop any.

SLIDE 1 = WHAT WE KNOW ABOUT THEM (from Approach + Buzz): their specific business, competitive dynamics (named competitors/market), their real teams and named executives, the internal opportunities/priorities, the Buzz signals (hiring, sentiment), and the non-obvious insight on why their capability gap matters now.

SLIDE 2 = OUR PRESCRIPTIVE APPROACH: concretely, what we would DO with them based on our lessons learned — name the actual mechanisms (what their Skills Guild looks like, the Foundation→Applied→Embedded program mapped to their real roles, role-based learning paths, manager activation, performance-based credentials, the Capability→Adoption→Workflow→Business measurement chain). Prescriptive and specific, NOT vague.

SLIDE 3 = WHAT WE DO NEXT + THE RETURN (from Now + Next Steps + Key Asks): the phased first mission with a 90-180 day proof point, the specific asks/commitments to secure, and the measurable ROI. End on the clear ask.

${context}`;

    const result = await invokeClaudeJSON<SlidesResponse>(
      SYSTEM_PROMPT,
      [{ role: 'user', content: userMessage }],
      { maxTokens: 2200, temperature: 0.5 }
    );

    // Hard guarantee: never more than 3 slides, always at least 1 with bullets.
    const slides = Array.isArray(result?.slides) ? result.slides.slice(0, 3) : [];
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
