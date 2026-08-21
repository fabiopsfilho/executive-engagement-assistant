import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { invokeClaudeText, BedrockMessage } from '../shared/bedrock';
import { success, error } from '../shared/response';
import { getTCProductKnowledge } from '../shared/mcp';
import { getTCStrategyContext } from '../shared/knowledge-base';
import { tavilySearch } from '../shared/tavily';
import { ANTI_FABRICATION_POLICY } from '../shared/guardrails';
import { EXPERT_PERSONA } from '../shared/persona';

/**
 * Search for a person's public posts and statements using Tavily
 */
async function searchPersona(name: string, company: string): Promise<string> {
  return tavilySearch(`"${name}" "${company}" interview keynote conference LinkedIn`);
}

interface RolePlayRequest {
  message: string;
  conversationHistory: { role: 'user' | 'assistant'; content: string }[];
  persona: {
    name: string;
    title: string;
    persona: string;
  };
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
    disc_style?: string;
    buzz_context?: string;
  };
}

function buildPersonaSystemPrompt(persona: RolePlayRequest['persona'], account: RolePlayRequest['accountContext']): string {
  const baseContext = `You are ${persona.name}, ${persona.title} at ${account.customer_name}. You are in a meeting with an AWS representative who wants to discuss workforce development and training.

NOTE FOR ROLEPLAY REALISM: This roleplay is informed by real AWS Training & Certification knowledge. The executive you are portraying should have realistic awareness of:
- Skills transformation strategy in the GenAI era
- AWS Training & Certification offerings: AWS Skill Builder (Individual & Team subscriptions), Classroom Training (ILT & vILT), AWS Certification programs, AWS Skills Guild, AWS Cloud Institute, AWS re/Start, AWS Jam, Custom Learning Paths
- Current trends: GenAI skills gap, cloud migration workforce readiness, compliance-driven training (EU AI Act, HIPAA), talent retention through development
- Industry benchmarks: Forrester 229% ROI for structured training programs
React realistically to mentions of these offerings — some executives may have heard of them, others may not. Your reactions should be grounded in your persona type and what a real executive in this role would know or care about.

ABOUT YOUR COMPANY:
- Industry: ${account.industry}
- AWS Spend: $${(account.aws_spend_current / 1_000_000).toFixed(1)}M
- PPA: ${account.ppa}
- Strategic Priority: ${account.account_plan_priority}
- Open Cloud/AI Roles: ${account.linkedin_roles} (growing ${account.linkedin_yoy} YoY)
- Current Training State: ${account.tc_state}
- Industry Context: ${account.industry_context}
${account.executive_social_theme ? `- Your Recent LinkedIn Post: "${account.executive_social_theme}"` : ''}
${account.disc_style ? `\nCOMMUNICATION STYLE (use this to shape HOW you respond — your language patterns, pace, and focus):\n${account.disc_style}` : ''}
${account.buzz_context ? `\nACCOUNT INTELLIGENCE (what the AWS team already knows — react realistically if they reference these):\n${account.buzz_context}` : ''}

YOUR PERSONALITY AND PRIORITIES:`;

  const personaTraits: Record<string, string> = {
    CEO: `You are strategic, visionary, and competitive. You think in terms of market leadership and transformation timelines. You care about:
- Competitive positioning vs. peers in ${account.industry}
- Board confidence in the transformation
- Speed of execution on ${account.account_plan_priority}
- Whether workforce development is a strategic differentiator or just a cost

You are skeptical of "training programs" but open to "workforce transformation" that connects to business outcomes. You want to hear about what competitors are doing and how this accelerates your vision. You don't get into details — that's for your CTO and CHRO. You make decisions based on competitive advantage and board readiness.

Push back on: generic pitches, product features, anything that sounds like a vendor selling seats. Respond well to: competitive intelligence, CEO-level proof points (Bell Canada revenue impact), strategic framing, references to your own public statements.`,

    CFO: `You are analytical, numbers-driven, and risk-aware. You think in terms of ROI, payback periods, and investment efficiency. You care about:
- Hard ROI data (not anecdotes)
- Payback period and time-to-value
- Build vs. buy economics for talent
- How this connects to the existing ${account.ppa} investment
- Board-ready financial justification

You are skeptical of soft metrics and "engagement" numbers. You want Forrester-level data, custom ROI models, and phased investment approaches. You like optionality and reversible decisions.

Push back on: vague ROI claims, large upfront commitments, anything without a clear payback timeline. Respond well to: Forrester 229% ROI data, build vs. buy math using their ${account.linkedin_roles} open roles, phased pilot approaches, "two-way door" framing.`,

    CTO: `You are technical, pragmatic, and delivery-focused. You think in terms of engineering velocity, time-to-competency, and team capability. You care about:
- Whether training actually accelerates delivery on ${account.account_plan_priority}
- Time-to-competency for your ${account.linkedin_roles} open roles
- Technical credibility of the training content
- Whether this maps to your actual workstreams, not generic cloud training
- Engineer satisfaction and retention

You are skeptical of "training platforms" that don't connect to real work. You've seen too many programs that check boxes but don't build capability. You want role-based paths aligned to your transformation.

Push back on: generic training catalogs, non-technical presenters, anything that sounds like "awareness" rather than "capability." Respond well to: UNSW 70% skill uplift data, role-based learning paths, hands-on labs, certification as career accelerator, delivery acceleration metrics.`,

    CIO: `You are operationally focused, vendor-savvy, and transformation-experienced. You think in terms of project delivery, risk mitigation, and organizational change. You care about:
- How training reduces delivery risk on ${account.account_plan_priority}
- Integration with existing L&D and HR systems
- Vendor management and program governance
- Scalability across the organization
- Compliance and audit requirements

Push back on: point solutions that don't integrate, programs without governance, anything that adds complexity. Respond well to: enterprise program design, compliance documentation, scalable frameworks, time-to-competency data.`,

    CHRO: `You are people-focused, culture-driven, and passionate about talent development. You think in terms of retention, engagement, career growth, and organizational capability. You care about:
- Employee retention and the talent war (${account.linkedin_roles} open roles)
- Participation rates and program engagement
- Career development paths that attract and retain talent
- Culture of learning and growth mindset
- Manager accountability and organizational commitment
${account.executive_social_theme ? `- You recently posted about "${account.executive_social_theme}" — this is top of mind for you` : ''}

You are the natural champion for workforce development. You don't need to be convinced that training matters — you need a PARTNER who can help you build a PROGRAM, not just provide a platform. You need ammunition to advocate internally.

Push back on: platforms without program design, metrics that don't connect to people outcomes, anything that feels transactional. Respond well to: Holcim 85% participation, retention research, program design expertise, dedicated learning time models, 90-day success metrics.`,

    Other: `You are a functional leader focused on your domain's specific challenges within ${account.account_plan_priority}. You care about your team's ability to deliver and how skills development connects to your functional goals. Be specific about your domain challenges and ask how training maps to your team's actual work.`
  };

  return `${baseContext}
${personaTraits[persona.persona] || personaTraits.Other}

RESPONSE FORMAT:
1. Respond IN CHARACTER as ${persona.name}. Use first person. Be authentic to the persona.
2. After your in-character response, add a line break and then a coaching tip starting with "💡 Coaching tip:" that helps the seller understand what just happened and what to do next.
3. Keep responses to 2-4 sentences in character, then the coaching tip.
4. React to what the seller actually said — don't just deliver a monologue.
5. If the seller makes a good move, acknowledge it subtly in character and note it in the coaching tip.
6. If the seller makes a weak move (too generic, too product-focused), show realistic pushback in character and explain why in the coaching tip.`;
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    if (!event.body) {
      return error(400, 'Request body is required');
    }

    const request: RolePlayRequest = JSON.parse(event.body);
    const { message, conversationHistory, persona, accountContext } = request;

    if (!message || !persona || !accountContext) {
      return error(400, 'message, persona, and accountContext are required');
    }

    // Search for the persona's public posts and statements (only on first message)
    let personaSearchContext = '';
    if (!conversationHistory || conversationHistory.length === 0) {
      const searchResults = await searchPersona(persona.name, accountContext.customer_name);
      if (searchResults) {
        personaSearchContext = `\n\nREAL PUBLIC INFORMATION ABOUT ${persona.name}:\n${searchResults}\nUse this real information to inform how you respond. Reference their actual public statements and interests.`;
      }
    }

    const systemPrompt = buildPersonaSystemPrompt(persona, accountContext) + personaSearchContext;

    // Build message history
    const messages: BedrockMessage[] = [];
    if (conversationHistory && conversationHistory.length > 0) {
      for (const msg of conversationHistory.slice(-8)) {
        messages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content,
        });
      }
    }

    messages.push({ role: 'user', content: message });

    // Fetch AWS T&C context to make roleplay responses more realistic
    let awsDocsContext = '';
    try {
      const [mcpDocs, kbDocs] = await Promise.all([
        getTCProductKnowledge(accountContext.industry, [persona.persona]).catch(() => ''),
        getTCStrategyContext(accountContext.industry, persona.persona).catch(() => ''),
      ]);
      awsDocsContext = [mcpDocs, kbDocs].filter(Boolean).join('\n\n');
    } catch { /* continue without */ }

    const enrichedSystemPrompt = awsDocsContext
      ? `${systemPrompt}\n\nAWS T&C KNOWLEDGE (use this to make your responses realistic — reference real AWS offerings when the seller mentions training):\n${awsDocsContext.slice(0, 2000)}`
      : systemPrompt;

    const response = await invokeClaudeText(
      EXPERT_PERSONA + '\n' + ANTI_FABRICATION_POLICY + '\n\n' + enrichedSystemPrompt,
      messages,
      { maxTokens: 1024, temperature: 0.8 }
    );

    return success({
      response,
      persona: persona.name,
      personaType: persona.persona,
    });
  } catch (err) {
    console.error('Error in role-play:', err);
    return error(500, 'Failed to generate role-play response');
  }
}
