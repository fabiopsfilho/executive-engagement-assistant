import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { invokeClaudeText, BedrockMessage } from '../shared/bedrock';
import { success, error } from '../shared/response';

interface AdvisorRequest {
  message: string;
  conversationHistory: { role: 'user' | 'assistant'; content: string }[];
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
  };
  selectedPersona?: { name: string; title: string; persona: string };
  capability?: string; // coaching, intelligence, research, content, workflow, analytics
}

const SYSTEM_PROMPT = `You are the AWS Engagement Advisor — an expert AI assistant that helps AWS Account Managers and T&C Business Development Managers prepare for and execute executive engagements. You have deep expertise in:

1. AWS Training & Certification portfolio (Skill Builder, Skills Guild, Private Training, Certifications, LNA, Executive AI Literacy)
2. Executive engagement strategy and persona-based selling
3. T&C proof points: Bell Canada (67% cloud sales increase), Holcim (85% participation), UNSW (70% skill uplift), CloudCall (50% time-to-market reduction), Forrester TEI (229% ROI, <6 month payback), LTIMindtree (40,000+ trained), Fortinet (83% sales opp increase Year 2)
4. Objection handling for common pushbacks (no time, can hire, training hasn't worked, show ROI first)
5. Amazon Leadership Principles applied to selling (Customer Obsession, Working Backwards, Earn Trust, Bias for Action)

Your capabilities:
- COACHING: Role-play practice, objection handling, peer matching, conversation strategy
- INTELLIGENCE: Signal analysis, renewal risk assessment, competitive intel, account scoring
- RESEARCH: Pre-meeting briefs, industry trends, customer stories, executive profiles
- CONTENT: Leave-behinds, ROI models, proposal drafts, follow-up emails, one-pagers
- WORKFLOW: Follow-up plans, action tracking, meeting prep checklists
- ANALYTICS: Pattern analysis, approach benchmarking, win/loss insights

RULES:
1. Always ground your advice in the specific account data provided. Never be generic.
2. Reference specific data points (hiring numbers, earnings quotes, social posts) when making recommendations.
3. Be direct and actionable. Sellers need "do this" not "consider doing this."
4. When generating content (emails, proposals, leave-behinds), make it ready-to-use, not a template.
5. If asked about a persona, tailor your advice to what that specific executive type cares about.
6. Use proof points strategically — match them to the persona and industry.
7. Keep responses focused and practical. Sellers are busy.`;

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    if (!event.body) {
      return error(400, 'Request body is required');
    }

    const request: AdvisorRequest = JSON.parse(event.body);
    const { message, conversationHistory, accountContext, selectedPersona, capability } = request;

    if (!message || !accountContext) {
      return error(400, 'message and accountContext are required');
    }

    // Build context message
    const contextBlock = `
CURRENT ACCOUNT CONTEXT:
- Customer: ${accountContext.customer_name} (${accountContext.industry}, ${accountContext.segment})
- AWS Spend: $${(accountContext.aws_spend_current / 1_000_000).toFixed(1)}M | PPA: ${accountContext.ppa}
- Priority: ${accountContext.account_plan_priority}
- Pipeline: ${accountContext.open_opps} open opps | T2K: ${accountContext.t2k ? 'Yes' : 'No'} | Phase: ${accountContext.smgs_phase}
- T&C State: ${accountContext.tc_state}
- Signals: ${accountContext.signals.map(s => `[${s.severity}] ${s.label}: ${s.evidence}`).join('; ')}
- Intelligence Summary: ${accountContext.public_intelligence_summary}
${selectedPersona ? `\nSELECTED PERSONA: ${selectedPersona.name} (${selectedPersona.title}) — ${selectedPersona.persona}` : ''}
${capability ? `\nACTIVE CAPABILITY: ${capability}` : ''}`;

    // Build message history for Claude
    const messages: BedrockMessage[] = [];

    // Add conversation history
    if (conversationHistory && conversationHistory.length > 0) {
      for (const msg of conversationHistory.slice(-10)) { // Keep last 10 messages for context
        messages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content,
        });
      }
    }

    // Add current message with context
    messages.push({
      role: 'user',
      content: `${contextBlock}\n\nSELLER'S QUESTION: ${message}`,
    });

    const response = await invokeClaudeText(
      SYSTEM_PROMPT,
      messages,
      { maxTokens: 2048, temperature: 0.7 }
    );

    return success({
      response,
      capability: capability || 'general',
    });
  } catch (err) {
    console.error('Error in advisor chat:', err);
    return error(500, 'Failed to generate advisor response');
  }
}
