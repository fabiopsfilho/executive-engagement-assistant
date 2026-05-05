import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  PageBreak
} from 'docx';
import fs from 'fs';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function heading(text, level = HeadingLevel.HEADING_1) {
  return new Paragraph({ heading: level, spacing: { before: 300, after: 120 }, children: [new TextRun({ text, bold: true })] });
}
function para(text, opts = {}) {
  return new Paragraph({ spacing: { after: 140 }, children: [new TextRun({ text, size: 22, ...opts })] });
}
function richPara(runs) {
  return new Paragraph({ spacing: { after: 140 }, children: runs });
}
function bold(text) { return new TextRun({ text, bold: true, size: 22 }); }
function normal(text) { return new TextRun({ text, size: 22 }); }
function italic(text) { return new TextRun({ text, italics: true, size: 22 }); }
function bullet(text, level = 0) {
  return new Paragraph({ bullet: { level }, spacing: { after: 80 }, children: [new TextRun({ text, size: 22 })] });
}
function richBullet(runs, level = 0) {
  return new Paragraph({ bullet: { level }, spacing: { after: 80 }, children: runs });
}
function spacer() { return new Paragraph({ spacing: { after: 200 }, children: [] }); }

// ─── Document ─────────────────────────────────────────────────────────────────
const doc = new Document({
  styles: { default: { document: { run: { font: 'Amazon Ember', size: 22 } } } },
  sections: [{
    properties: { page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } },
    children: [

      // ═══════════════════════════════════════════════════════════════════════
      // TITLE
      // ═══════════════════════════════════════════════════════════════════════
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [
        new TextRun({ text: 'AWS Training & Certification', size: 20, color: '666666' })
      ]}),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [
        new TextRun({ text: 'Executive Engagement Assistant', bold: true, size: 36 })
      ]}),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 400 }, children: [
        new TextRun({ text: 'Two-Page Narrative — Positioning T&C in Executive Engagements & Supporting AWS Field Sales', size: 20, italics: true, color: '555555' })
      ]}),

      // ═══════════════════════════════════════════════════════════════════════
      // PAGE 1
      // ═══════════════════════════════════════════════════════════════════════
      heading('The Problem', HeadingLevel.HEADING_1),

      para('AWS Training & Certification has a positioning problem at the executive level — not a product problem. T&C offerings (Skill Builder, Skills Guild, Private Training, Certifications) are powerful workforce accelerators, but they consistently get positioned as "training products" rather than as strategic enablers of the customer\'s cloud transformation. This happens because the field — Account Managers, ISRs, and T&C BDMs — lacks the preparation infrastructure to connect T&C to what each executive persona actually cares about.'),
      spacer(),
      para('Today, preparing for a single executive engagement requires 3-5 hours of manual research across disconnected systems: Salesforce for pipeline and account plans, LinkedIn for hiring signals and executive social activity, earnings call transcripts for strategic priorities, Glassdoor for employee sentiment, EBC schedules for logistics, and internal T&C data for subscription state and renewal timelines. Most sellers skip this work entirely. The result:'),
      spacer(),

      richBullet([bold('T&C gets left out of executive conversations. '), normal('Account Managers don\'t know how to position workforce development alongside infrastructure, migration, or AI workloads. T&C becomes an afterthought — mentioned in passing or delegated to L&D teams with no budget authority.')]),
      richBullet([bold('Persona-specific value is never articulated. '), normal('A CFO needs to hear "229% ROI, payback in under 6 months, and a multiplier on your $200M PPA." A CHRO needs to hear "85% participation, retention impact, and a program that makes you the internal champion." A CTO needs to hear "70% skill uplift, 40-60% faster time-to-competency, and delivery acceleration on your migration timeline." Instead, everyone hears "Skill Builder seats."')]),
      richBullet([bold('Signals go undetected. '), normal('A CEO keynotes at Davos about AI being a generational bet. A CHRO commits $50M to employee development on LinkedIn. Glassdoor reviews reveal engineers frustrated by lack of cloud training. These are buying signals — but no system connects them to the T&C opportunity or tells the seller what to do with them.')]),
      richBullet([bold('Pipeline stays invisible. '), normal('T&C revenue opportunities worth $1M-$6M per STRAT account remain buried because sellers lack the confidence, context, and content to surface them. The bottleneck is not customer demand — it is seller preparation.')]),
      spacer(),
      para('The field needs a tool that does the research, makes the connections, generates the content, and builds the confidence — so that T&C shows up in every executive engagement as a strategic accelerator, not a product footnote.'),

      // ── SOLUTION ──
      heading('The Solution', HeadingLevel.HEADING_1),

      para('The Executive Engagement Assistant is an AI-powered preparation and coaching platform that positions AWS Training & Certification as a strategic pillar of every executive engagement. It works backwards from two customers simultaneously: the AWS seller who needs confidence and content, and the end-customer executive who needs to hear why workforce development is the multiplier that makes their cloud investment pay off.'),
      spacer(),
      para('The platform serves two distinct use cases:'),
      spacer(),

      heading('Use Case 1: Positioning T&C in Executive Engagements', HeadingLevel.HEADING_2),
      para('For any account with an upcoming EBC, executive visioning session, or C-level meeting, the tool generates persona-specific T&C positioning:'),
      spacer(),

      richBullet([bold('Intelligent Signal Detection — '), normal('Automatically identifies HIGH-severity buying signals: Talent War (hiring velocity exceeding market capacity), Board Pressure (earnings call references to workforce readiness), Greenfield T&C (no structured engagement despite massive cloud investment), Compliance Triggers (EU AI Act, regulatory requirements), Subscription Underperformance (low activation on existing seats). Each signal maps directly to a T&C conversation angle.')]),
      richBullet([bold('Persona-Specific Narratives — '), normal('For each executive (CEO, CFO, CTO/CIO, CHRO), generates a tailored story explaining why T&C matters to them specifically — grounded in their own public statements, their company\'s hiring data, and their industry context. Not "training is important" but "Jennifer, your $50M employee development commitment and 89 unfilled cloud roles mean you need a build strategy, not a buy strategy — and here\'s the proof it works."')]),
      richBullet([bold('Conversation Starters & Proof Points — '), normal('2-3 opening lines per persona, each traceable to a specific data source (earnings call quote, LinkedIn post, Glassdoor signal). Matched proof points: Bell Canada (67% cloud sales increase) for CEOs, Forrester TEI (229% ROI) for CFOs, UNSW (70% skill uplift) for CTOs, Holcim (85% participation) for CHROs.')]),
      richBullet([bold('Revenue Estimation — '), normal('Offering-by-offering pipeline with timelines: Learning Needs Assessment, Skill Builder subscriptions, Skills Guild, Private Training, Certification Programs. Total pipeline estimates range from $300K to $6M per account depending on size and engagement state.')]),
      spacer(),

      heading('Use Case 2: Supporting the AWS Field Sales Team\'s Executive Engagement Approach', HeadingLevel.HEADING_2),
      para('Beyond T&C positioning, the tool serves as a comprehensive executive engagement preparation platform for the broader AWS field:'),
      spacer(),

      richBullet([bold('AI Coaching & Role-Play — '), normal('Sellers practice conversations with an AI that responds in-character as the target executive. The CFO pushes back on ROI assumptions. The CEO wants competitive context. The CTO demands technical credibility. Each exchange includes coaching tips: "They\'re engaged — address the \'what\'s different\' question with program design specifics, not product features."')]),
      richBullet([bold('Dynamic Agenda Generation — '), normal('Two formats: a half-day EBC strategic session (grounded in Amazon Leadership Principles: Customer Obsession, Working Backwards, Earn Trust, Bias for Action) and a 1-hour Training Strategy Session covering both non-technical and technical role approaches. Both include preparation checklists and are exportable as formatted HTML.')]),
      richBullet([bold('Exportable Pitch Decks — '), normal('7-slide narrative decks per persona with speaker notes. Title → Challenge → Data → Proof Points → Recommended Approach → Investment & Return → Next Steps. Each slide includes persona-specific coaching guidance.')]),
      richBullet([bold('Connected Intelligence Architecture — '), normal('Every recommendation includes a traceable "Connection Toggle" showing which data source drove it (LinkedIn hiring data, Glassdoor sentiment, earnings call quote, Salesforce pipeline). This builds seller confidence: they know exactly why they\'re saying what they\'re saying.')]),
      richBullet([bold('Objection Handling Library — '), normal('Pre-built responses to the five most common executive objections: "No time for training," "We can hire the skills," "Training hasn\'t worked before," "Show me ROI first," "We\'re not ready yet." Each response is customized to the specific account\'s data.')]),
      richBullet([bold('Opportunity Scoring & Prioritization — '), normal('A weighted 1-10 score across five dimensions (Talent Signals 25%, Business Signals 25%, Training State 20%, Engagement Timing 15%, Public Intelligence 15%) helps BDMs prioritize which accounts to engage first. Fully explainable — sellers tap any score to see the underlying data.')]),

      // PAGE BREAK
      new Paragraph({ children: [new PageBreak()] }),

      // ═══════════════════════════════════════════════════════════════════════
      // PAGE 2
      // ═══════════════════════════════════════════════════════════════════════
      heading('Customer Experience', HeadingLevel.HEADING_1),
      spacer(),

      richPara([italic('Scenario: T&C BDM preparing for a STRAT account EBC')]),
      spacer(),
      para('Maria is a T&C BDM covering Financial Services. She has an EBC next Thursday with Oceanic Capital Corporation — a $42M STRAT account with a 5-year/$200M PPA. Six C-level executives are attending. The Account Manager invited her but warned: "You\'ll have 10 minutes max to talk about training — the agenda is packed with migration and AI workloads."'),
      spacer(),
      para('Maria opens the Executive Engagement Assistant. She selects Oceanic Capital. In seconds:'),
      spacer(),

      richPara([normal('The '), bold('Opportunity Score'), normal(' reads 9.2/10. She taps it — the explainer shows why: 89 open cloud/AI roles growing 156% YoY, $42M spend with a $200M PPA, zero structured T&C engagement across 15,000 employees, EBC in 6 days, and rich public intelligence (CEO keynoted at Davos, CHRO posted about $50M people investment, CTO writing about cloud-native team challenges).')]),
      spacer(),
      richPara([normal('Four '), bold('HIGH signals'), normal(' flash: Talent War, Board Pressure, Greenfield T&C, Compliance Trigger. The system tells her: "This is not a 10-minute training conversation. This is a workforce transformation conversation that belongs in the strategic agenda."')]),
      spacer(),
      richPara([normal('She selects the '), bold('CHRO persona'), normal(' (Jennifer Williams). The system generates: a narrative connecting Jennifer\'s $50M commitment to the 89-role gap; a conversation starter referencing Jennifer\'s own LinkedIn post; recommended plays (Learning Needs Assessment → Skills Guild → Skill Builder pilot → Certification Program); and a pipeline estimate of $1.63M–$5.85M.')]),
      spacer(),
      richPara([normal('She taps '), bold('Practice'), normal('. The AI responds as Jennifer: '), italic('"You\'re speaking my language. But I need a program, not just a platform. What does success look like in 90 days?"'), normal(' Coaching tip: "Give her ammunition for internal advocacy. Define clear 90-day metrics."')]),
      spacer(),
      para('She then selects the CEO persona (Sarah Chen). Different narrative, different starters, different proof points. The system references Sarah\'s Davos keynote and positions T&C as the workforce engine that makes the $2B migration bet pay off.'),
      spacer(),
      para('Maria exports the agenda — a half-day plan that weaves T&C into the strategic conversation rather than isolating it in a product slot. She exports persona-specific pitch decks for Jennifer and Sarah. She shares the Account Story with the Account Manager, who realizes T&C should be a 45-minute strategic block, not a 10-minute afterthought.'),
      spacer(),
      para('Total preparation: 15 minutes. Maria walks in with six persona-specific talking points, practiced objection handling, exportable materials, and a clear revenue target.'),

      // ── FAQ ──
      heading('Frequently Asked Questions', HeadingLevel.HEADING_1),
      spacer(),

      richPara([italic('Q: How does this help Account Managers who don\'t own the T&C relationship?')]),
      para('The tool generates an "Account Story" view that shows AMs why T&C belongs in their executive conversations — with specific signals, revenue estimates, and talking points they can use without being T&C experts. It reframes training from "something the BDM handles" to "a strategic accelerator that strengthens my account plan." The AM can share the Account Story with the BDM or use it directly.'),
      spacer(),

      richPara([italic('Q: How does this connect to the existing EBC process?')]),
      para('It plugs into the EBC workflow at the preparation stage. When an EBC is scheduled, the tool pulls attendees, themes, and dates, then generates persona-specific engagement plans for each executive in the room. The agenda generator produces Leadership Principle-grounded session plans that the EBC team can adopt directly. It does not replace the EBC process — it makes the T&C component of every EBC dramatically stronger.'),
      spacer(),

      richPara([italic('Q: Where does the data come from?')]),
      para('Zero new data entry. Salesforce (opportunities, account plans, T2K status, SMGS phase), EBC schedules (dates, themes, attendees), public intelligence (earnings calls, LinkedIn job postings and executive activity, Glassdoor reviews, industry news), and T&C subscription state (seats, activation, certifications, renewals). The seller\'s only input is selecting an account and persona.'),
      spacer(),

      richPara([italic('Q: Does the AI replace seller judgment?')]),
      para('No. Every recommendation includes a Connection Toggle showing exactly which data point drove it. Sellers validate, adapt, or override. The role-play provides coaching feedback but never prescribes a single answer. The system accelerates preparation and surfaces signals — the seller owns the relationship.'),
      spacer(),

      richPara([italic('Q: What is the expected impact?')]),
      para('70-80% reduction in preparation time (3-5 hours → 15 minutes). 2-3x increase in T&C pipeline surfaced per executive engagement. 30-40% improvement in EBC-to-qualified-opportunity conversion. For a BDM covering 20 STRAT accounts, that translates to 15-25 additional qualified T&C opportunities per year that would otherwise stay invisible inside broader cloud deals.'),
      spacer(),

      richPara([italic('Q: What personas does it support?')]),
      para('CEO (competitive positioning, transformation vision, board readiness), CFO (ROI, payback period, build vs. buy economics), CTO/CIO (delivery acceleration, time-to-competency, technical credibility), CHRO (retention, participation, culture transformation, talent strategy), and functional leaders (domain-specific relevance). Each persona gets differentiated narratives, conversation starters, proof points, recommended plays, and coaching guidance.'),
      spacer(),

      richPara([italic('Q: What are the tenets?')]),
      para('(1) Work backwards from the executive, not the product catalog. (2) Every recommendation must be traceable to a data source. (3) Confidence comes from practice, not just information. (4) The seller owns the relationship — the tool accelerates, never replaces. (5) Start with the customer\'s own words. (6) T&C is a strategic accelerator, not a product line — position it accordingly.'),

    ]
  }]
});

// ─── Write ────────────────────────────────────────────────────────────────────
const buffer = await Packer.toBuffer(doc);
fs.writeFileSync('Executive_Engagement_Assistant_2x2_Narrative.docx', buffer);
console.log('✅ Created: Executive_Engagement_Assistant_2x2_Narrative.docx');
