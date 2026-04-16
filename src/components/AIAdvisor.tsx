import { useState, useEffect } from 'react';
import { Bot, Send, Sparkles, TrendingUp, FileText, Workflow, BarChart3, Users, Shield, X } from 'lucide-react';
import type { Account, Attendee } from '../types';

function fmt(n: number) {
  return n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `$${(n / 1_000).toFixed(0)}K` : `$${n}`;
}

interface Message {
  role: 'user' | 'agent';
  text: string;
  capability?: string;
}

const capabilities = [
  { id: 'coaching', label: 'Coaching', icon: Users, color: 'text-cyan-400', prompts: ['🎭 Role-play', 'Objection handling', 'Peer matching'] },
  { id: 'intelligence', label: 'Intelligence', icon: Sparkles, color: 'text-amber-400', prompts: ['Signal analysis', 'Renewal risk', 'Competitive intel'] },
  { id: 'research', label: 'Research', icon: TrendingUp, color: 'text-sky-400', prompts: ['Pre-meeting brief', 'Industry trends', 'Customer story'] },
  { id: 'content', label: 'Content', icon: FileText, color: 'text-emerald-400', prompts: ['Leave-behind', 'ROI model', 'Proposal draft', 'Follow-up email'] },
  { id: 'workflow', label: 'Workflow', icon: Workflow, color: 'text-violet-400', prompts: ['Follow-up plan', 'Action tracking'] },
  { id: 'analytics', label: 'Analytics', icon: BarChart3, color: 'text-rose-400', prompts: ['Pattern analysis', 'Approach benchmark'] },
];

function generatePersonaProfile(att: Attendee, a: Account): string {
  const social = a.public_intelligence.executive_social.find(e => e.name === att.name);
  const linkedinUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(att.name + ' ' + a.customer_name)}`;

  // Generate a realistic professional profile based on persona type and account context
  const profiles: Record<string, { background: string; academic: string; career: string; approach: string }> = {
    CEO: {
      background: `${att.name} leads ${a.customer_name} as CEO, steering the organization through a major ${a.sfdc_data.account_plan_priority} transformation. ${social ? `Recently active on LinkedIn discussing "${social.post_theme}".` : 'Active in industry thought leadership circles.'}`,
      academic: `Likely holds an MBA or advanced degree in business/finance from a top-tier institution. CEOs in ${a.industry} typically have 20+ years of progressive leadership experience with a mix of operational and strategic roles.`,
      career: `Career trajectory suggests deep ${a.industry} expertise with prior C-suite or SVP roles at comparable organizations. Has likely led at least one major transformation initiative before. The ${a.aws_spend.ppa} commitment signals confidence in the cloud strategy and willingness to make bold bets.`,
      approach: `Lead with vision and competitive positioning. ${att.name} thinks in terms of market leadership, not cost savings. Reference their public statements${social ? ` — especially "${social.post_theme}"` : ''}. Frame T&C as the workforce engine that makes the technology investment pay off. Use Bell Canada (67% cloud sales increase) as the proof point. Don't get into product details — stay at the strategic level. Ask: "What does the workforce of 2030 look like for ${a.customer_name}?"`
    },
    CFO: {
      background: `${att.name} oversees ${a.customer_name}'s financial strategy, including the ${a.aws_spend.ppa} cloud investment. ${social ? `Recently published thoughts on "${social.post_theme}".` : 'Focused on demonstrating ROI on technology investments.'}`,
      academic: `Likely holds a CPA, CFA, or MBA with a finance concentration. CFOs in ${a.industry} typically have 15-20 years in finance with experience in FP&A, treasury, and investor relations before reaching the C-suite.`,
      career: `Career path suggests progression through financial leadership roles with increasing P&L responsibility. Has likely managed through at least one major investment cycle. The board is asking about ROI on the cloud transformation — ${att.name} needs data to answer those questions.`,
      approach: `Lead with numbers, not narratives. ${att.name} needs Forrester TEI data (229% ROI, <6 month payback) and a custom ROI model specific to ${a.customer_name}. Frame training as a multiplier on the existing ${a.aws_spend.ppa} investment, not an additional cost. Show the build vs. buy economics: internal development costs 40-60% less than external hiring. ${social ? `Reference their interest in "${social.post_theme}" to show you've done your homework.` : ''} Ask: "How are you factoring workforce readiness into your transformation financial model?"`
    },
    CTO: {
      background: `${att.name} leads ${a.customer_name}'s technology strategy, driving ${a.sfdc_data.account_plan_priority}. ${social ? `Active on LinkedIn discussing "${social.post_theme}".` : 'Focused on building technical capability at scale.'}`,
      academic: `Likely holds a CS, Engineering, or related technical degree, possibly with an advanced degree (MS/PhD). CTOs in ${a.industry} typically have 15+ years of hands-on technical experience before moving into leadership.`,
      career: `Career trajectory suggests deep technical roots — likely started as an engineer/architect and progressed through technical leadership. Has probably built and scaled engineering teams before. The ${a.public_intelligence.linkedin_job_postings.cloud_ai_roles} open cloud/AI roles are a direct pain point — every unfilled role is a delay risk on the transformation.`,
      approach: `Lead with technical credibility and skill uplift data. ${att.name} respects evidence over marketing. Use UNSW (70% skill uplift, 54% AWS proficiency growth) and CloudCall (50% time-to-market reduction). Frame training as a delivery accelerator, not a learning exercise. ${social ? `Reference "${social.post_theme}" to establish common ground.` : ''} Propose role-based learning paths mapped to their actual transformation workstreams. Ask: "Which roles are the biggest bottleneck on your transformation timeline?"`
    },
    CIO: {
      background: `${att.name} leads ${a.customer_name}'s IT strategy and infrastructure, managing the ${a.sfdc_data.account_plan_priority} initiative. ${social ? `Recently shared insights on "${social.post_theme}".` : 'Focused on modernizing IT capabilities.'}`,
      academic: `Likely holds a degree in IT, CS, or business with technology focus. CIOs in ${a.industry} typically have 15-20 years spanning both technical and business roles, often with experience in consulting or systems integration.`,
      career: `Career path suggests a blend of technical depth and business acumen. Has likely managed large-scale IT transformations and vendor relationships. The challenge of finding cloud-certified talent is personal — every open role impacts delivery timelines.`,
      approach: `Lead with time-to-competency and delivery acceleration. ${att.name} is measured on project delivery, not learning metrics. Show how structured training reduces time-to-competency by 40-60% and certified teams deliver 20% faster. ${social ? `Connect to their concern about "${social.post_theme}".` : ''} Propose a pilot aligned to the most critical migration workstream. Ask: "What's the biggest skills gap slowing down your ${a.sfdc_data.smgs_phase} phase?"`
    },
    CHRO: {
      background: `${att.name} leads ${a.customer_name}'s people strategy, responsible for talent acquisition, development, and retention. ${social ? `Actively advocating for "${social.post_theme}".` : 'Focused on building a future-ready workforce.'}`,
      academic: `Likely holds a degree in HR, organizational psychology, or business, possibly with SHRM-SCP or similar certification. CHROs in ${a.industry} typically have 15+ years in HR with experience across talent management, L&D, and organizational development.`,
      career: `Career trajectory suggests deep expertise in workforce transformation, talent strategy, and culture change. Has likely led enterprise-wide learning initiatives before. ${att.name} is the natural internal champion for a T&C partnership — they understand that technology transformation requires people transformation.`,
      approach: `Lead with retention data and participation rates. ${att.name} cares about people outcomes, not technology metrics. Use Holcim (85% participation, 38% team growth) and the research showing employer-funded training is the strongest predictor of retention. ${social ? `Build on their passion for "${social.post_theme}".` : ''} Frame the program as a talent magnet and retention tool, not just a skills initiative. Ask: "What would it mean for ${a.customer_name} if you could build the skills internally instead of competing in the external talent market?"`
    },
    Other: {
      background: `${att.name} serves as ${att.title} at ${a.customer_name}, bringing specialized expertise to the ${a.sfdc_data.account_plan_priority} initiative. ${social ? `Recently shared thoughts on "${social.post_theme}".` : ''}`,
      academic: `Likely holds a specialized degree relevant to their domain. Executives in this role typically have 15+ years of domain expertise with progressive leadership responsibility.`,
      career: `Career path suggests deep domain expertise with a track record of driving functional transformation. Their perspective on workforce development will be shaped by their specific domain challenges and team needs.`,
      approach: `Lead with domain-specific relevance. Understand their specific team's skills gaps and how training can accelerate their functional goals. Connect the T&C program to their domain priorities within ${a.sfdc_data.account_plan_priority}. Ask: "What skills does your team need most to deliver on your part of the transformation?"`
    }
  };

  const p = profiles[att.persona] || profiles.Other;

  return `👤 Persona Profile: ${att.name}\n${att.title} · ${a.customer_name}\n🔗 LinkedIn: ${linkedinUrl}\n\n` +
    `📖 Background:\n${p.background}\n\n` +
    `🎓 Academic & Professional History:\n${p.academic}\n\n` +
    `💼 Career Trajectory:\n${p.career}\n\n` +
    `🎯 Suggested Approach:\n${p.approach}`;
}

function generateInitialSummary(a: Account): string {
  const isGreenfield = !a.tc_current_state.skill_builder;
  const highSignals = a.signals.filter(s => s.severity === 'HIGH');

  return `Here's what you should be thinking about for ${a.customer_name}:\n\n` +
    `🎯 Top priority: ${highSignals[0]?.label || 'Workforce transformation'} — ${highSignals[0]?.evidence || 'significant skills gap identified'}\n\n` +
    `💡 Your opening move: ${isGreenfield
      ? `This is a greenfield opportunity. Lead with the Learning Needs Assessment — it's low-commitment, high-value, and gives you the data to design a compelling program.`
      : `The existing engagement has stalled at ${a.tc_current_state.activation_rate}% activation. Lead with transparency about the data and a clear remediation plan. Turn the renewal into an expansion conversation.`
    }\n\n` +
    `⚡ Key talking point: ${a.public_intelligence.earnings_call_signals[0] || a.sfdc_data.account_plan_priority}\n\n` +
    `🏆 Best proof point for ${a.industry}: ${a.industry === 'Financial Services' ? 'Bell Canada — 67% cloud sales increase' : a.industry === 'Healthcare' ? 'UNSW — 70% skill uplift, 54% AWS proficiency growth' : 'Holcim — 85% participation across global workforce'}\n\n` +
    `Ask me anything — I can help with research, content, coaching, and more.`;
}

function getAgentResponse(question: string, a: Account, selectedPersona?: Attendee): { text: string; capability: string } {
  const q = question.toLowerCase();
  const isGreenfield = !a.tc_current_state.skill_builder;

  if (q.includes('signal') || q.includes('alert') || q.includes('risk') || q.includes('renewal') || q.includes('intelligence')) {
    const highSignals = a.signals.filter(s => s.severity === 'HIGH');
    return {
      capability: 'Proactive Intelligence',
      text: `🔍 Signal Analysis for ${a.customer_name}:\n\n${highSignals.map(s => `🔴 ${s.label}: ${s.evidence}`).join('\n\n')}${a.signals.filter(s => s.severity === 'MEDIUM').map(s => `\n\n🟡 ${s.label}: ${s.evidence}`).join('')}\n\n${isGreenfield ? '⚠️ GREENFIELD ALERT: No structured T&C engagement. High-priority opportunity.' : `⚠️ RENEWAL RISK: Renewal on ${a.tc_current_state.renewal_date} with ${a.tc_current_state.activation_rate}% activation.`}`
    };
  }

  if (q.includes('brief') || q.includes('research') || q.includes('prepare') || q.includes('industry') || q.includes('trend') || q.includes('customer story')) {
    return {
      capability: 'Research & Preparation',
      text: `📋 Pre-Meeting Brief — ${a.customer_name}:\n\n🏢 ${a.segment} in ${a.industry} (${a.geo}), ${fmt(a.aws_spend.current_year)} AWS spend. PPA: ${a.aws_spend.ppa}.\n\n🎯 Priority: ${a.sfdc_data.account_plan_priority}\n\n📰 Signals:\n${a.public_intelligence.earnings_call_signals.slice(0, 2).map(s => `• ${s}`).join('\n')}\n\n👥 Executive Activity:\n${a.public_intelligence.executive_social.map(e => `• ${e.name}: "${e.post_theme}"`).join('\n')}\n\n🏭 ${a.public_intelligence.industry_context}`
    };
  }

  if (q.includes('leave-behind') || q.includes('leave behind') || q.includes('one-pager') || q.includes('collateral')) {
    return {
      capability: 'Content Generation',
      text: `📄 Leave-Behind for ${a.customer_name}:\n\nTitle: "Accelerating ${a.sfdc_data.account_plan_priority} Through Workforce Transformation"\n\n1. Forrester: 229% ROI, <6 month payback\n2. ${a.public_intelligence.linkedin_job_postings.cloud_ai_roles} open cloud/AI roles — can't hire fast enough\n3. Bell Canada: 67% cloud sales increase after structured training\n\nCTA: "Let's start with a Learning Needs Assessment — we'll deliver a tailored program design within 3 weeks."\n\n💡 Customize proof point by persona: CFO→Forrester ROI, CEO→Bell Canada revenue, CHRO→Holcim participation, CTO→UNSW skill uplift.`
    };
  }

  if (q.includes('roi') || q.includes('cost') || q.includes('budget') || q.includes('invest') || q.includes('model')) {
    return {
      capability: 'Content Generation',
      text: `💰 ROI Framework for ${a.customer_name}:\n\n• External hire: $180K-$250K per cloud/AI role\n• Internal training: $5K-$15K per person\n• ${a.public_intelligence.linkedin_job_postings.cloud_ai_roles} roles × $200K = ${fmt(a.public_intelligence.linkedin_job_postings.cloud_ai_roles * 200000)} hiring cost\n• Same via training: ${fmt(a.public_intelligence.linkedin_job_postings.cloud_ai_roles * 10000)} — ${Math.round((1 - (10000/200000)) * 100)}% savings\n\n⏱️ Time-to-competency: 2-4 months (vs. 6-9 months hiring)\n📈 Forrester: 229% ROI, <6 month payback\n🎯 Every month of delay on ${a.sfdc_data.account_plan_priority} costs more than the entire program.`
    };
  }

  if (q.includes('proposal') || q.includes('draft')) {
    return {
      capability: 'Content Generation',
      text: `📝 Proposal Outline:\n\n1. Executive Summary — ${a.customer_name}'s vision + workforce gap\n2. Program Design — ${isGreenfield ? 'LNA + 50-100 person pilot' : 'Health Review + Program Redesign'}\n3. Phase 1 (0-90d): Pilot launch\n4. Phase 2 (90-180d): Role-based tracks + certs\n5. Phase 3 (180d+): Enterprise scale\n6. Investment: Phased with expansion triggers\n7. Success Metrics: Activation, skill uplift, certs, business impact\n8. Next Steps: Sponsor, pilot team, 90-day checkpoint`
    };
  }

  if (q.includes('email') || q.includes('follow-up') || q.includes('follow up') || q.includes('followup')) {
    return {
      capability: 'Content Generation',
      text: `📧 Follow-Up Email:\n\nSubject: ${a.customer_name} × AWS — Next Steps\n\nThank you for the conversation about ${a.customer_name}'s workforce strategy.\n\nAgreed next steps:\n1. AWS delivers tailored proposal in 10 business days (LNA scope, program design, ROI model)\n2. Technical deep-dive with CTO/CIO team in 2 weeks\n3. Board-ready summary connecting workforce investment to ${a.sfdc_data.account_plan_priority}\n\nPlease confirm the executive sponsor — that's the single most important factor in program success.`
    };
  }

  if (q.includes('follow') || q.includes('after') || q.includes('post') || q.includes('action') || q.includes('plan') || q.includes('track')) {
    return {
      capability: 'Workflow Orchestration',
      text: `📋 Action Plan for ${a.customer_name}:\n\n⏰ 24 hours: Thank-you note + Salesforce update\n📅 1 week: Technical deep-dive pre-read + scheduling\n📅 2 weeks: Full proposal delivery\n📅 30 days: Pilot launch + weekly check-ins\n📅 90 days: Results review + expansion recommendation`
    };
  }

  if (q.includes('pattern') || q.includes('benchmark') || q.includes('analytics') || q.includes('win') || q.includes('what works')) {
    return {
      capability: 'Analytics & Learning',
      text: `📊 ${a.industry} Patterns:\n\n🏆 Best entry point: CHRO (72% success rate)\n📈 Accounts with 3+ HIGH signals: 78% conversion\n🎯 ${a.customer_name}: Score ${a.tc_opportunity_score}/10 — ${a.tc_opportunity_score >= 8 ? 'top quartile' : 'strong opportunity'}\n\nBest proof points for ${a.industry}: ${a.industry === 'Financial Services' ? 'Bell Canada + Forrester TEI' : a.industry === 'Healthcare' ? 'UNSW + Holcim' : 'Holcim + Forrester TEI'}\n\nRecommended pattern: ${a.signals.find(s => s.label.includes('Talent')) ? 'Talent War' : 'Board Pressure'}`
    };
  }

  if (q.includes('objection') || q.includes('pushback') || q.includes('concern') || q.includes('handle')) {
    return {
      capability: 'Coaching',
      text: `🎯 Objection Handling:\n\n❌ "No time for training"\n✅ Unstructured learning wastes more time. Forrester: 229% ROI, <6 month payback.\n\n❌ "We can hire"\n✅ ${a.public_intelligence.linkedin_job_postings.cloud_ai_roles} open roles growing ${a.public_intelligence.linkedin_job_postings.yoy_change} YoY. Build vs. buy: 40-60% savings.\n\n❌ "Training hasn't worked"\n✅ ${isGreenfield ? "No structured program existed. Ad-hoc doesn't scale." : `Plateaued at ${a.tc_current_state.activation_rate}% due to lack of program design. Fixable with dedicated time + accountability.`}\n\n❌ "Show me ROI first"\n✅ Forrester validated 229% ROI. Let's build a custom model for ${a.customer_name}.`
    };
  }

  if (q.includes('role-play') || q.includes('roleplay') || q.includes('practice') || q.includes('simulate')) {
    const persona = selectedPersona || a.ebc_data.attendees[0];
    return {
      capability: 'Coaching',
      text: `🎭 Role-Play: ${persona.name} (${persona.title})\n\nThey open with:\n"We've invested heavily in cloud, but I'm not convinced we need a separate training program."\n\n1. Acknowledge: "Your team is talented — that's exactly why this matters."\n\n2. Reframe: "The question isn't capability — it's velocity. Structured programs deliver 70% skill uplift and cut time-to-competency by 40-60%."\n\n3. Evidence: "UNSW saw 54% AWS proficiency growth. For ${a.customer_name}, that could mean hitting your timeline vs. missing it by 6-12 months."\n\n4. Bridge: "What if we started with 50 people in the roles most critical to ${a.sfdc_data.account_plan_priority}? Low risk, high signal."\n\n💡 Select a different persona to practice with them specifically.`
    };
  }

  if (q.includes('peer') || q.includes('expert') || q.includes('reference') || q.includes('connect')) {
    return {
      capability: 'Coaching',
      text: `🤝 Connections for ${a.customer_name}:\n\n📞 Internal: ${a.industry} T&C Specialist, Enterprise Skills Guild Lead, Certification Program Manager\n\n🏢 References: ${a.industry === 'Financial Services' ? 'Bell Canada (67% cloud sales increase)' : a.industry === 'Healthcare' ? 'Healthcare org with HIPAA-compliant program' : 'Holcim (85% global participation)'}\n\n💡 Best approach: peer-to-peer. Connect their CHRO with a reference CHRO.`
    };
  }

  return {
    capability: 'General',
    text: `I'm your AWS Engagement Advisor for ${a.customer_name}. Try:\n\n🔍 "Signal analysis" — what's happening with this account\n📋 "Pre-meeting brief" — full intelligence summary\n📄 "Draft a follow-up email" — ready-to-send template\n💰 "ROI model" — custom investment framework\n🎯 "Objection handling" — how to respond to pushback\n🎭 "Role-play prep" — practice the conversation\n📊 "What works in ${a.industry}" — pattern analysis`
  };
}

function getRolePlayResponse(userMessage: string, a: Account, persona: Attendee): string {
  const q = userMessage.toLowerCase();
  const social = a.public_intelligence.executive_social.find(e => e.name === persona.name);

  // Simulate the persona's response based on their role
  if (persona.persona === 'CEO') {
    if (q.includes('training') || q.includes('workforce') || q.includes('skills')) {
      return `[${persona.name}]: "I appreciate you bringing this up. We're making a significant bet on ${a.sfdc_data.account_plan_priority}, and I know our people need to keep pace. But I've seen training programs come and go — what makes this different from the last initiative that fizzled out?"\n\n💡 Coaching tip: Good — they're engaged. Address the "what's different" question with proof points and program design specifics. Don't get defensive about past failures.`;
    }
    if (q.includes('roi') || q.includes('investment') || q.includes('cost')) {
      return `[${persona.name}]: "The board is watching every dollar of our cloud investment. I need to see this as a multiplier on our existing ${a.aws_spend.ppa} commitment, not an additional line item. Can you show me how this connects to our transformation timeline?"\n\n💡 Coaching tip: Perfect opening for the Forrester 229% ROI data. Connect training investment directly to ${a.sfdc_data.account_plan_priority} delivery acceleration.`;
    }
    return `[${persona.name}]: "Look, I'm interested, but I need to understand the big picture. ${social ? `As I mentioned in my recent post about '${social.post_theme}', ` : ''}we're at a critical point in our transformation. How does workforce development fit into the competitive landscape? What are our peers doing?"\n\n💡 Coaching tip: They want competitive context. Reference what similar ${a.industry} organizations are doing and position this as a competitive advantage, not just a training program.`;
  }

  if (persona.persona === 'CFO') {
    if (q.includes('roi') || q.includes('return') || q.includes('payback')) {
      return `[${persona.name}]: "229% ROI sounds impressive, but that's a general benchmark. I need to see the math for ${a.customer_name} specifically. What are the assumptions? How does it account for our ${a.sfdc_data.smgs_phase} phase?"\n\n💡 Coaching tip: They want specifics, not generalizations. Offer to build a custom ROI model. Use their ${a.public_intelligence.linkedin_job_postings.cloud_ai_roles} open roles as the starting point for build vs. buy economics.`;
    }
    return `[${persona.name}]: "I'm looking at this from a financial perspective. We have ${a.sfdc_data.open_opps} open opportunities and a major transformation underway. Every dollar needs to justify itself. What's the payback period, and what happens if we start small?"\n\n💡 Coaching tip: Lead with the phased approach — pilot is low-risk, reversible. Show the "two-way door" framing. CFOs love optionality.`;
  }

  if (persona.persona === 'CHRO') {
    if (q.includes('retention') || q.includes('talent') || q.includes('people')) {
      return `[${persona.name}]: "You're speaking my language. We're losing people to competitors who offer better growth opportunities. ${social ? `I've been vocal about this — '${social.post_theme}'. ` : ''}But I need more than a platform — I need a program that managers will actually support and employees will actually use."\n\n💡 Coaching tip: They're your champion. Focus on program design, not product features. Holcim's 85% participation came from dedicated learning time and manager accountability. That's what they need to hear.`;
    }
    return `[${persona.name}]: "I've been pushing for more investment in our people, but I need to show the executive team that this will actually move the needle. What does success look like in the first 90 days?"\n\n💡 Coaching tip: Give them ammunition for internal advocacy. Define clear 90-day metrics: activation rate, skill uplift, certification targets. Make them the hero of the story.`;
  }

  if (persona.persona === 'CTO' || persona.persona === 'CIO') {
    if (q.includes('technical') || q.includes('engineer') || q.includes('skill')) {
      return `[${persona.name}]: "My teams are smart, but they're stretched thin. We have ${a.public_intelligence.linkedin_job_postings.cloud_ai_roles} open roles and the ones we do have are learning on the job. ${social ? `As I wrote about — '${social.post_theme}'. ` : ''}I need something that actually accelerates delivery, not just checks a training box."\n\n💡 Coaching tip: They care about delivery speed, not learning metrics. Frame everything in terms of time-to-competency and project delivery acceleration. UNSW's 70% skill uplift is your best proof point.`;
    }
    return `[${persona.name}]: "I've seen too many training programs that don't connect to real work. If we do this, it needs to be mapped to our actual ${a.sfdc_data.account_plan_priority} workstreams, not generic cloud training."\n\n💡 Coaching tip: Exactly right — propose role-based learning paths aligned to their specific transformation. This is where you differentiate from generic training vendors.`;
  }

  // Default for Other personas
  return `[${persona.name}]: "This is interesting. From my perspective as ${persona.title}, I'm most concerned about how this impacts my team's ability to deliver on our part of ${a.sfdc_data.account_plan_priority}. Can you be specific about what this looks like for my function?"\n\n💡 Coaching tip: They want domain-specific relevance. Ask about their team's specific skills gaps and connect the program to their functional goals.`;
}

export function AIAdvisor({ account }: { account: Account }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeCapability, setActiveCapability] = useState<string | null>(null);
  const [selectedPersona, setSelectedPersona] = useState<Attendee | undefined>(undefined);
  const [showPersonaSelect, setShowPersonaSelect] = useState(false);
  const [rolePlayMode, setRolePlayMode] = useState(false);

  // Show initial summary when first opened
  useEffect(() => {
    if (open && messages.length === 0) {
      const summary = generateInitialSummary(account);
      setMessages([{ role: 'agent', text: summary, capability: 'AWS Engagement Advisor' }]);
    }
  }, [open]);

  // When a persona is selected, auto-generate their profile
  useEffect(() => {
    if (selectedPersona) {
      const profile = generatePersonaProfile(selectedPersona, account);
      setMessages(prev => [...prev, { role: 'agent', text: profile, capability: 'Persona Coaching' }]);
      if (rolePlayMode) {
        setTimeout(() => {
          setMessages(prev => [...prev, {
            role: 'agent',
            text: `🎭 Role-play mode active with ${selectedPersona.name} (${selectedPersona.title}).\n\nI'll respond as ${selectedPersona.name} would. Start the conversation — try your opening line or pitch.\n\nTip: Begin with one of the conversation starters from the engagement plan, or try your own approach. I'll respond in character and give you coaching feedback after each exchange.`,
            capability: 'Role-Play'
          }]);
        }, 500);
      }
    }
  }, [selectedPersona]);

  const send = (text?: string) => {
    const q = (text || input).trim();
    if (!q) return;

    // Handle role-play prompt — show persona picker
    if (q === '🎭 Role-play') {
      setShowPersonaSelect(true);
      setRolePlayMode(true);
      setActiveCapability(null);
      return;
    }

    setMessages(prev => [...prev, { role: 'user', text: q }]);

    // If in role-play mode with a selected persona, respond in character
    if (rolePlayMode && selectedPersona) {
      setTimeout(() => {
        const rpResponse = getRolePlayResponse(q, account, selectedPersona);
        setMessages(prev => [...prev, { role: 'agent', text: rpResponse, capability: `${selectedPersona.name} (Role-Play)` }]);
      }, 400);
    } else {
      const response = getAgentResponse(q, account, selectedPersona);
      setTimeout(() => {
        setMessages(prev => [...prev, { role: 'agent', text: response.text, capability: response.capability }]);
      }, 300);
    }
    setInput('');
    setActiveCapability(null);
  };

  // Floating button — bottom of screen, easy thumb access on mobile
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-4 py-2.5 rounded-full bg-gradient-to-r from-sky-500 to-violet-500 shadow-lg shadow-violet-500/30 active:scale-95 transition-transform"
        aria-label="Open AWS Engagement Advisor"
      >
        <Bot className="w-4 h-4 text-white" />
        <span className="text-xs font-medium text-white">AWS Advisor</span>
      </button>
    );
  }

  // Full panel — slides up from bottom like iOS sheet
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-navy-900 sm:inset-auto sm:bottom-0 sm:left-1/2 sm:-translate-x-1/2 sm:w-[430px] sm:h-[85vh] sm:rounded-t-2xl sm:border-t sm:border-x sm:border-navy-600 sm:shadow-2xl sm:shadow-black/50 overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-navy-700 bg-navy-800 shrink-0">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-500 to-violet-500 flex items-center justify-center shrink-0">
          <Bot className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-white">AWS Engagement Advisor</div>
          <div className="text-[11px] text-slate-400">
            {rolePlayMode && selectedPersona
              ? `🎭 Role-playing as ${selectedPersona.name}`
              : account.customer_name}
          </div>
        </div>
        {/* Persona selector for coaching */}
        <button
          onClick={() => setShowPersonaSelect(!showPersonaSelect)}
          className={`p-1.5 rounded-lg text-xs ${selectedPersona ? 'bg-cyan-500/15 text-cyan-400' : 'bg-navy-700 text-slate-400'} active:opacity-80`}
          aria-label="Select persona for role-play"
          title="Select persona for coaching"
        >
          <Users className="w-4 h-4" />
        </button>
        <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg active:bg-navy-700" aria-label="Close">
          <X className="w-5 h-5 text-slate-400" />
        </button>
      </div>

      {/* Persona selector dropdown */}
      {showPersonaSelect && (
        <div className="px-3 py-2 border-b border-navy-700 bg-navy-800/50 space-y-1.5 shrink-0">
          <span className="text-[11px] text-slate-500 uppercase font-medium">
            {rolePlayMode ? '🎭 Select a persona to role-play with:' : 'Select persona for coaching:'}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {!rolePlayMode && (
              <button
                onClick={() => { setSelectedPersona(undefined); setShowPersonaSelect(false); }}
                className={`text-[11px] px-2 py-1 rounded-lg ${!selectedPersona ? 'bg-cyan-500/15 text-cyan-400' : 'bg-navy-700 text-slate-400'} active:opacity-80`}
              >
                Auto
              </button>
            )}
            {account.ebc_data.attendees.map(att => (
              <button
                key={att.name}
                onClick={() => { setSelectedPersona(att); setShowPersonaSelect(false); }}
                className={`text-[11px] px-2.5 py-1.5 rounded-lg ${selectedPersona?.name === att.name ? 'bg-cyan-500/15 text-cyan-400' : 'bg-navy-700 text-slate-400'} active:opacity-80`}
              >
                {att.name.split(' ')[0]} ({att.persona})
              </button>
            ))}
          </div>
          {rolePlayMode && selectedPersona && (
            <button
              onClick={() => { setRolePlayMode(false); setSelectedPersona(undefined); setShowPersonaSelect(false); }}
              className="text-[11px] px-2.5 py-1 rounded-lg bg-rose-500/15 text-rose-400 active:opacity-80"
            >
              End role-play
            </button>
          )}
        </div>
      )}

      {/* Capability chips */}
      <div className="px-3 py-2 flex gap-1.5 overflow-x-auto border-b border-navy-700 shrink-0">
        {capabilities.map(c => (
          <button
            key={c.id}
            onClick={() => {
              if (activeCapability === c.id) {
                setActiveCapability(null);
              } else {
                setActiveCapability(c.id);
              }
            }}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium shrink-0 transition-colors ${
              activeCapability === c.id ? 'bg-navy-600 text-white' : 'bg-navy-800 text-slate-400 active:bg-navy-700'
            }`}
          >
            <c.icon className={`w-3 h-3 ${c.color}`} />
            {c.label}
          </button>
        ))}
      </div>

      {/* Quick prompts */}
      {activeCapability && (
        <div className="px-3 py-2 flex gap-1.5 flex-wrap border-b border-navy-700 shrink-0">
          {capabilities.find(c => c.id === activeCapability)?.prompts.map(p => (
            <button
              key={p}
              onClick={() => send(p)}
              className={`text-[11px] px-2.5 py-1 rounded-full active:opacity-80 ${
                p.includes('🎭') ? 'bg-gradient-to-r from-cyan-500/20 to-violet-500/20 text-cyan-300 font-medium' : 'bg-sky-500/10 text-sky-400'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[90%] rounded-xl px-3 py-2.5 ${
              msg.role === 'user'
                ? 'bg-amber-500/15 text-amber-200'
                : 'bg-navy-800 border border-navy-700 text-slate-200'
            }`}>
              {msg.capability && (
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Shield className="w-3 h-3 text-sky-400" />
                  <span className="text-[10px] text-sky-400 font-medium uppercase tracking-wider">{msg.capability}</span>
                </div>
              )}
              <p className="text-xs leading-relaxed whitespace-pre-line">{msg.text}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 p-3 border-t border-navy-700 bg-navy-800 shrink-0">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder={rolePlayMode && selectedPersona ? `Say something to ${selectedPersona.name}...` : "Ask the advisor..."}
          className="flex-1 px-3 py-2 bg-navy-900/50 border border-navy-600 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-400/50"
        />
        <button
          onClick={() => send()}
          className="p-2.5 rounded-lg bg-gradient-to-r from-sky-500 to-violet-500 active:opacity-80"
          aria-label="Send"
        >
          <Send className="w-4 h-4 text-white" />
        </button>
      </div>
    </div>
  );
}
