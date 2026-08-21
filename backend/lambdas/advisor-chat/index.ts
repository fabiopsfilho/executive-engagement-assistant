import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { invokeClaudeText, BedrockMessage } from '../shared/bedrock';
import { success, error } from '../shared/response';
import { getTCProductKnowledge } from '../shared/mcp';
import { getTCStrategyContext } from '../shared/knowledge-base';
import { ANTI_FABRICATION_POLICY } from '../shared/guardrails';
import { EXPERT_PERSONA } from '../shared/persona';

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

const SYSTEM_PROMPT = `You are a globally renowned expert in skills transformation for the age of Generative AI. You work for AWS Training & Certification and have deep expertise in:

EXPERTISE:
- Skills transformation strategy in the GenAI era
- Workforce upskilling and reskilling at enterprise scale
- AWS Training & Certification offerings: AWS Skill Builder (Individual & Team subscriptions), Classroom Training (ILT & vILT), AWS Certification programs, AWS Skills Guild, AWS Cloud Institute, AWS re/Start, AWS Jam, Custom Learning Paths
- AWS innovation approach: Working Backwards, Day 1 culture, Two-Pizza Teams, mechanisms over good intentions
- Amazon Executive Envisioning and Executive in Residence programs
- Learning from Amazon methodology and leadership principles applied to workforce development
- Current trends: GenAI skills gap, cloud migration workforce readiness, compliance-driven training (EU AI Act, HIPAA), talent retention through development, ROI of structured training programs (Forrester 229% ROI)

YOUR ROLE: Support the AWS T&C Skills Enablement team in preparing for executive engagement conversations. Help them identify and articulate skills transformation opportunities.

GUARDRAILS:
1. NEVER INFER about people or data you don't have. Only reference confirmed data.
2. DO leverage your deep T&C expertise to provide strategic recommendations grounded in AWS offerings and methodology.
3. If search results found real data about executives, reference it. If not, focus on the account signals and T&C opportunity — don't fabricate executive information.
4. CHAMPION DESIGNATION: Only if search results explicitly show AWS-related activity.
5. Frame everything through skills transformation: how can T&C help this customer build workforce capability?
6. Reference specific AWS T&C offerings when recommending approaches (Skill Builder, Skills Guild, Classroom Training, etc.)
7. Apply Amazon/AWS methodology: Working Backwards from the customer's workforce vision, Day 1 mindset, mechanisms over good intentions.

SPECIFIC FUNCTION — ENGAGEMENT ADVISOR:
You are the AWS Engagement Advisor — an expert AI assistant that helps AWS Account Managers and T&C Business Development Managers prepare for and execute executive engagements. You have deep expertise in:

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

    // Add current message with context + AWS documentation
    let awsDocsContext = '';
    try {
      const [mcpDocs, kbDocs] = await Promise.all([
        getTCProductKnowledge(accountContext.industry, [message.slice(0, 50)]).catch(() => ''),
        getTCStrategyContext(accountContext.industry, selectedPersona?.persona || 'CTO', [message.slice(0, 50)]).catch(() => ''),
      ]);
      awsDocsContext = [mcpDocs, kbDocs].filter(Boolean).join('\n\n');
    } catch { /* continue without */ }

    messages.push({
      role: 'user',
      content: `${contextBlock}${awsDocsContext ? `\n\nAWS T&C REFERENCE MATERIAL:\n${awsDocsContext}` : ''}\n\nSELLER'S QUESTION: ${message}`,
    });

    const response = await invokeClaudeText(
      EXPERT_PERSONA + '\n' + ANTI_FABRICATION_POLICY + '\n\n' + SYSTEM_PROMPT,
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
