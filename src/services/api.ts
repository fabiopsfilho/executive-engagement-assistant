/**
 * API Service for the Executive Engagement Assistant
 * 
 * Connects the frontend to the Bedrock-powered Lambda backend.
 * Set VITE_API_URL in your .env file to point to your API Gateway endpoint.
 * 
 * When API_URL is not set, the app falls back to the local mock data.
 */

const API_URL = import.meta.env.VITE_API_URL || '';

export function isBackendAvailable(): boolean {
  return !!API_URL;
}

// ─── Load EBC Data from S3 ───────────────────────────────────────────────────

export async function loadEBCDataFromS3(): Promise<string | null> {
  if (!API_URL) return null;
  try {
    const response = await fetch(`${API_URL}/ebc-data`, {
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.csv || null;
  } catch {
    return null;
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EngagementPlanResponse {
  persona: string;
  persona_name: string;
  persona_title: string;
  narrative: string;
  conversation_starters: string[];
  recommended_plays: { play_name: string; description: string }[];
  revenue_estimate: { offering: string; estimated_value: string; timeline: string }[];
  total_pipeline: string;
  proof_points: { customer: string; industry: string; metric: string; demonstrates: string }[];
}

export interface IntelligenceResponse {
  earnings_call_signals: string[];
  linkedin_job_postings: { cloud_ai_roles: number; yoy_change: string };
  executive_social: { name: string; title: string; post_theme: string }[];
  glassdoor_signals: string[];
  industry_context: string;
  news_signals: string[];
  signals: { severity: 'HIGH' | 'MEDIUM'; label: string; evidence: string }[];
  tc_opportunity_score: number;
}

export interface AdvisorResponse {
  response: string;
  capability: string;
}

export interface RolePlayResponse {
  response: string;
  persona: string;
  personaType: string;
}

export interface AgendaBlock {
  time: string;
  duration: string;
  title: string;
  description: string;
  owner: string;
  type: 'welcome' | 'discovery' | 'insight' | 'demo' | 'workshop' | 'action' | 'break';
}

export interface AgendaResponse {
  title: string;
  subtitle: string;
  format: string;
  date: string;
  location: string;
  duration: string;
  blocks: AgendaBlock[];
  principles: string[];
  preparation: string[];
}

export interface PitchSlide {
  slideNumber: number;
  title: string;
  content: string;
  speakerNotes: string;
  type: 'title' | 'story' | 'data' | 'insight' | 'action' | 'close';
}

export interface PitchResponse {
  title: string;
  subtitle: string;
  duration: string;
  audience: string;
  slides: PitchSlide[];
}

// ─── API Calls ────────────────────────────────────────────────────────────────

async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || `API error: ${response.status}`);
  }

  return response.json();
}

async function get<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${API_URL}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const response = await fetch(url.toString(), {
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || `API error: ${response.status}`);
  }

  return response.json();
}

// ─── Engagement Plan Generation ───────────────────────────────────────────────

export async function generateEngagementPlan(
  accountData: unknown,
  persona: { name: string; title: string; persona: string },
  userNotes?: string[]
): Promise<EngagementPlanResponse> {
  return post<EngagementPlanResponse>('/accounts/default/engage', {
    accountData,
    persona,
    userNotes,
  });
}

// ─── Intelligence Aggregation ─────────────────────────────────────────────────

export async function getIntelligence(
  companyName: string,
  industry: string,
  awsSpend: number,
  executives?: string
): Promise<IntelligenceResponse> {
  return get<IntelligenceResponse>(`/accounts/${encodeURIComponent(companyName)}/intelligence`, {
    company: companyName,
    industry,
    awsSpend: String(awsSpend),
    ...(executives ? { executives } : {}),
  });
}

// ─── AI Advisor Chat ──────────────────────────────────────────────────────────

export async function sendAdvisorMessage(
  message: string,
  conversationHistory: { role: 'user' | 'assistant'; content: string }[],
  accountContext: {
    customer_name: string;
    industry: string;
    segment: string;
    aws_spend_current: number;
    ppa: string;
    account_plan_priority: string;
    open_opps: number;
    t2k: boolean;
    smgs_phase: string;
    tc_state: string;
    signals: { label: string; severity: string; evidence: string }[];
    public_intelligence_summary: string;
  },
  selectedPersona?: { name: string; title: string; persona: string },
  capability?: string
): Promise<AdvisorResponse> {
  return post<AdvisorResponse>('/accounts/default/advisor', {
    message,
    conversationHistory,
    accountContext,
    selectedPersona,
    capability,
  });
}

// ─── Role-Play Engine ─────────────────────────────────────────────────────────

export async function sendRolePlayMessage(
  message: string,
  conversationHistory: { role: 'user' | 'assistant'; content: string }[],
  persona: { name: string; title: string; persona: string },
  accountContext: {
    customer_name: string;
    industry: string;
    aws_spend_current: number;
    ppa: string;
    account_plan_priority: string;
    open_opps: number;
    linkedin_roles: number;
    linkedin_yoy: string;
    executive_social_theme?: string;
    glassdoor_signals: string[];
    earnings_signals: string[];
    tc_state: string;
    industry_context: string;
  }
): Promise<RolePlayResponse> {
  return post<RolePlayResponse>('/accounts/default/roleplay', {
    message,
    conversationHistory,
    persona,
    accountContext,
  });
}

// ─── Agenda Generation ────────────────────────────────────────────────────────

export async function generateAgenda(
  accountContext: {
    customer_name: string;
    industry: string;
    account_plan_priority: string;
    attendees: { name: string; title: string; persona: string }[];
    ebc_date: string;
    ebc_location: string;
    ebc_themes: string[];
    tc_state: string;
    signals_summary: string;
    public_intelligence_summary: string;
  },
  format: 'ebc' | 'training-session',
  persona?: { name: string; title: string; persona: string },
  userNotes?: string[]
): Promise<AgendaResponse> {
  return post<AgendaResponse>('/accounts/default/agenda', {
    accountContext,
    format,
    persona,
    userNotes,
  });
}

// ─── Pitch Deck Generation ───────────────────────────────────────────────────

export async function generatePitchDeck(
  accountContext: {
    customer_name: string;
    industry: string;
    segment: string;
    aws_spend_current: number;
    ppa: string;
    account_plan_priority: string;
    linkedin_roles: number;
    linkedin_yoy: string;
    tc_state: string;
    earnings_signals: string[];
    executive_social: { name: string; title: string; post_theme: string }[];
    glassdoor_signals: string[];
    industry_context: string;
    news_signals: string[];
  },
  persona: { name: string; title: string; persona: string },
  engagementPlan: {
    narrative: string;
    conversation_starters: string[];
    recommended_plays: { play_name: string; description: string }[];
    revenue_estimate: { offering: string; estimated_value: string; timeline: string }[];
    total_pipeline: string;
    proof_points: { customer: string; industry: string; metric: string; demonstrates: string }[];
  },
  userNotes?: string[]
): Promise<PitchResponse> {
  return post<PitchResponse>('/accounts/default/pitch', {
    accountContext,
    persona,
    engagementPlan,
    userNotes,
  });
}


// ─── T&C Opportunity Data ─────────────────────────────────────────────────────

export interface TCAccountSummary {
  accountId: string;
  accountName: string;
  totalPipeline: number;
  openOpportunities: number;
  closedWonRevenue: number;
  products: string[];
  subscriptionTypes: string[];
  totalStudents: number;
  isT2K: boolean;
}

export async function getTCData(accountId?: string): Promise<{ summaries?: TCAccountSummary[]; summary?: TCAccountSummary | null }> {
  if (!API_URL) return { summaries: [] };
  try {
    const url = accountId
      ? `${API_URL}/tc-data?accountId=${encodeURIComponent(accountId)}`
      : `${API_URL}/tc-data`;
    const response = await fetch(url, { headers: { 'Content-Type': 'application/json' } });
    if (!response.ok) return { summaries: [] };
    return response.json();
  } catch {
    return { summaries: [] };
  }
}

// ─── Account Insights (AI-Generated) ─────────────────────────────────────────

export interface AccountInsightsResponse {
  who_to_focus: string;
  what_conversations: string;
  where_to_start: string;
  whats_happening: string;
}

export async function generateAccountInsights(
  accountData: unknown,
  tcData?: TCAccountSummary | null
): Promise<AccountInsightsResponse> {
  return post<AccountInsightsResponse>('/accounts/default/insights', {
    accountData,
    tcData,
  });
}

// ─── Account Buzz/Now (AI-Generated) ─────────────────────────────────────────

export interface BuzzNowResponse {
  buzz_summary: string;
  buzz_executive_insights: string[];
  buzz_hiring_analysis: string;
  buzz_sentiment_analysis: string;
  now_focus: string;
  now_initiatives: string[];
  now_key_asks: string[];
  now_opening_move: string;
}

export async function generateBuzzNow(
  accountData: unknown,
  tcData?: TCAccountSummary | null
): Promise<BuzzNowResponse> {
  return post<BuzzNowResponse>('/accounts/default/buzz', {
    accountData,
    tcData,
  });
}

// ─── Account Next Steps & Key Asks (AI-Generated) ────────────────────────────

export interface NextStepsResponse {
  next_steps: string[];
  key_asks: string[];
}

export async function generateNextStepsAndAsks(
  accountData: unknown,
  tcData?: TCAccountSummary | null
): Promise<NextStepsResponse> {
  return post<NextStepsResponse>('/accounts/default/next-steps', {
    accountData,
    tcData,
  });
}


// ─── Persona Intelligence ─────────────────────────────────────────────────────

export interface PersonaIntelResponse {
  name: string;
  title: string;
  company: string;
  linkedin_summary: string;
  recent_activity: string[];
  interests: string[];
  engagement_angle: string;
  is_aws_champion: boolean;
}

export async function getPersonaIntel(
  personaName: string,
  personaTitle: string,
  company: string,
  industry: string,
  linkedinUrl?: string
): Promise<PersonaIntelResponse> {
  return post<PersonaIntelResponse>('/accounts/default/persona-intel', {
    personaName,
    personaTitle,
    company,
    industry,
    linkedinUrl,
  });
}
