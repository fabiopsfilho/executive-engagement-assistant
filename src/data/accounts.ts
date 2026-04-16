import type { Account } from '../types';

export const accounts: Account[] = [
  {
    customer_name: "Oceanic Capital Corporation",
    industry: "Financial Services",
    segment: "STRAT",
    geo: "NAMER",
    aws_spend: { current_year: 42000000, prior_year: 35000000, ppa: "5yr/$200M (signed January 2026)" },
    sfdc_data: { open_opps: 12, t2k: true, account_plan_priority: "GenAI-Powered Risk Analytics & Cloud-Native Core Banking", smgs_phase: "Migrate" },
    ebc_data: {
      ebc_id: "EBC-2026-OCC-0612",
      meeting_dates: ["2026-06-12"],
      themes: ["GenAI for Risk Analytics & Fraud Detection", "Cloud-Native Core Banking Transformation", "Regulatory Compliance at Cloud Scale", "Talent Strategy for AI-First Organization"],
      attendees: [
        { name: "Sarah Chen", title: "Chief Executive Officer", persona: "CEO" },
        { name: "Michael Torres", title: "Chief Financial Officer", persona: "CFO" },
        { name: "David Park", title: "Chief Technology Officer", persona: "CTO" },
        { name: "Jennifer Williams", title: "Chief Human Resources Officer", persona: "CHRO" },
        { name: "Robert Kim", title: "Chief Risk Officer", persona: "Other" },
        { name: "Amanda Foster", title: "Chief Data Officer", persona: "Other" }
      ],
      location: "Seattle, WA — AWS EBC Center",
      requestor: "NAMER Financial Services Industry Team"
    },
    tc_current_state: { skill_builder: false, skill_builder_seats: 0, activation_rate: 0, certifications: 12, prior_engagement: "12 individual certifications (organic); no structured T&C engagement", renewal_date: "" },
    public_intelligence: {
      earnings_call_signals: [
        "CEO: We are making a generational bet on AI-powered risk analytics",
        "CFO: Cloud migration is our largest technology investment in company history",
        "CTO mentioned 200+ engineers need cloud-native skills within 18 months",
        "Board asked about workforce readiness for AI transformation"
      ],
      linkedin_job_postings: { cloud_ai_roles: 89, yoy_change: "+156%" },
      executive_social: [
        { name: "Sarah Chen", title: "CEO", post_theme: "The Future of AI in Financial Services — keynote at Davos" },
        { name: "Jennifer Williams", title: "CHRO", post_theme: "Why we're investing $50M in employee development this year" },
        { name: "David Park", title: "CTO", post_theme: "Building cloud-native teams: lessons from our first year" }
      ],
      glassdoor_signals: [
        "Engineers frustrated by lack of cloud training resources",
        "High demand for AI/ML skills but limited internal development paths",
        "Positive sentiment about company direction but concerns about skill gaps"
      ],
      industry_context: "Financial services sector facing unprecedented AI transformation pressure; JPMorgan, Goldman Sachs investing heavily in AI workforce development",
      news_signals: [
        "OCC announced $2B cloud migration program (Q1 2026)",
        "Partnered with AWS for core banking modernization",
        "Regulatory pressure on AI governance in financial services increasing"
      ]
    },
    tc_opportunity_score: 9,
    signals: [
      { severity: "HIGH", label: "Talent War", evidence: "89 open cloud/AI roles (+156% YoY); CTO needs 200+ engineers cloud-ready in 18 months" },
      { severity: "HIGH", label: "Board Pressure", evidence: "Board asked about workforce readiness; CEO making 'generational bet' on AI" },
      { severity: "HIGH", label: "Greenfield T&C", evidence: "Zero structured T&C engagement; only 12 organic certifications across 15,000 employees" },
      { severity: "MEDIUM", label: "Compliance Trigger", evidence: "AI governance requirements in financial services; regulatory scrutiny increasing" }
    ]
  },
  {
    customer_name: "MedVista Health Systems",
    industry: "Healthcare",
    segment: "ENT",
    geo: "NAMER",
    aws_spend: { current_year: 28000000, prior_year: 19500000, ppa: "3yr/$95M (signed Q4 2025)" },
    sfdc_data: { open_opps: 9, t2k: true, account_plan_priority: "AI-Powered Clinical Decision Support & EHR Cloud Migration", smgs_phase: "Migrate" },
    ebc_data: {
      ebc_id: "EBC-2026-MVH-0820",
      meeting_dates: ["2026-08-20"],
      themes: ["AI-Powered Clinical Decision Support", "EHR Cloud Migration at Scale", "HIPAA Compliance in Cloud-Native Architecture", "Building the Healthcare Technology Workforce of 2030"],
      attendees: [
        { name: "Dr. Patricia Morales", title: "Chief Executive Officer", persona: "CEO" },
        { name: "Thomas Wright", title: "Chief Financial Officer", persona: "CFO" },
        { name: "James Richardson", title: "Chief Information Officer", persona: "CIO" },
        { name: "Dr. Lisa Chang", title: "Chief Medical Information Officer", persona: "Other" },
        { name: "Karen Mitchell", title: "Chief People Officer", persona: "CHRO" },
        { name: "Steven Brooks", title: "VP of Cloud Infrastructure", persona: "CTO" }
      ],
      location: "New York, NY — AWS EBC Center",
      requestor: "NAMER Healthcare Industry Team"
    },
    tc_current_state: { skill_builder: false, skill_builder_seats: 0, activation_rate: 0, certifications: 8, prior_engagement: "8 individual certifications (organic); CHRO exploring enterprise training options", renewal_date: "" },
    public_intelligence: {
      earnings_call_signals: [
        "CEO: Our $450M digital health transformation will redefine patient care",
        "CFO: We need to demonstrate ROI on our cloud investment to the board within 18 months",
        "CIO publicly shared frustration about finding cloud-certified healthcare IT talent",
        "CHRO: We are launching a Future Skills Academy to build internal capability"
      ],
      linkedin_job_postings: { cloud_ai_roles: 67, yoy_change: "+89%" },
      executive_social: [
        { name: "Karen Mitchell", title: "CPO", post_theme: "Building the Healthcare Workforce of 2030 — why upskilling is our #1 priority" },
        { name: "Dr. Patricia Morales", title: "CEO", post_theme: "AI will transform patient outcomes — but only if our workforce is ready" },
        { name: "James Richardson", title: "CIO", post_theme: "The healthcare cloud talent crisis: why we can't hire our way out" }
      ],
      glassdoor_signals: [
        "IT teams want more structured cloud training",
        "Clinical informaticists seeking AI/ML skill development",
        "Positive culture but technology skills gap is a concern"
      ],
      industry_context: "Healthcare sector accelerating cloud adoption; Mayo Clinic and Kaiser Permanente investing heavily in AI workforce; HIPAA compliance complexity increasing with cloud-native architectures",
      news_signals: [
        "MedVista announced $450M digital health transformation (Q1 2026)",
        "Partnership with AWS for EHR cloud migration",
        "CHRO launched Future Skills Academy initiative (Q2 2026)"
      ]
    },
    tc_opportunity_score: 9,
    signals: [
      { severity: "HIGH", label: "CHRO-Led Initiative", evidence: "CHRO launching Future Skills Academy; actively exploring enterprise training" },
      { severity: "HIGH", label: "Talent War", evidence: "67 open cloud/AI roles (+89% YoY); CIO can't find cloud-certified healthcare IT talent" },
      { severity: "HIGH", label: "Greenfield T&C", evidence: "Zero structured T&C; only 8 organic certs; $450M transformation at risk without skilled workforce" },
      { severity: "MEDIUM", label: "Compliance Trigger", evidence: "HIPAA compliance at cloud scale requires specialized training" }
    ]
  },
  {
    customer_name: "NordicRetail Group",
    industry: "Retail / Manufacturing",
    segment: "ENT",
    geo: "EMEA",
    aws_spend: { current_year: 18500000, prior_year: 14200000, ppa: "3yr/$55M (signed March 2025)" },
    sfdc_data: { open_opps: 7, t2k: true, account_plan_priority: "GenAI-Powered Supply Chain Optimization & Omnichannel Personalization", smgs_phase: "Optimize" },
    ebc_data: {
      ebc_id: "EBC-2026-NRG-0715",
      meeting_dates: ["2026-07-15"],
      themes: ["GenAI for Supply Chain Optimization", "Omnichannel Customer Experience Personalization", "Sustainability & Carbon Footprint Analytics", "European AI Regulation (EU AI Act) Compliance"],
      attendees: [
        { name: "Erik Lindqvist", title: "CEO", persona: "CEO" },
        { name: "Astrid Johansson", title: "CFO", persona: "CFO" },
        { name: "Magnus Eriksson", title: "CTO", persona: "CTO" },
        { name: "Ingrid Bergstrom", title: "Chief People Officer", persona: "CHRO" },
        { name: "Lars Andersen", title: "Chief Supply Chain Officer", persona: "Other" },
        { name: "Katarina Nilsson", title: "Chief Data Officer", persona: "Other" }
      ],
      location: "London, UK — AWS EBC Center",
      requestor: "EMEA Retail Industry Team"
    },
    tc_current_state: { skill_builder: true, skill_builder_seats: 200, activation_rate: 34, certifications: 45, prior_engagement: "200-seat Skill Builder Team Subscription (purchased Q3 2025); plateaued at 34% activation", renewal_date: "2026-10-15" },
    public_intelligence: {
      earnings_call_signals: [
        "CEO: GenAI will redefine how we serve customers within 18 months",
        "CFO: need to demonstrate ROI on cloud and AI investments to the board",
        "Board asked about workforce readiness for EU AI Act compliance",
        "Chief People Officer: we are losing best data engineers to fintech competitors"
      ],
      linkedin_job_postings: { cloud_ai_roles: 38, yoy_change: "+52%" },
      executive_social: [
        { name: "Astrid Johansson", title: "CFO", post_theme: "Measuring ROI of Enterprise AI Investments" },
        { name: "Ingrid Bergstrom", title: "CPO", post_theme: "European tech talent crisis and need for internal upskilling" },
        { name: "Erik Lindqvist", title: "CEO", post_theme: "Keynote at NRF Europe: Building the Retail Workforce of 2030" }
      ],
      glassdoor_signals: [
        "Data teams: limited growth opportunities compared to fintech",
        "Skill Builder access is great but no time allocated for learning",
        "Requests for more structured career development paths in AI/ML"
      ],
      industry_context: "EU AI Act compliance deadline approaching; H&M Group and Zalando launched large-scale AI upskilling programs",
      news_signals: [
        "NordicRetail GenAI-powered supply chain pilot launched (Q1 2026)",
        "Acquired AI personalization startup (February 2026)",
        "EU AI Act: high-risk AI systems in supply chain require documented workforce competency"
      ]
    },
    tc_opportunity_score: 8,
    signals: [
      { severity: "HIGH", label: "Talent War", evidence: "Losing data engineers to fintech; 38 open cloud/AI roles (+52% YoY); CPO publicly discussing the talent crisis" },
      { severity: "HIGH", label: "Subscription Underperformance", evidence: "34% activation on 200 seats; renewal in 90 days; Glassdoor reveals 'no time allocated for learning'" },
      { severity: "HIGH", label: "EU AI Act Compliance", evidence: "GenAI supply chain pilot = high-risk AI system; requires documented workforce competency" },
      { severity: "MEDIUM", label: "Board Pressure", evidence: "Board asking about AI investment ROI and workforce readiness; CFO published thought piece on measuring AI ROI" }
    ]
  }
];
