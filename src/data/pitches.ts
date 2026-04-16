import type { Account, Attendee, EngagementPlan } from '../types';

export interface PitchSlide {
  slideNumber: number;
  title: string;
  content: string;
  speakerNotes: string;
  type: 'title' | 'insight' | 'data' | 'story' | 'action' | 'close';
}

export interface Pitch {
  title: string;
  subtitle: string;
  duration: string;
  audience: string;
  slides: PitchSlide[];
}

import type { UserNote } from './agendas';

export function generatePitch(account: Account, persona: Attendee, plan: EngagementPlan, userNotes: UserNote[] = []): Pitch {
  const a = account;
  const isGreenfield = !a.tc_current_state.skill_builder;

  const slides: PitchSlide[] = [
    {
      slideNumber: 1,
      title: `${a.customer_name} × AWS Training & Certification`,
      content: `A strategic partnership for ${a.sfdc_data.account_plan_priority}`,
      speakerNotes: `Open with: "${plan.conversation_starters[0]}" — This grounds the conversation in something ${plan.persona_name} has said or done publicly. It shows we've done our homework and we're here for a strategic conversation, not a sales pitch.`,
      type: 'title'
    },
    {
      slideNumber: 2,
      title: 'The Challenge You\'re Facing',
      content: plan.narrative,
      speakerNotes: `This is the story slide. Read the room — if ${plan.persona_name} is nodding, you've nailed the framing. If not, pause and ask: "Does this resonate with what you're seeing?" The goal is alignment on the problem before we discuss solutions.`,
      type: 'story'
    },
    {
      slideNumber: 3,
      title: 'The Data Behind the Story',
      content: [
        `${a.public_intelligence.linkedin_job_postings.cloud_ai_roles} open cloud/AI roles (${a.public_intelligence.linkedin_job_postings.yoy_change} YoY)`,
        isGreenfield
          ? `${a.tc_current_state.certifications} organic certifications across the organization — no structured program`
          : `${a.tc_current_state.skill_builder_seats} Skill Builder seats at ${a.tc_current_state.activation_rate}% activation`,
        `Industry context: ${a.public_intelligence.industry_context}`,
        `Key signal: "${a.public_intelligence.earnings_call_signals[0]}"`
      ].join('\n\n'),
      speakerNotes: `Let the data speak. Don't editorialize — present the facts and let ${plan.persona_name} draw their own conclusions. If they push back on any data point, that's actually good — it means they're engaged. Use the "disagree and commit" principle: acknowledge their perspective, then redirect to the shared goal.`,
      type: 'data'
    },
    {
      slideNumber: 4,
      title: 'What the Best Organizations Are Doing',
      content: plan.proof_points.map(pp =>
        `${pp.customer} (${pp.industry}): ${pp.metric} — ${pp.demonstrates}`
      ).join('\n\n'),
      speakerNotes: `These proof points are matched to ${plan.persona_name}'s persona (${persona.persona}) and ${a.industry}. Lead with the one most relevant to their specific concern. For a ${persona.persona}, that's typically ${persona.persona === 'CFO' ? 'the Forrester ROI data' : persona.persona === 'CEO' ? 'the Bell Canada revenue impact' : persona.persona === 'CHRO' ? 'the Holcim participation rates' : 'the UNSW skill uplift metrics'}.`,
      type: 'insight'
    },
    {
      slideNumber: 5,
      title: 'Our Recommended Approach',
      content: plan.recommended_plays.map(p =>
        `${p.play_name}: ${p.description}`
      ).join('\n\n'),
      speakerNotes: `Present this as a menu, not a mandate. Use the "two-pizza team" principle — start with a small, focused pilot that can demonstrate value quickly. Ask: "Which of these resonates most with where you are today?" Let ${plan.persona_name} self-select into the approach that fits their context.`,
      type: 'action'
    },
    {
      slideNumber: 6,
      title: 'The Investment & Return',
      content: plan.revenue_estimate.map(r =>
        `${r.offering}: ${r.estimated_value} (${r.timeline})`
      ).join('\n\n') + `\n\nTotal estimated pipeline: ${plan.total_pipeline}`,
      speakerNotes: `Frame this as an investment, not a cost. Reference the Forrester 229% ROI and <6 month payback. For a ${persona.persona}, emphasize ${persona.persona === 'CFO' ? 'the payback period and board-ready ROI data' : persona.persona === 'CEO' ? 'the competitive positioning and transformation acceleration' : persona.persona === 'CHRO' ? 'the retention impact and culture transformation' : 'the time-to-competency reduction and delivery acceleration'}. Use the "two-way door" framing: the pilot is reversible and low-risk.`,
      type: 'data'
    },
    {
      slideNumber: 7,
      title: 'Next Steps',
      content: [
        'Week 1-2: Detailed proposal delivery with custom ROI model',
        'Week 3-4: Technical deep-dive and program design workshop',
        `Week 5-6: Pilot launch with ${isGreenfield ? 'initial Skill Builder deployment' : 'program redesign and activation plan'}`,
        'Week 8: First progress review and expansion planning',
        '',
        `"The best time to start was yesterday. The second best time is today."`,
      ].join('\n'),
      speakerNotes: `End with urgency but not pressure. The timeline should feel ambitious but achievable. Ask for a specific commitment: "Can we schedule the technical deep-dive for next week?" A concrete next step is worth more than a vague "let's stay in touch." Use the Amazon "bias for action" principle — move fast on decisions that are reversible.`,
      type: 'close'
    }
  ];

  // Inject user notes as an additional slide before the close
  if (userNotes.length > 0) {
    const noteContent = userNotes.map(n =>
      `${n.text}${n.url ? ` (Reference: ${n.url})` : ''}`
    ).join('\n\n');
    const noteSlide: PitchSlide = {
      slideNumber: slides.length, // will be before close
      title: 'Additional Discussion Points',
      content: noteContent,
      speakerNotes: `These topics were flagged by the account team as important to address. Weave them into the conversation naturally. If any of these topics resonate strongly with ${plan.persona_name}, spend more time here and adjust the closing accordingly.`,
      type: 'insight'
    };
    // Insert before the last slide (close)
    slides.splice(slides.length - 1, 0, noteSlide);
    // Renumber all slides
    slides.forEach((s, i) => s.slideNumber = i + 1);
  }

  return {
    title: `T&C Engagement Pitch: ${plan.persona_name}`,
    subtitle: `${plan.persona_title} · ${a.customer_name}`,
    duration: '20-25 minutes',
    audience: `${plan.persona_name} (${plan.persona_title}) and supporting team`,
    slides
  };
}
