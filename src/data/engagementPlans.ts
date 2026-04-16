import type { EngagementPlan } from '../types';

// Keyed by `${customer_name}::${persona}` 
export const engagementPlans: Record<string, EngagementPlan> = {

  // ── OCC ──────────────────────────────────────────────
  "Oceanic Capital Corporation::CHRO": {
    persona: "CHRO", persona_name: "Jennifer Williams", persona_title: "Chief Human Resources Officer",
    narrative: "Jennifer Williams just announced a $50M employee development investment — and she's broadcasting it on LinkedIn. That's not a budget line; that's a strategic bet. But here's the gap: OCC has 89 open cloud/AI roles growing at 156% year-over-year, and only 12 organic AWS certifications across 15,000 employees. Jennifer can't hire her way out of this. The external talent market for cloud-skilled financial services professionals is the most competitive it's ever been. She needs a build strategy, and she needs it before the board's next workforce readiness review.",
    conversation_starters: [
      "Jennifer, your LinkedIn post about investing $50M in employee development caught our attention. Holcim achieved 85% participation and 38% team growth through a structured AWS training program. What if that $50M investment could close the 89-role gap faster than recruiting ever could?",
      "Your CTO mentioned needing 200+ engineers cloud-ready in 18 months. The external market can't deliver that — not in financial services, not at this scale. UNSW achieved a 70% skill uplift through structured programs. That's the kind of velocity that changes a transformation timeline.",
      "Glassdoor is telling us something important: your engineers want cloud training but don't have structured paths. That's a retention risk hiding in plain sight. The companies winning the talent war aren't just paying more — they're growing more."
    ],
    recommended_plays: [
      { play_name: "Enterprise Learning Needs Assessment", description: "Map the skills gap across all 15,000 employees against the cloud migration and AI transformation requirements" },
      { play_name: "OCC Cloud Academy (Skills Guild)", description: "A branded internal academy with role-based tracks: Cloud Architect, Security Engineer, Data Engineer, AI/ML Specialist — aligned to the $2B migration program" },
      { play_name: "Skill Builder Team Subscription (500-seat pilot)", description: "Immediate access for the engineering teams David Park identified as priority" },
      { play_name: "AWS Certification Milestone Program", description: "Solutions Architect Professional and Security Specialty for core teams; Cloud Practitioner for all technology staff" }
    ],
    revenue_estimate: [
      { offering: "Learning Needs Assessment (enterprise-wide)", estimated_value: "$100K–$200K", timeline: "Q3 2026" },
      { offering: "Executive AI Literacy Workshop (C-suite + Board)", estimated_value: "$30K–$50K", timeline: "Q3 2026" },
      { offering: "Skill Builder Team Subscription (500 → 5,000)", estimated_value: "$250K–$2.5M", timeline: "Q3 2026 → Q2 2027" },
      { offering: "OCC Cloud Academy (Skills Guild)", estimated_value: "$750K–$2M", timeline: "Q4 2026 → ongoing" },
      { offering: "Private Training ILT (migration teams)", estimated_value: "$300K–$600K", timeline: "Q3–Q4 2026" },
      { offering: "Certification Program (enterprise-wide)", estimated_value: "$200K–$500K", timeline: "Q4 2026 → ongoing" }
    ],
    total_pipeline: "$1.63M–$5.85M over 18 months",
    proof_points: [
      { customer: "Holcim", industry: "Industrial", metric: "85% participation, 38% team growth", demonstrates: "Enterprise-wide scale is achievable" },
      { customer: "LTIMindtree", industry: "IT Services", metric: "40,000+ employees trained at scale", demonstrates: "Large-scale workforce transformation" },
      { customer: "Forrester TEI", industry: "Cross-industry", metric: "229% ROI, <6 month payback", demonstrates: "Third-party validated ROI" }
    ]
  },

  "Oceanic Capital Corporation::CEO": {
    persona: "CEO", persona_name: "Sarah Chen", persona_title: "Chief Executive Officer",
    narrative: "Sarah Chen stood at Davos and declared AI the future of financial services. She's betting the company on it — a $2B cloud migration, a $200M PPA with AWS, and a public commitment to AI-powered risk analytics. But there's a gap between vision and execution that only shows up when you look at the workforce numbers: 89 open cloud/AI roles, 12 certifications across 15,000 employees, and a board that's starting to ask hard questions about workforce readiness. Sarah's competitors — JPMorgan, Goldman Sachs — are investing heavily in AI workforce development. The window to lead is open, but it's closing.",
    conversation_starters: [
      "Sarah, your Davos keynote on AI in financial services was compelling. The vision is clear — but JPMorgan and Goldman Sachs are already investing heavily in AI workforce development. The companies that win this race won't just have the best technology; they'll have the best-prepared people. How is OCC thinking about that workforce multiplier?",
      "You've made a generational bet on AI-powered risk analytics. Bell Canada made a similar bet and saw a 67% increase in cloud sales after investing in structured workforce development. The technology investment and the people investment are two sides of the same coin.",
      "Your board asked about workforce readiness. That's actually a leading indicator — boards that ask about workforce readiness early are the ones whose transformations succeed. AWS can help you turn that board question into a board-ready answer."
    ],
    recommended_plays: [
      { play_name: "OCC Skills Transformation Partnership", description: "Position AWS T&C as the strategic partner for Sarah's AI-first organization vision; co-branded initiative" },
      { play_name: "Enterprise-Wide Skills Guild", description: "Scale from 12 organic certs to a structured program across 15,000 employees with role-based tracks" },
      { play_name: "Executive AI Literacy Program", description: "For the C-suite and board; builds leadership confidence and addresses governance requirements" },
      { play_name: "Competitive Benchmarking", description: "Show Sarah where OCC stands vs. JPMorgan and Goldman Sachs on workforce AI readiness" }
    ],
    revenue_estimate: [
      { offering: "Skills Transformation Partnership", estimated_value: "$750K–$2M", timeline: "Q4 2026 → ongoing" },
      { offering: "Executive AI Literacy (C-suite + Board)", estimated_value: "$30K–$50K", timeline: "Q3 2026" },
      { offering: "Enterprise Skills Guild", estimated_value: "$500K–$2.5M", timeline: "Q4 2026 → ongoing" },
      { offering: "Certification Program", estimated_value: "$200K–$500K", timeline: "Q4 2026 → ongoing" }
    ],
    total_pipeline: "$1.48M–$5.05M over 18 months",
    proof_points: [
      { customer: "Bell Canada", industry: "Telecom", metric: "67% increase in cloud sales", demonstrates: "Revenue impact from workforce transformation" },
      { customer: "Fortinet", industry: "Technology", metric: "83% sales opportunity increase in Year 2", demonstrates: "Compounding returns from training investment" },
      { customer: "Forrester TEI", industry: "Cross-industry", metric: "229% ROI, <6 month payback", demonstrates: "Third-party validated ROI" }
    ]
  },

  "Oceanic Capital Corporation::CTO": {
    persona: "CTO", persona_name: "David Park", persona_title: "Chief Technology Officer",
    narrative: "David Park has been writing on LinkedIn about building cloud-native teams — he's living this challenge every day. He needs 200+ engineers cloud-ready in 18 months for the core banking migration, and the external market simply cannot deliver that volume of cloud-skilled financial services talent. His 89 open roles are growing at 156% year-over-year. Every unfilled role is a delay risk on the $2B migration. David doesn't need a training catalog — he needs a capability-building engine that produces cloud-native engineers at scale.",
    conversation_starters: [
      "David, your post on building cloud-native teams resonated with a lot of CTOs we work with. You mentioned needing 200+ engineers cloud-ready in 18 months. UNSW achieved a 70% skill uplift and 54% growth in AWS proficiency through a structured program. That's the kind of acceleration that changes a migration timeline.",
      "Every one of those 89 open roles represents a delay risk on your core banking migration. CloudCall reduced their time-to-market by 50% after investing in structured cloud training. What if you could close the skills gap faster than the recruiting gap?",
      "Your engineers on Glassdoor are asking for cloud training paths. That's actually good news — it means the motivation is there. The gap is structure, not desire. Role-based learning paths aligned to your migration workstreams can turn that motivation into capability."
    ],
    recommended_plays: [
      { play_name: "Role-Based Learning Paths", description: "Cloud Architect, Security Engineer, Data Engineer, AI/ML Specialist tracks aligned to core banking migration roles" },
      { play_name: "Skill Builder Team Subscription (500-seat pilot)", description: "Immediate access for engineering teams working on the migration" },
      { play_name: "AWS Certification Milestone Program", description: "Solutions Architect Professional and Security Specialty for core migration team" },
      { play_name: "Private Training (ILT)", description: "Financial services-specific cloud architecture, security compliance, and AI/ML for risk analytics" }
    ],
    revenue_estimate: [
      { offering: "Role-Based Learning Paths Design", estimated_value: "$75K–$150K", timeline: "Q3 2026" },
      { offering: "Skill Builder Team Subscription (500 seats)", estimated_value: "$250K–$500K", timeline: "Q3 2026" },
      { offering: "Private Training ILT", estimated_value: "$300K–$600K", timeline: "Q3–Q4 2026" },
      { offering: "Certification Program", estimated_value: "$200K–$500K", timeline: "Q4 2026 → ongoing" }
    ],
    total_pipeline: "$825K–$1.75M over 12 months",
    proof_points: [
      { customer: "UNSW", industry: "Education", metric: "70% skill uplift, 54% AWS proficiency growth", demonstrates: "Measurable capability building" },
      { customer: "CloudCall", industry: "Technology", metric: "50% reduction in time-to-market", demonstrates: "Delivery acceleration" },
      { customer: "Forrester TEI", industry: "Cross-industry", metric: "229% ROI, <6 month payback", demonstrates: "Third-party validated ROI" }
    ]
  },

  "Oceanic Capital Corporation::CFO": {
    persona: "CFO", persona_name: "Michael Torres", persona_title: "Chief Financial Officer",
    narrative: "Michael Torres is overseeing the largest technology investment in OCC's history — a $2B cloud migration backed by a $200M PPA. The board is watching every dollar. What Michael needs to see is that workforce development isn't an additional cost — it's the multiplier that determines whether that $2B investment delivers on time and on budget. Every month of delay caused by skills gaps costs more than the entire training program. Forrester has quantified this: 229% ROI with payback in under 6 months.",
    conversation_starters: [
      "Michael, you're overseeing a $2B migration with a $200M PPA. Forrester quantifies that structured AWS training delivers 229% ROI with payback in under 6 months. The question isn't whether you can afford to invest in workforce development — it's whether you can afford not to.",
      "Every unfilled cloud role is a delay risk on your migration timeline. The cost of a 6-month delay on a $2B program dwarfs the cost of building internal capability. How are you factoring workforce readiness into your migration financial model?",
      "Your board asked about workforce readiness. That's a CFO opportunity: present a workforce investment plan with Forrester-validated ROI data, and you turn a board concern into a board-approved strategic initiative."
    ],
    recommended_plays: [
      { play_name: "Custom ROI Model for OCC", description: "Cost of external hiring vs. internal upskilling; migration delay risk quantification; Forrester framework applied to OCC's specific context" },
      { play_name: "Board Briefing Package", description: "'The Workforce Multiplier: How Training Investment Accelerates Cloud Migration ROI' — gives Michael ammunition for board conversations" },
      { play_name: "Phased Investment Plan", description: "Start with 500-seat pilot, measure results, expand to enterprise — de-risks the investment for the CFO" },
      { play_name: "Migration Delay Risk Analysis", description: "Quantify the cost of skills-gap-driven delays vs. the cost of structured training" }
    ],
    revenue_estimate: [
      { offering: "Custom ROI Model & Board Briefing", estimated_value: "$50K–$100K", timeline: "Q3 2026" },
      { offering: "Skill Builder Pilot (500 seats)", estimated_value: "$250K–$500K", timeline: "Q3 2026" },
      { offering: "Enterprise Expansion (5,000 seats)", estimated_value: "$1M–$2.5M", timeline: "Q1 2027" },
      { offering: "Certification Program", estimated_value: "$200K–$500K", timeline: "Q4 2026 → ongoing" }
    ],
    total_pipeline: "$1.5M–$3.6M over 18 months",
    proof_points: [
      { customer: "Forrester TEI", industry: "Cross-industry", metric: "229% ROI, <6 month payback", demonstrates: "Third-party validated ROI" },
      { customer: "Bell Canada", industry: "Telecom", metric: "67% increase in cloud sales", demonstrates: "Revenue impact from workforce transformation" },
      { customer: "Fortinet", industry: "Technology", metric: "83% sales opportunity increase in Year 2", demonstrates: "Compounding returns" }
    ]
  },

  // ── NordicRetail ──────────────────────────────────────
  "NordicRetail Group::CFO": {
    persona: "CFO", persona_name: "Astrid Johansson", persona_title: "Chief Financial Officer",
    narrative: "Astrid Johansson published a thought piece on measuring enterprise AI ROI — she's actively thinking about this problem. The current 200-seat Skill Builder subscription at 34% activation looks like waste on a CFO's spreadsheet. But the problem is not the product — it's the organizational commitment. If Astrid sees that structured programs deliver 229% ROI and the low activation is fixable, the renewal becomes an expansion conversation, not a cancellation risk.",
    conversation_starters: [
      "Astrid, your thought piece on measuring AI investment ROI was insightful. One dimension organizations miss is the workforce multiplier — Forrester quantifies 229% ROI with payback in under 6 months. How are you factoring workforce readiness into your AI investment business case?",
      "I want to be transparent: your current Skill Builder subscription is at 34% activation. That's not a product problem; it's a program design problem. Organizations with structured programs — dedicated learning time, manager accountability, milestone goals — see activation rates above 80%. The difference between 34% and 80% is the difference between a cost line and a strategic investment.",
      "Your board is asking about EU AI Act compliance. One requirement for high-risk AI systems is documented workforce competency. A structured AWS training program doesn't just build skills — it creates the compliance documentation your board needs. That's ROI on two dimensions."
    ],
    recommended_plays: [
      { play_name: "Subscription Health Review", description: "Present the 34% activation data with a clear remediation plan showing what 80%+ looks like and its business impact" },
      { play_name: "Renewal + Expansion Proposal", description: "Renew 200 seats and expand to 1,000 with structured program design including dedicated learning time and manager dashboards" },
      { play_name: "Custom ROI Model for NordicRetail", description: "Cost of external hiring vs. internal upskilling; productivity gains; EU AI Act compliance value; GenAI initiative timeline impact" },
      { play_name: "Board Briefing Offer", description: "'The Workforce Multiplier: How Training Investment Accelerates AI ROI' — gives Astrid ammunition for board conversations" }
    ],
    revenue_estimate: [
      { offering: "Skill Builder Renewal (200 seats) + Expansion (800)", estimated_value: "$150K–$500K", timeline: "Q4 2026" },
      { offering: "Subscription Health Review & Program Redesign", estimated_value: "$25K–$50K", timeline: "Q3 2026" },
      { offering: "Executive AI Literacy Workshop", estimated_value: "$20K–$35K", timeline: "Q3 2026" },
      { offering: "EU AI Act Compliance Training", estimated_value: "$100K–$250K", timeline: "Q4 2026" }
    ],
    total_pipeline: "$295K–$835K over 12 months",
    proof_points: [
      { customer: "Forrester TEI", industry: "Cross-industry", metric: "229% ROI, <6 month payback", demonstrates: "Third-party validated ROI" },
      { customer: "Bell Canada", industry: "Telecom", metric: "67% increase in cloud sales", demonstrates: "Revenue impact" },
      { customer: "Fortinet", industry: "Technology", metric: "83% sales opportunity increase in Year 2", demonstrates: "Compounding returns" }
    ]
  },

  "NordicRetail Group::CEO": {
    persona: "CEO", persona_name: "Erik Lindqvist", persona_title: "Chief Executive Officer",
    narrative: "Erik Lindqvist spoke at NRF Europe about Building the Retail Workforce of 2030. He understands that technology alone will not win. But his internal Future Skills initiative is limited to 50 people out of 28,000. He needs a partner who can help him scale that vision to the entire organization, while competitors H&M and Zalando are already moving aggressively on AI upskilling.",
    conversation_starters: [
      "Erik, your NRF Europe keynote on building the Retail Workforce of 2030 was compelling. You've articulated the vision — now the question is execution at scale. Your Future Skills initiative is reaching 50 people. How do you get to 28,000? AWS helped Holcim achieve 85% participation across their global workforce in Year 1.",
      "H&M and Zalando have both launched enterprise-wide AI upskilling programs. The retail talent war is not just about compensation — it's about who offers the best growth opportunities. Positioning NordicRetail as the place where people build the skills of the future is a competitive advantage that compounds over time.",
      "The EU AI Act is creating a new imperative: documented workforce competency for AI systems. The companies that get ahead of this will not just be compliant — they will be trusted. AWS can help NordicRetail be the European retail leader in responsible AI workforce readiness."
    ],
    recommended_plays: [
      { play_name: "NordicRetail Skills Transformation Partnership", description: "Position AWS T&C as the strategic partner for Erik's Retail Workforce of 2030 vision; co-branded initiative" },
      { play_name: "Enterprise-Wide Skills Guild", description: "Scale Future Skills from 50 to 28,000 with role-based tracks: supply chain AI, omnichannel personalization, data analytics, sustainability analytics, EU AI Act compliance" },
      { play_name: "Executive AI Literacy Program", description: "For the C-suite and board; addresses EU AI Act governance requirements and builds leadership confidence" },
      { play_name: "Competitive Benchmarking", description: "Show Erik where NordicRetail stands vs. H&M and Zalando on workforce AI readiness" }
    ],
    revenue_estimate: [
      { offering: "NordicRetail Skills Guild (enterprise-wide)", estimated_value: "$400K–$1.2M", timeline: "Q1 2027 → ongoing" },
      { offering: "Executive AI Literacy Workshop", estimated_value: "$20K–$35K", timeline: "Q3 2026" },
      { offering: "EU AI Act Compliance Training", estimated_value: "$100K–$250K", timeline: "Q4 2026" },
      { offering: "Certification Program (1,000+ target)", estimated_value: "$100K–$250K", timeline: "Q1 2027 → ongoing" }
    ],
    total_pipeline: "$620K–$1.74M over 18 months",
    proof_points: [
      { customer: "Holcim", industry: "Industrial", metric: "85% participation, 38% team growth", demonstrates: "Enterprise-wide scale" },
      { customer: "Bell Canada", industry: "Telecom", metric: "67% increase in cloud sales", demonstrates: "Revenue impact" },
      { customer: "Forrester TEI", industry: "Cross-industry", metric: "229% ROI, <6 month payback", demonstrates: "Third-party validated ROI" }
    ]
  },

  "NordicRetail Group::CTO": {
    persona: "CTO", persona_name: "Magnus Eriksson", persona_title: "Chief Technology Officer",
    narrative: "Magnus Eriksson is leading NordicRetail's GenAI supply chain pilot and the AI personalization integration from their recent acquisition. He's got ambitious technology bets running — but his teams are stretched. 38 open cloud/AI roles growing at 52% YoY, and the data engineers he does have are being poached by fintech. Magnus needs his existing teams to level up fast, especially with EU AI Act compliance requirements looming over the supply chain pilot.",
    conversation_starters: [
      "Magnus, your GenAI supply chain pilot is ambitious — and the EU AI Act means your team needs documented competency for high-risk AI systems. UNSW achieved a 70% skill uplift through structured AWS training. That's the kind of acceleration that keeps a pilot on track and compliant.",
      "You acquired an AI personalization startup in February. Integration is always a skills challenge — different tech stacks, different practices. Role-based learning paths can accelerate that integration and get both teams speaking the same cloud-native language.",
      "Your data engineers are being recruited by fintech. CloudCall reduced time-to-market by 50% after investing in structured training — and their retention improved because engineers saw a growth path. The best retention strategy is a development strategy."
    ],
    recommended_plays: [
      { play_name: "Role-Based Learning Paths", description: "Supply chain AI, personalization engineering, data analytics, EU AI Act compliance tracks" },
      { play_name: "Skill Builder Expansion (200 → 500 seats)", description: "Expand beyond current 200 seats with structured activation program to fix the 34% plateau" },
      { play_name: "Private Training (ILT)", description: "GenAI supply chain architecture, EU AI Act compliance for technical teams" },
      { play_name: "Certification Milestone Program", description: "ML Specialty and Solutions Architect for core GenAI teams" }
    ],
    revenue_estimate: [
      { offering: "Skill Builder Expansion (300 additional seats)", estimated_value: "$75K–$150K", timeline: "Q3 2026" },
      { offering: "Private Training ILT (GenAI teams)", estimated_value: "$75K–$150K", timeline: "Q3–Q4 2026" },
      { offering: "EU AI Act Compliance Training", estimated_value: "$100K–$250K", timeline: "Q4 2026" },
      { offering: "Certification Program", estimated_value: "$50K–$100K", timeline: "Q4 2026 → ongoing" }
    ],
    total_pipeline: "$300K–$650K over 12 months",
    proof_points: [
      { customer: "UNSW", industry: "Education", metric: "70% skill uplift, 54% AWS proficiency growth", demonstrates: "Measurable capability building" },
      { customer: "CloudCall", industry: "Technology", metric: "50% reduction in time-to-market", demonstrates: "Delivery acceleration" },
      { customer: "LTIMindtree", industry: "IT Services", metric: "40,000+ employees trained", demonstrates: "Scale" }
    ]
  },

  "NordicRetail Group::CHRO": {
    persona: "CHRO", persona_name: "Ingrid Bergstrom", persona_title: "Chief People Officer",
    narrative: "Ingrid Bergstrom is publicly talking about the European tech talent crisis and the need for internal upskilling. She's losing her best data engineers to fintech competitors, and her Future Skills initiative — while well-intentioned — reaches only 50 people out of 28,000. The Glassdoor insight is critical: employees say 'Skill Builder access is great but no time allocated for learning.' The product is valued but the organizational commitment to learning time is missing. Ingrid needs a partner who can help her design a program, not just provide a platform.",
    conversation_starters: [
      "Ingrid, your posts about the European tech talent crisis resonate deeply. You're right that internal upskilling is the answer — but your Future Skills initiative is reaching 50 people out of 28,000. Holcim achieved 85% participation across their global workforce. The difference? Dedicated learning time, manager accountability, and milestone-based progression.",
      "Your Glassdoor reviews tell an important story: employees love having Skill Builder access but say there's no time allocated for learning. That's not a product problem — it's a program design problem. And it's fixable. Organizations that allocate just 2 hours per week to structured learning see activation rates above 80%.",
      "You're losing data engineers to fintech. The research is clear: employer-funded training is the strongest predictor of retention intention — stronger than compensation. Positioning NordicRetail as the place where people build AI skills is your most powerful retention tool."
    ],
    recommended_plays: [
      { play_name: "Learning Needs Assessment", description: "Map the skills gap across NordicRetail's 28,000 employees against GenAI, supply chain, and EU AI Act requirements" },
      { play_name: "Program Redesign for Activation", description: "Fix the 34% activation rate with dedicated learning time, manager dashboards, and milestone-based progression" },
      { play_name: "NordicRetail Future Skills Academy (Skills Guild)", description: "Scale from 50 to 28,000 with role-based tracks and career development paths" },
      { play_name: "Retention Impact Analysis", description: "Quantify the retention value of structured training vs. the cost of losing data engineers to fintech" }
    ],
    revenue_estimate: [
      { offering: "Learning Needs Assessment", estimated_value: "$50K–$100K", timeline: "Q3 2026" },
      { offering: "Program Redesign & Activation Fix", estimated_value: "$25K–$50K", timeline: "Q3 2026" },
      { offering: "Skills Guild (enterprise-wide)", estimated_value: "$400K–$1.2M", timeline: "Q1 2027 → ongoing" },
      { offering: "Skill Builder Renewal + Expansion", estimated_value: "$150K–$500K", timeline: "Q4 2026" }
    ],
    total_pipeline: "$625K–$1.85M over 18 months",
    proof_points: [
      { customer: "Holcim", industry: "Industrial", metric: "85% participation, 38% team growth", demonstrates: "Enterprise-wide engagement" },
      { customer: "LTIMindtree", industry: "IT Services", metric: "40,000+ employees trained", demonstrates: "Scale is achievable" },
      { customer: "Forrester TEI", industry: "Cross-industry", metric: "229% ROI, <6 month payback", demonstrates: "Validated ROI" }
    ]
  },

  // ── MedVista ──────────────────────────────────────────
  "MedVista Health Systems::CHRO": {
    persona: "CHRO", persona_name: "Karen Mitchell", persona_title: "Chief People Officer",
    narrative: "Karen Mitchell is the internal champion. She launched the Future Skills Academy and she's posting on LinkedIn about building the Healthcare Workforce of 2030. She has executive sponsorship, she has budget intent, and she has urgency — 67 open cloud/AI roles and a $450M transformation that needs skilled people yesterday. Karen is the entry point for the largest T&C greenfield opportunity in the healthcare sector. She doesn't need to be convinced that training matters. She needs a partner who can help her build the program at the scale and speed her CEO demands.",
    conversation_starters: [
      "Karen, your Future Skills Academy is exactly the right initiative at exactly the right time. The question is scale and speed. Holcim achieved 85% participation across their global workforce in Year 1 with a structured AWS program. How do we help you get from academy launch to enterprise-wide impact?",
      "Your CIO has 67 open cloud/AI roles he can't fill. LTIMindtree trained 40,000+ employees through a structured AWS program. The fastest path to closing James's talent gap runs through your Future Skills Academy — not through the recruiting pipeline.",
      "You're building something that could become a model for the entire healthcare industry. Mayo Clinic and Kaiser Permanente are investing in AI workforce development, but nobody has cracked the code on healthcare-specific cloud training at scale. MedVista could be the proof point."
    ],
    recommended_plays: [
      { play_name: "MedVista Digital Health Academy (Skills Guild)", description: "Partner with Karen to build the enterprise-wide academy with healthcare-specific tracks" },
      { play_name: "Learning Needs Assessment", description: "Map skills gaps across clinical informatics, cloud infrastructure, AI/ML, and HIPAA compliance" },
      { play_name: "Skill Builder Team Subscription (200-seat pilot)", description: "Immediate access for IT teams working on the EHR migration" },
      { play_name: "Healthcare-Specific Private Training", description: "HIPAA compliance on AWS, clinical AI applications, healthcare data architecture" }
    ],
    revenue_estimate: [
      { offering: "Learning Needs Assessment (enterprise-wide)", estimated_value: "$75K–$150K", timeline: "Q3 2026" },
      { offering: "Skill Builder Team Subscription (200 → 2,000)", estimated_value: "$100K–$1M", timeline: "Q3 2026 → Q2 2027" },
      { offering: "MedVista Digital Health Academy", estimated_value: "$500K–$1.5M", timeline: "Q4 2026 → ongoing" },
      { offering: "Private Training ILT", estimated_value: "$200K–$400K", timeline: "Q3–Q4 2026" },
      { offering: "Certification Program", estimated_value: "$150K–$300K", timeline: "Q4 2026 → ongoing" }
    ],
    total_pipeline: "$1.03M–$3.35M over 18 months",
    proof_points: [
      { customer: "Holcim", industry: "Industrial", metric: "85% participation, 38% team growth", demonstrates: "Enterprise-wide scale" },
      { customer: "LTIMindtree", industry: "IT Services", metric: "40,000+ employees trained", demonstrates: "Large-scale transformation" },
      { customer: "UNSW", industry: "Education", metric: "70% skill uplift", demonstrates: "Measurable capability building" }
    ]
  },

  "MedVista Health Systems::CEO": {
    persona: "CEO", persona_name: "Dr. Patricia Morales", persona_title: "Chief Executive Officer",
    narrative: "Dr. Patricia Morales has staked MedVista's future on a $450M digital health transformation. She's said publicly that AI will transform patient outcomes — but only if the workforce is ready. That qualifier is important. It means she understands the people dimension. But understanding and executing are different things. Her CIO can't find talent, her CHRO is building an academy from scratch, and competitors Mayo Clinic and Kaiser are moving fast. Patricia needs to see that AWS isn't just a technology partner — it's the workforce transformation partner that makes the $450M bet pay off.",
    conversation_starters: [
      "Dr. Morales, you've said AI will transform patient outcomes — but only if the workforce is ready. That's the insight most CEOs miss. Bell Canada saw a 67% increase in cloud sales after investing in structured workforce development. For MedVista, the workforce multiplier could be the difference between a successful $450M transformation and a delayed one.",
      "Mayo Clinic and Kaiser Permanente are investing heavily in AI workforce development. The healthcare organizations that build internal capability fastest will define the standard of care for the next decade. MedVista has the vision — AWS can provide the execution engine.",
      "Your CHRO's Future Skills Academy is the right foundation. The question is how fast you can scale it. AWS helped Holcim achieve 85% participation across their global workforce. Imagine what that looks like for MedVista's clinical and technical teams."
    ],
    recommended_plays: [
      { play_name: "MedVista Skills Transformation Partnership", description: "Position AWS T&C as the strategic partner for the $450M digital health transformation workforce strategy" },
      { play_name: "Executive AI Literacy Program", description: "For the C-suite, board, and clinical leadership; builds confidence in AI governance for healthcare" },
      { play_name: "Enterprise-Wide Digital Health Academy", description: "Scale the Future Skills Academy with healthcare-specific tracks across all departments" },
      { play_name: "Competitive Benchmarking", description: "Show where MedVista stands vs. Mayo Clinic and Kaiser on workforce AI readiness" }
    ],
    revenue_estimate: [
      { offering: "Skills Transformation Partnership", estimated_value: "$500K–$1.5M", timeline: "Q4 2026 → ongoing" },
      { offering: "Executive AI Literacy (C-suite + Board)", estimated_value: "$25K–$40K", timeline: "Q3 2026" },
      { offering: "Digital Health Academy", estimated_value: "$500K–$1.5M", timeline: "Q4 2026 → ongoing" },
      { offering: "Certification Program", estimated_value: "$150K–$300K", timeline: "Q4 2026 → ongoing" }
    ],
    total_pipeline: "$1.18M–$3.34M over 18 months",
    proof_points: [
      { customer: "Bell Canada", industry: "Telecom", metric: "67% increase in cloud sales", demonstrates: "Revenue impact" },
      { customer: "Holcim", industry: "Industrial", metric: "85% participation", demonstrates: "Enterprise-wide scale" },
      { customer: "Forrester TEI", industry: "Cross-industry", metric: "229% ROI, <6 month payback", demonstrates: "Validated ROI" }
    ]
  },

  "MedVista Health Systems::CIO": {
    persona: "CIO", persona_name: "James Richardson", persona_title: "Chief Information Officer",
    narrative: "James Richardson is leading the most complex technology project in MedVista's history. He's publicly shared his frustration about finding cloud-certified healthcare IT talent. His 67 open cloud/AI roles represent a bottleneck that could delay the entire $450M initiative. He needs to build internal capability fast, and he cannot hire his way out of this problem.",
    conversation_starters: [
      "James, you've shared publicly about the challenge of finding cloud-certified healthcare IT talent. What if you could build that capability internally — faster and at lower cost than competing in the external talent market?",
      "UNSW achieved a 70% skill uplift and 54% growth in AWS proficiency through a structured program. For MedVista, that could mean the difference between a 2027 go-live and a 2028 delay.",
      "Your 67 open roles are growing at 89% year-over-year. Every unfilled position is a delay risk on the EHR migration. CloudCall reduced their time-to-market by 50% after investing in structured cloud training. The fastest path to your go-live runs through your existing teams."
    ],
    recommended_plays: [
      { play_name: "Role-Based Learning Paths", description: "Cloud Architect, Security Engineer, Data Engineer, Clinical Informaticist tracks aligned to EHR migration roles" },
      { play_name: "Skill Builder Team Subscription (200-seat pilot)", description: "Immediate access for IT teams currently working on the migration" },
      { play_name: "AWS Certification Milestone Program", description: "Solutions Architect Professional and Security Specialty for core migration team; Cloud Practitioner for all IT staff" },
      { play_name: "Private Training (ILT)", description: "Healthcare-specific cloud architecture, HIPAA compliance on AWS, and AI/ML for clinical applications" }
    ],
    revenue_estimate: [
      { offering: "Learning Needs Assessment", estimated_value: "$75K–$150K", timeline: "Q3 2026" },
      { offering: "Skill Builder Team Subscription (200-seat pilot)", estimated_value: "$100K–$200K", timeline: "Q3 2026" },
      { offering: "Private Training ILT", estimated_value: "$200K–$400K", timeline: "Q3–Q4 2026" },
      { offering: "Certification Program", estimated_value: "$150K–$300K", timeline: "Q4 2026 → ongoing" }
    ],
    total_pipeline: "$525K–$1.05M over 12 months",
    proof_points: [
      { customer: "UNSW", industry: "Education", metric: "70% skill uplift, 54% AWS proficiency growth", demonstrates: "Measurable capability building" },
      { customer: "CloudCall", industry: "Technology", metric: "50% reduction in time-to-market", demonstrates: "Delivery acceleration" },
      { customer: "Forrester TEI", industry: "Cross-industry", metric: "229% ROI, <6 month payback", demonstrates: "Validated ROI" }
    ]
  },

  "MedVista Health Systems::CFO": {
    persona: "CFO", persona_name: "Thomas Wright", persona_title: "Chief Financial Officer",
    narrative: "Thomas Wright needs to demonstrate ROI on MedVista's cloud investment to the board within 18 months. He's watching a $450M transformation and needs every dollar to count. The workforce dimension is the hidden variable in his financial model — skilled teams deliver faster, with fewer errors, and at lower cost than teams learning on the job. Forrester's 229% ROI framework gives Thomas the third-party validation he needs for the board.",
    conversation_starters: [
      "Thomas, you've said you need to demonstrate cloud investment ROI to the board within 18 months. Forrester quantifies that structured AWS training delivers 229% ROI with payback in under 6 months. That's the kind of data point that changes a board conversation.",
      "Every month of delay on the EHR migration caused by skills gaps costs more than the entire training program. How are you factoring workforce readiness into your transformation financial model?",
      "The build vs. buy math is compelling in healthcare: cloud-certified healthcare IT talent commands a 40-60% premium in the external market. Internal development is not just faster — it's significantly more cost-effective."
    ],
    recommended_plays: [
      { play_name: "Custom ROI Model for MedVista", description: "Cost of external hiring vs. internal upskilling; migration delay risk; HIPAA compliance training value" },
      { play_name: "Board Briefing Package", description: "'The Workforce Multiplier' — ROI framework applied to MedVista's $450M transformation" },
      { play_name: "Phased Investment Plan", description: "200-seat pilot → measure → expand; de-risks the investment" },
      { play_name: "Migration Delay Risk Analysis", description: "Quantify skills-gap-driven delay costs vs. training investment" }
    ],
    revenue_estimate: [
      { offering: "Custom ROI Model & Board Briefing", estimated_value: "$40K–$75K", timeline: "Q3 2026" },
      { offering: "Skill Builder Pilot (200 seats)", estimated_value: "$100K–$200K", timeline: "Q3 2026" },
      { offering: "Enterprise Expansion", estimated_value: "$500K–$1M", timeline: "Q1 2027" },
      { offering: "Certification Program", estimated_value: "$150K–$300K", timeline: "Q4 2026 → ongoing" }
    ],
    total_pipeline: "$790K–$1.58M over 18 months",
    proof_points: [
      { customer: "Forrester TEI", industry: "Cross-industry", metric: "229% ROI, <6 month payback", demonstrates: "Third-party validated ROI" },
      { customer: "Bell Canada", industry: "Telecom", metric: "67% increase in cloud sales", demonstrates: "Revenue impact" },
      { customer: "Fortinet", industry: "Technology", metric: "83% sales opportunity increase in Year 2", demonstrates: "Compounding returns" }
    ]
  }
};
