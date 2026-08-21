import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { invokeClaudeJSON } from '../shared/bedrock';
import { success, error } from '../shared/response';
import { getTCStrategyContext } from '../shared/knowledge-base';
import { getTCProductKnowledge } from '../shared/mcp';

interface AgendaRequest {
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
  };
  format: 'ebc' | 'training-session';
  persona?: { name: string; title: string; persona: string };
  userNotes?: string[];
}

interface AgendaBlock {
  time: string;
  duration: string;
  title: string;
  description: string;
  owner: string;
  type: 'welcome' | 'discovery' | 'insight' | 'demo' | 'workshop' | 'action' | 'break';
}

interface AgendaResponse {
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

SPECIFIC FUNCTION — AGENDA DESIGN:
You are an expert at designing executive engagement agendas for AWS Training & Certification. You create agendas grounded in Amazon Leadership Principles that position T&C as a strategic accelerator.

TWO FORMATS:
1. EBC (Executive Business Council) — Half-day strategic session (3-4 hours) with multiple executives. Includes Working Backwards workshop, intelligence briefing, proof points, investment framework, and commitments.
2. Training Strategy Session — 1-hour focused session covering workforce landscape, non-technical roles approach, technical roles approach, engagement model, and next steps.

PRINCIPLES TO EMBED:
- Customer Obsession: Start with their vision, not our products
- Working Backwards: Define success first, design the path
- Earn Trust: Be transparent, including uncomfortable truths
- Bias for Action: Leave with specific commitments
- Think Big: Enterprise vision, pilot start
- Dive Deep: Specific data, not generalizations

RULES:
1. Every agenda block must connect to specific account intelligence (signals, hiring data, executive statements)
2. Include realistic time allocations
3. Preparation checklist must be actionable and specific to this account
4. Owner assignments should be realistic (AWS Account Lead, T&C BDM, T&C Specialist, Customer Leadership, Joint)
5. The agenda should tell a story — each block builds on the previous one

Return JSON:
{
  "title": "...",
  "subtitle": "...",
  "format": "Half-Day EBC | 1-Hour Training Session",
  "date": "...",
  "location": "...",
  "duration": "...",
  "blocks": [{"time": "9:00 AM", "duration": "15 min", "title": "...", "description": "...", "owner": "...", "type": "welcome|discovery|insight|demo|workshop|action|break"}],
  "principles": ["Principle — Application"],
  "preparation": ["Prep item 1", "Prep item 2"]
}`;

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    if (!event.body) {
      return error(400, 'Request body is required');
    }

    const request: AgendaRequest = JSON.parse(event.body);
    const { accountContext, format, persona, userNotes } = request;

    if (!accountContext || !format) {
      return error(400, 'accountContext and format are required');
    }

    // Retrieve relevant T&C strategy content from Knowledge Base + AWS Docs MCP
    const primaryPersona = accountContext.attendees?.[0]?.persona || 'CTO';
    const [kbContext, mcpContext] = await Promise.all([
      getTCStrategyContext(accountContext.industry, primaryPersona, accountContext.ebc_themes).catch(() => ''),
      getTCProductKnowledge(accountContext.industry, accountContext.ebc_themes).catch(() => ''),
    ]);
    const allContext = [kbContext, mcpContext].filter(Boolean).join('\n\n');

    const userMessage = `Generate a ${format === 'ebc' ? 'half-day EBC strategic session' : '1-hour Training Strategy Session'} agenda for:

CUSTOMER: ${accountContext.customer_name} (${accountContext.industry})
STRATEGIC PRIORITY: ${accountContext.account_plan_priority}
EBC DATE: ${accountContext.ebc_date}
LOCATION: ${accountContext.ebc_location}
THEMES: ${accountContext.ebc_themes.join(', ')}

ATTENDEES:
${accountContext.attendees.map(a => `- ${a.name} (${a.title}) — ${a.persona}`).join('\n')}

T&C STATE: ${accountContext.tc_state}
KEY SIGNALS: ${accountContext.signals_summary}
PUBLIC INTELLIGENCE: ${accountContext.public_intelligence_summary}

${persona ? `FOCUS PERSONA: ${persona.name} (${persona.title}) — ${persona.persona}` : 'MULTI-PERSONA: Design for the full executive audience'}
${userNotes && userNotes.length > 0 ? `\nADDITIONAL TOPICS TO INCLUDE:\n${userNotes.join('\n')}` : ''}

Design an agenda that:
1. Opens with the customer's own words and priorities
2. Builds the case for workforce development through data and proof points
3. Includes interactive elements (Working Backwards workshop, discovery questions)
4. Closes with specific commitments from both sides
5. Weaves in the specific signals and intelligence for this account
${kbContext ? `\nT&C STRATEGY REFERENCE MATERIAL:\n${kbContext}` : ''}
${mcpContext ? `\nAWS DOCUMENTATION:\n${mcpContext}` : ''}

Use the T&C strategy reference material to recommend specific plays, frameworks, and approaches that are documented in our materials.`;

    const result = await invokeClaudeJSON<AgendaResponse>(
      SYSTEM_PROMPT,
      [{ role: 'user', content: userMessage }],
      { maxTokens: 3072, temperature: 0.6 }
    );

    return success(result);
  } catch (err) {
    console.error('Error generating agenda:', err);
    return error(500, 'Failed to generate agenda');
  }
}
