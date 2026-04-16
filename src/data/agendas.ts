import type { Account } from '../types';

export interface AgendaBlock {
  time: string;
  duration: string;
  title: string;
  description: string;
  connectedTo?: string;
  owner: string;
  type: 'welcome' | 'discovery' | 'insight' | 'demo' | 'workshop' | 'action' | 'break';
}

export interface Agenda {
  title: string;
  subtitle: string;
  format: string;
  location: string;
  date: string;
  principles: string[];
  blocks: AgendaBlock[];
  preparation_notes: string[];
}

export interface UserNote {
  text: string;
  url?: string;
}

/** Full EBC engagement agenda — half-day strategic session */
export function generateAgenda(account: Account, userNotes: UserNote[] = []): Agenda {
  const a = account;
  const hasRenewal = !!a.tc_current_state.renewal_date;
  const highSignals = a.signals.filter(s => s.severity === 'HIGH');

  const blocks: AgendaBlock[] = [
    {
      time: '9:00 AM', duration: '15 min', title: 'Welcome & Alignment',
      description: `Set the tone: this is a strategic conversation about ${a.customer_name}'s future, not a product pitch. ${a.public_intelligence.executive_social[0] ? `Reference ${a.public_intelligence.executive_social[0].name}'s recent post about "${a.public_intelligence.executive_social[0].post_theme}" to show we've done our homework.` : `Reference the customer's own words from earnings calls and public commitments.`} ${a.public_intelligence.news_signals[0] ? `Acknowledge recent news: ${a.public_intelligence.news_signals[0]}.` : ''} ${a.public_intelligence.industry_context ? `Frame within industry context: ${a.public_intelligence.industry_context}.` : ''}`,
      connectedTo: `🔗 Buzz: ${a.public_intelligence.executive_social[0] ? `${a.public_intelligence.executive_social[0].name}'s LinkedIn post on "${a.public_intelligence.executive_social[0].post_theme}"` : 'Executive social signals'}. Now: Opening with customer's own words builds trust.`,
      owner: 'AWS Account Team', type: 'welcome'
    },
    {
      time: '9:15 AM', duration: '30 min', title: 'Customer Vision & Priorities — Working Backwards',
      description: `Start with the customer's press release. Ask: "If we fast-forward 18 months and ${a.customer_name} has succeeded in ${a.sfdc_data.account_plan_priority}, what does that look like? What had to be true about your workforce to get there?" Let the customer paint the picture.`,
      connectedTo: `🔗 Now: Strategic priority is "${a.sfdc_data.account_plan_priority}" — this is the initiative to focus on. Trend: ${a.public_intelligence.industry_context.split(';')[0]}.`,
      owner: `${a.customer_name} Leadership`, type: 'discovery'
    },
    {
      time: '9:45 AM', duration: '25 min', title: 'The Workforce Intelligence Briefing',
      description: `Present the data story: ${a.public_intelligence.linkedin_job_postings.cloud_ai_roles} open cloud/AI roles (${a.public_intelligence.linkedin_job_postings.yoy_change} YoY). Connect to industry context: ${a.public_intelligence.industry_context}. Frame as a shared challenge using the "Day 1" mindset.`,
      connectedTo: `🔗 Buzz: LinkedIn shows ${a.public_intelligence.linkedin_job_postings.cloud_ai_roles} open roles (${a.public_intelligence.linkedin_job_postings.yoy_change} YoY). Glassdoor: "${a.public_intelligence.glassdoor_signals[0] || 'employee sentiment data'}". Trend: ${a.public_intelligence.industry_context.split(';')[0]}.`,
      owner: 'AWS T&C Team', type: 'insight'
    },
    { time: '10:10 AM', duration: '15 min', title: 'Break & Informal Networking', description: 'Use for 1:1 conversations. AWS team should split up and engage different customer executives.', owner: 'All', type: 'break' },
  ];

  const talentWar = highSignals.find(s => s.label.includes('Talent'));
  const compliance = highSignals.find(s => s.label.includes('Compliance') || s.label.includes('AI Act'));

  if (talentWar) {
    blocks.push({ time: '10:25 AM', duration: '25 min', title: 'Build vs. Buy: The Talent Economics Deep Dive',
      description: `Present the build vs. buy analysis specific to ${a.industry}. External hiring costs 40-60% more than internal development. Forrester TEI: 229% ROI, payback in under 6 months. Reference Bell Canada (67% cloud sales increase) and Holcim (85% participation).`,
      connectedTo: `🔗 Buzz: ${a.public_intelligence.linkedin_job_postings.cloud_ai_roles} open roles growing ${a.public_intelligence.linkedin_job_postings.yoy_change} YoY proves they can't hire fast enough. Now: Talent War is a HIGH signal — ${talentWar.evidence.split(';')[0]}.`,
      owner: 'AWS T&C BDM', type: 'insight' });
  }
  if (compliance) {
    blocks.push({ time: talentWar ? '10:50 AM' : '10:25 AM', duration: '20 min', title: 'Compliance as a Catalyst',
      description: `Frame regulatory requirements as an accelerator. ${compliance.evidence}. Show how structured programs create documentation and audit trails. Position workforce competency as competitive advantage.`,
      connectedTo: `🔗 Now: Compliance is a HIGH signal. Trend: ${a.public_intelligence.news_signals.find(s => s.toLowerCase().includes('compliance') || s.toLowerCase().includes('regulation') || s.toLowerCase().includes('ai act')) || a.public_intelligence.industry_context.split(';')[0]}.`,
      owner: 'AWS T&C Specialist', type: 'insight' });
  }

  blocks.push(
    { time: '11:15 AM', duration: '30 min', title: 'The Art of the Possible', description: `Walk through the AWS T&C portfolio mapped to ${a.customer_name}'s needs. Podium catalog highlights: role-based learning paths, hands-on labs, certification programs, private training, and enterprise programs. "Two-pizza team" principle — start small, prove value, scale.`, owner: 'AWS T&C Team', type: 'demo' },
    { time: '11:45 AM', duration: '30 min', title: 'Working Backwards Workshop', description: `Collaborative session. "What does a fully cloud-capable ${a.customer_name} workforce look like in 18 months?" Work backwards: which roles, which skills, how to measure, first 90 days. "Write the press release first."`, owner: 'Joint Session', type: 'workshop' },
    { time: '12:15 PM', duration: '15 min', title: 'Investment Framework', description: `Phased approach: pilot → measure → expand. "Two-way door" framing — reversible, low-risk, high-signal. Make it easy to say yes.`, owner: 'AWS T&C BDM', type: 'insight' },
    { time: '12:30 PM', duration: '15 min', title: 'Commitments & Next Steps', description: `Clear commitments from both sides. AWS: detailed proposal in 2 weeks, technical deep-dive, custom ROI model. Customer: pilot team, executive sponsor, learning time. "Disagree and commit" — move fast.`, owner: 'AWS Account Lead', type: 'action' },
    { time: '12:45 PM', duration: '45 min', title: 'Working Lunch', description: 'Continue the conversation in a relaxed setting. Focus on culture, challenges, and aspirations beyond the immediate engagement.', owner: 'All', type: 'break' }
  );

  // Inject user notes as additional agenda topics
  if (userNotes.length > 0) {
    const noteTopics = userNotes.map(n => n.text).join('; ');
    const noteUrls = userNotes.filter(n => n.url).map(n => n.url).join(', ');
    const insertIdx = blocks.findIndex(b => b.title.includes('Commitments'));
    const noteBlock: AgendaBlock = {
      time: '12:25 PM', duration: '10 min',
      title: 'Additional Topics & Discussion',
      description: `Address the following topics raised by the account team: ${noteTopics}.${noteUrls ? ` Reference materials: ${noteUrls}.` : ''} Weave these into the conversation naturally to deepen the discussion or address specific customer concerns.`,
      connectedTo: `🔗 Added by account team. ${userNotes.map(n => `Topic: "${n.text}"${n.url ? ` (linked to: ${n.url})` : ''}`).join('. ')}`,
      owner: 'AWS Account Team', type: 'discovery'
    };
    if (insertIdx >= 0) blocks.splice(insertIdx, 0, noteBlock);
    else blocks.splice(blocks.length - 1, 0, noteBlock);
  }

  const prepNotes = [
    `Review all public intelligence for ${a.customer_name}`,
    `Prepare custom workforce gap analysis visualizations`,
    `Pre-brief all AWS attendees on: ${a.sfdc_data.account_plan_priority}`,
    `Prepare leave-behind materials tailored to each persona`,
    hasRenewal ? `CRITICAL: Renewal on ${a.tc_current_state.renewal_date} — prepare expansion proposal` : `Prepare greenfield phased investment approach`,
    `Coordinate with ${a.ebc_data.requestor} on logistics`,
    ...userNotes.map(n => `ADDED TOPIC: ${n.text}${n.url ? ` (ref: ${n.url})` : ''}`)
  ];

  return {
    title: `EBC Engagement Plan: ${a.customer_name}`,
    subtitle: `T&C Strategic Engagement — ${a.ebc_data.themes[0]}`,
    format: 'Half-Day Executive Business Council',
    location: a.ebc_data.location,
    date: a.ebc_data.meeting_dates[0],
    principles: [
      'Customer Obsession — Start with the customer\'s vision, not our products',
      'Working Backwards — Define success first, then design the path',
      'Bias for Action — Leave with specific commitments',
      'Earn Trust — Be transparent about data, including uncomfortable truths',
      'Think Big — Paint the enterprise-wide vision, start with a pilot',
      'Dive Deep — Use specific data points, not generalizations'
    ],
    blocks,
    preparation_notes: prepNotes
  };
}


/** 1-hour training session agenda — no products, focused on best approach for the customer */
export function generateTrainingSessionAgenda(account: Account, userNotes: UserNote[] = []): Agenda {
  const a = account;
  const isGreenfield = !a.tc_current_state.skill_builder;

  const blocks: AgendaBlock[] = [
    {
      time: '0:00', duration: '5 min', title: 'Welcome & Framing',
      description: `Set expectations: this is not a product session. This is a conversation about ${a.customer_name}'s workforce strategy. ${a.public_intelligence.executive_social[0] ? `Reference ${a.public_intelligence.executive_social[0].name}'s recent thoughts on "${a.public_intelligence.executive_social[0].post_theme}".` : ''} ${a.public_intelligence.news_signals[0] ? `Acknowledge: ${a.public_intelligence.news_signals[0]}.` : ''} Strategic priority: ${a.sfdc_data.account_plan_priority}. ${a.public_intelligence.glassdoor_signals[0] ? `Employee insight to address: "${a.public_intelligence.glassdoor_signals[0]}".` : ''}`,
      connectedTo: `🔗 Buzz: ${a.public_intelligence.executive_social[0] ? `${a.public_intelligence.executive_social[0].name} on "${a.public_intelligence.executive_social[0].post_theme}"` : 'Executive signals'}. Glassdoor: "${a.public_intelligence.glassdoor_signals[0] || 'employee sentiment'}".`,
      owner: 'AWS T&C Lead', type: 'welcome'
    },
    {
      time: '0:05', duration: '10 min', title: 'The Workforce Landscape',
      description: `Share the intelligence: ${a.public_intelligence.linkedin_job_postings.cloud_ai_roles} open cloud/AI roles (${a.public_intelligence.linkedin_job_postings.yoy_change} YoY), industry context (${a.public_intelligence.industry_context}). Frame the build vs. buy reality: external hiring costs 40-60% more and takes 3-6x longer. The question isn't whether to invest in workforce development — it's how to do it strategically.`,
      connectedTo: `🔗 Buzz: LinkedIn hiring data (${a.public_intelligence.linkedin_job_postings.cloud_ai_roles} roles, ${a.public_intelligence.linkedin_job_postings.yoy_change} YoY). Trend: ${a.public_intelligence.industry_context.split(';')[0]}. Now: This is the core data story.`,
      owner: 'AWS T&C Lead', type: 'insight'
    },
    {
      time: '0:15', duration: '15 min', title: 'Best Approach: Non-Technical Roles',
      description: `For executives, business analysts, project managers, and non-technical staff: the goal is cloud fluency, not deep technical skills. Recommended path: (1) Executive AI Literacy for C-suite and board — builds governance confidence and strategic vocabulary. (2) Cloud Practitioner foundations for all business roles — creates a shared language across the organization. (3) Role-specific awareness tracks: data literacy for business analysts, cloud economics for finance teams, AI governance for compliance. The key insight: non-technical roles drive adoption. If business leaders don't understand the cloud, technical teams can't move fast enough.`,
      connectedTo: `🔗 Now: Non-technical roles drive adoption — this connects to the executive sponsor ask. Buzz: ${a.public_intelligence.earnings_call_signals[0] ? `Earnings: "${a.public_intelligence.earnings_call_signals[0].split(': ')[1] || a.public_intelligence.earnings_call_signals[0]}"` : 'Leadership signals'}.`,
      owner: 'AWS T&C Lead', type: 'insight'
    },
    {
      time: '0:30', duration: '15 min', title: 'Best Approach: Technical Roles',
      description: `For engineers, architects, data scientists, and technical staff: the goal is deep capability aligned to ${a.sfdc_data.account_plan_priority}. Recommended path: (1) Role-based learning tracks mapped to the transformation workstreams — not generic training, but skills tied to the actual work. (2) Hands-on labs and sandbox environments — engineers learn by building, not by watching. (3) Certification milestones as career accelerators — Solutions Architect, Security Specialty, ML Specialty aligned to the roles ${a.customer_name} needs most. (4) Peer learning and community — internal champions who drive adoption from within. The key insight: structured programs deliver 70% skill uplift vs. ad-hoc learning. Time-to-competency drops 40-60%.`,
      connectedTo: `🔗 Buzz: ${a.public_intelligence.linkedin_job_postings.cloud_ai_roles} open technical roles. Glassdoor: "${a.public_intelligence.glassdoor_signals.find(s => s.toLowerCase().includes('skill') || s.toLowerCase().includes('training') || s.toLowerCase().includes('development')) || a.public_intelligence.glassdoor_signals[0] || 'employee feedback'}". Now: Technical capability is the bottleneck for ${a.sfdc_data.account_plan_priority}.`,
      owner: 'AWS T&C Lead', type: 'insight'
    },
    {
      time: '0:45', duration: '10 min', title: 'Connecting the Dots: The Engagement Model',
      description: `How we work together going forward: (1) Start with a Learning Needs Assessment — map the skills gap across the organization against ${a.customer_name}'s transformation goals. (2) Design role-based tracks for both non-technical and technical populations. (3) Launch a pilot with a focused team — measure activation, skill uplift, and business impact. (4) Scale based on results. ${isGreenfield ? 'For a greenfield engagement, the first 90 days are about building the foundation and proving the model.' : 'For an existing engagement, the first step is understanding what\'s working, what\'s not, and redesigning the program for maximum impact.'} The goal is a long-term partnership, not a transaction.`,
      owner: 'AWS T&C Lead', type: 'action'
    },
    {
      time: '0:55', duration: '5 min', title: 'Next Steps & Follow-Up',
      description: `Agree on concrete next steps: (1) Schedule a Learning Needs Assessment within 2 weeks. (2) Identify the pilot team and executive sponsor. (3) AWS delivers a tailored engagement proposal within 10 business days. Keep it simple, keep it moving. The best programs start with a single committed team and grow from there.`,
      owner: 'AWS T&C Lead', type: 'action'
    }
  ];

  // Build training-specific preparation notes
  const prepNotes = [
    `Review ${a.customer_name}'s organizational structure and key roles`,
    `Map their transformation priorities to specific skill domains`,
    `Prepare examples from similar ${a.industry} organizations`,
    `Identify the 3-5 most critical role types for their transformation`,
    `Prepare a draft Learning Needs Assessment scope`,
  ];

  // Add Skill Builder traction data if they're an existing customer
  if (a.tc_current_state.skill_builder) {
    prepNotes.push(
      `TRAINING TRACTION: Review Skill Builder usage data — ${a.tc_current_state.skill_builder_seats} seats with ${a.tc_current_state.activation_rate}% activation rate. Identify which teams are actively using it and which are not. Understand the root causes of low adoption (Glassdoor insight: "${a.public_intelligence.glassdoor_signals[0] || 'no data'}").`,
      `SKILL BUILDER ANALYSIS: Pull the most-searched and most-used training paths. Identify gaps between what teams are searching for vs. what they're completing. This reveals unmet demand and program design opportunities.`,
      `ACTIVATION STRATEGY: Prepare a remediation plan for the ${100 - a.tc_current_state.activation_rate}% of seats not being used — dedicated learning time, manager dashboards, milestone-based progression. Show what 80%+ activation looks like with structured programs.`
    );
  } else {
    prepNotes.push(
      `GREENFIELD PREP: No existing training data available. Prepare industry benchmarks for ${a.industry} organizations at similar scale. Show what peer companies are doing with structured training programs.`,
      `TRAINING SEARCH SIGNALS: Reference the ${a.public_intelligence.linkedin_job_postings.cloud_ai_roles} open cloud/AI roles as a proxy for skills demand. Map these roles to recommended training paths.`
    );
  }

  // Always add certification data
  prepNotes.push(
    `CERTIFICATION STATUS: ${a.tc_current_state.certifications} certifications to date (${a.tc_current_state.skill_builder ? 'with existing subscription' : 'organic, no structured program'}). Identify which certification paths align with their ${a.sfdc_data.account_plan_priority} priorities.`
  );

  // Inject user notes into the agenda
  if (userNotes.length > 0) {
    const noteTopics = userNotes.map(n => n.text).join('; ');
    const noteUrls = userNotes.filter(n => n.url).map(n => n.url).join(', ');
    const insertIdx = blocks.findIndex(b => b.title.includes('Next Steps'));
    const noteBlock: AgendaBlock = {
      time: '0:50', duration: '5 min',
      title: 'Additional Topics',
      description: `Address the following topics: ${noteTopics}.${noteUrls ? ` Reference materials: ${noteUrls}.` : ''} Integrate these naturally into the workforce strategy discussion.`,
      owner: 'AWS T&C Lead', type: 'discovery'
    };
    if (insertIdx >= 0) blocks.splice(insertIdx, 0, noteBlock);
    else blocks.splice(blocks.length - 1, 0, noteBlock);

    userNotes.forEach(n => prepNotes.push(`ADDED TOPIC: ${n.text}${n.url ? ` (ref: ${n.url})` : ''}`));
  }

  return {
    title: `Training Strategy Session: ${a.customer_name}`,
    subtitle: `Workforce Development Approach — Non-Technical & Technical Roles`,
    format: '1-Hour Training Strategy Session',
    location: a.ebc_data.location,
    date: a.ebc_data.meeting_dates[0],
    principles: [
      'Customer Obsession — Focus on their workforce needs, not our catalog',
      'Working Backwards — Start with the roles they need, design the path',
      'Earn Trust — Be honest about what works and what doesn\'t',
      'Think Big — Enterprise-wide vision, pilot-sized start'
    ],
    blocks,
    preparation_notes: prepNotes
  };
}
