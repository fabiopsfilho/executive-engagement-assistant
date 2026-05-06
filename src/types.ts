export interface Attendee {
  name: string;
  title: string;
  persona: 'CEO' | 'CFO' | 'CIO' | 'CTO' | 'CHRO' | 'Other';
}

export interface Account {
  customer_name: string;
  industry: string;
  segment: string;
  geo: string;
  sfdcAccountId?: string;
  aws_spend: {
    current_year: number;
    prior_year: number;
    ppa: string;
  };
  sfdc_data: {
    open_opps: number;
    t2k: boolean;
    account_plan_priority: string;
    smgs_phase: string;
  };
  ebc_data: {
    ebc_id: string;
    meeting_dates: string[];
    themes: string[];
    attendees: Attendee[];
    location: string;
    requestor: string;
    status?: string;
  };
  tc_current_state: {
    skill_builder: boolean;
    skill_builder_seats: number;
    activation_rate: number;
    certifications: number;
    prior_engagement: string;
    renewal_date: string;
  };
  public_intelligence: {
    earnings_call_signals: string[];
    linkedin_job_postings: { cloud_ai_roles: number; yoy_change: string };
    executive_social: { name: string; title: string; post_theme: string; url?: string }[];
    glassdoor_signals: string[];
    industry_context: string;
    news_signals: string[];
  };
  tc_opportunity_score: number;
  signals: Signal[];
}

export interface Signal {
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  label: string;
  evidence: string;
}

export interface RevenueItem {
  offering: string;
  estimated_value: string;
  timeline: string;
}

export interface ProofPoint {
  customer: string;
  industry: string;
  metric: string;
  demonstrates: string;
}

export interface EngagementPlan {
  persona: string;
  persona_name: string;
  persona_title: string;
  narrative: string;
  conversation_starters: string[];
  recommended_plays: { play_name: string; description: string }[];
  revenue_estimate: RevenueItem[];
  total_pipeline: string;
  proof_points: ProofPoint[];
}
