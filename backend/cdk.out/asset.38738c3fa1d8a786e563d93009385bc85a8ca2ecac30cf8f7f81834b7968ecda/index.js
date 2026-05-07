"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// lambdas/roleplay/index.ts
var index_exports = {};
__export(index_exports, {
  handler: () => handler
});
module.exports = __toCommonJS(index_exports);

// lambdas/shared/bedrock.ts
var import_client_bedrock_runtime = require("@aws-sdk/client-bedrock-runtime");
var client = new import_client_bedrock_runtime.BedrockRuntimeClient({
  region: process.env.BEDROCK_REGION || "us-east-1"
});
async function invokeClaudeText(systemPrompt, messages, options = {}) {
  const { maxTokens = 4096, temperature = 0.7 } = options;
  const body = JSON.stringify({
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: maxTokens,
    temperature,
    system: systemPrompt,
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content
    }))
  });
  const command = new import_client_bedrock_runtime.InvokeModelCommand({
    modelId: process.env.BEDROCK_MODEL_ID || "us.anthropic.claude-haiku-4-5-20251001-v1:0",
    contentType: "application/json",
    accept: "application/json",
    body: new TextEncoder().encode(body)
  });
  const response = await client.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));
  return responseBody.content[0].text;
}

// lambdas/shared/response.ts
function success(body) {
  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type,Authorization"
    },
    body: JSON.stringify(body)
  };
}
function error(statusCode, message) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type,Authorization"
    },
    body: JSON.stringify({ error: message })
  };
}

// lambdas/shared/mcp.ts
var MCP_SERVER_URL = "https://knowledge-mcp.global.api.aws";
async function callMCPTool(toolName, args) {
  try {
    const response = await fetch(`${MCP_SERVER_URL}/mcp/v1/tools/call`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        method: "tools/call",
        params: {
          name: toolName,
          arguments: args
        }
      })
    });
    if (!response.ok) {
      console.warn(`MCP tool ${toolName} returned ${response.status}`);
      return "";
    }
    const data = await response.json();
    if (data.content && data.content.length > 0) {
      return data.content.map((c) => c.text).join("\n");
    }
    return "";
  } catch (err) {
    console.warn(`MCP tool ${toolName} failed:`, err);
    return "";
  }
}
async function searchAWSDocumentation(query) {
  return callMCPTool("search_documentation", {
    search_phrase: query,
    topic: "training-certification"
  });
}
async function getTCProductKnowledge(industry, topics) {
  const queries = [
    `AWS Training Certification ${industry} workforce development`,
    `AWS Skill Builder enterprise subscription features`,
    ...topics.slice(0, 2).map((t) => `AWS Training ${t}`)
  ];
  const results = await Promise.all(
    queries.map((q) => searchAWSDocumentation(q).catch(() => ""))
  );
  const combined = results.filter(Boolean).join("\n\n");
  return combined.slice(0, 2e3);
}

// lambdas/shared/knowledge-base.ts
var import_client_bedrock_agent_runtime = require("@aws-sdk/client-bedrock-agent-runtime");
var client2 = new import_client_bedrock_agent_runtime.BedrockAgentRuntimeClient({
  region: process.env.BEDROCK_REGION || "us-east-1"
});
var KNOWLEDGE_BASE_ID = process.env.KNOWLEDGE_BASE_ID || "TJHYCVRLXH";
async function retrieveFromKnowledgeBase(query, maxResults = 5) {
  try {
    const command = new import_client_bedrock_agent_runtime.RetrieveCommand({
      knowledgeBaseId: KNOWLEDGE_BASE_ID,
      retrievalQuery: { text: query },
      retrievalConfiguration: {
        vectorSearchConfiguration: {
          numberOfResults: maxResults
        }
      }
    });
    const response = await client2.send(command);
    const results = response.retrievalResults || [];
    if (results.length === 0) return "";
    const chunks = results.filter((r) => r.content?.text).map((r) => r.content.text).join("\n\n---\n\n");
    return chunks.slice(0, 3e3);
  } catch (err) {
    console.warn("Knowledge base retrieval failed:", err);
    return "";
  }
}
async function getTCStrategyContext(industry, persona, topics = []) {
  const queries = [
    `${persona} executive engagement strategy ${industry} training certification`,
    ...topics.slice(0, 2).map((t) => `${t} workforce development ${industry}`)
  ];
  const results = await Promise.all(
    queries.map((q) => retrieveFromKnowledgeBase(q, 3).catch(() => ""))
  );
  const combined = results.filter(Boolean).join("\n\n");
  if (!combined) return "";
  return `

T&C KNOWLEDGE BASE CONTEXT:
${combined.slice(0, 4e3)}`;
}

// lambdas/roleplay/index.ts
async function searchPersona(name, company) {
  try {
    const query = `"${name}" "${company}" site:linkedin.com OR interview OR keynote OR conference`;
    const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=5&hl=en`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html",
        "Accept-Language": "en-US,en;q=0.9"
      }
    });
    if (!response.ok) return "";
    const html = await response.text();
    const snippets = [];
    const matches = html.match(/class="BNeawe[^"]*"[^>]*>([^<]{20,500})/g) || [];
    for (const match of matches.slice(0, 6)) {
      const text = match.replace(/class="BNeawe[^"]*"[^>]*>/, "").trim();
      if (text.length > 20) snippets.push(text);
    }
    const divMatches = html.match(/<div[^>]*class="[^"]*"[^>]*>([^<]{40,300})<\/div>/g) || [];
    for (const match of divMatches.slice(0, 6)) {
      const text = match.replace(/<[^>]+>/g, "").trim();
      if (text.length > 40 && !text.includes("Google") && !text.includes("Sign in")) {
        snippets.push(text);
      }
    }
    return snippets.slice(0, 6).join("\n");
  } catch {
    return "";
  }
}
function buildPersonaSystemPrompt(persona, account) {
  const baseContext = `You are ${persona.name}, ${persona.title} at ${account.customer_name}. You are in a meeting with an AWS representative who wants to discuss workforce development and training.

NOTE FOR ROLEPLAY REALISM: This roleplay is informed by real AWS Training & Certification knowledge. The executive you are portraying should have realistic awareness of:
- Skills transformation strategy in the GenAI era
- AWS Training & Certification offerings: AWS Skill Builder (Individual & Team subscriptions), Classroom Training (ILT & vILT), AWS Certification programs, AWS Skills Guild, AWS Cloud Institute, AWS re/Start, AWS Jam, Custom Learning Paths
- Current trends: GenAI skills gap, cloud migration workforce readiness, compliance-driven training (EU AI Act, HIPAA), talent retention through development
- Industry benchmarks: Forrester 229% ROI for structured training programs
React realistically to mentions of these offerings \u2014 some executives may have heard of them, others may not. Your reactions should be grounded in your persona type and what a real executive in this role would know or care about.

ABOUT YOUR COMPANY:
- Industry: ${account.industry}
- AWS Spend: $${(account.aws_spend_current / 1e6).toFixed(1)}M
- PPA: ${account.ppa}
- Strategic Priority: ${account.account_plan_priority}
- Open Cloud/AI Roles: ${account.linkedin_roles} (growing ${account.linkedin_yoy} YoY)
- Current Training State: ${account.tc_state}
- Industry Context: ${account.industry_context}
${account.executive_social_theme ? `- Your Recent LinkedIn Post: "${account.executive_social_theme}"` : ""}

YOUR PERSONALITY AND PRIORITIES:`;
  const personaTraits = {
    CEO: `You are strategic, visionary, and competitive. You think in terms of market leadership and transformation timelines. You care about:
- Competitive positioning vs. peers in ${account.industry}
- Board confidence in the transformation
- Speed of execution on ${account.account_plan_priority}
- Whether workforce development is a strategic differentiator or just a cost

You are skeptical of "training programs" but open to "workforce transformation" that connects to business outcomes. You want to hear about what competitors are doing and how this accelerates your vision. You don't get into details \u2014 that's for your CTO and CHRO. You make decisions based on competitive advantage and board readiness.

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
${account.executive_social_theme ? `- You recently posted about "${account.executive_social_theme}" \u2014 this is top of mind for you` : ""}

You are the natural champion for workforce development. You don't need to be convinced that training matters \u2014 you need a PARTNER who can help you build a PROGRAM, not just provide a platform. You need ammunition to advocate internally.

Push back on: platforms without program design, metrics that don't connect to people outcomes, anything that feels transactional. Respond well to: Holcim 85% participation, retention research, program design expertise, dedicated learning time models, 90-day success metrics.`,
    Other: `You are a functional leader focused on your domain's specific challenges within ${account.account_plan_priority}. You care about your team's ability to deliver and how skills development connects to your functional goals. Be specific about your domain challenges and ask how training maps to your team's actual work.`
  };
  return `${baseContext}
${personaTraits[persona.persona] || personaTraits.Other}

RESPONSE FORMAT:
1. Respond IN CHARACTER as ${persona.name}. Use first person. Be authentic to the persona.
2. After your in-character response, add a line break and then a coaching tip starting with "\u{1F4A1} Coaching tip:" that helps the seller understand what just happened and what to do next.
3. Keep responses to 2-4 sentences in character, then the coaching tip.
4. React to what the seller actually said \u2014 don't just deliver a monologue.
5. If the seller makes a good move, acknowledge it subtly in character and note it in the coaching tip.
6. If the seller makes a weak move (too generic, too product-focused), show realistic pushback in character and explain why in the coaching tip.`;
}
async function handler(event) {
  try {
    if (!event.body) {
      return error(400, "Request body is required");
    }
    const request = JSON.parse(event.body);
    const { message, conversationHistory, persona, accountContext } = request;
    if (!message || !persona || !accountContext) {
      return error(400, "message, persona, and accountContext are required");
    }
    let personaSearchContext = "";
    if (!conversationHistory || conversationHistory.length === 0) {
      const searchResults = await searchPersona(persona.name, accountContext.customer_name);
      if (searchResults) {
        personaSearchContext = `

REAL PUBLIC INFORMATION ABOUT ${persona.name}:
${searchResults}
Use this real information to inform how you respond. Reference their actual public statements and interests.`;
      }
    }
    const systemPrompt = buildPersonaSystemPrompt(persona, accountContext) + personaSearchContext;
    const messages = [];
    if (conversationHistory && conversationHistory.length > 0) {
      for (const msg of conversationHistory.slice(-8)) {
        messages.push({
          role: msg.role === "user" ? "user" : "assistant",
          content: msg.content
        });
      }
    }
    messages.push({ role: "user", content: message });
    let awsDocsContext = "";
    try {
      const [mcpDocs, kbDocs] = await Promise.all([
        getTCProductKnowledge(accountContext.industry, [persona.persona]).catch(() => ""),
        getTCStrategyContext(accountContext.industry, persona.persona).catch(() => "")
      ]);
      awsDocsContext = [mcpDocs, kbDocs].filter(Boolean).join("\n\n");
    } catch {
    }
    const enrichedSystemPrompt = awsDocsContext ? `${systemPrompt}

AWS T&C KNOWLEDGE (use this to make your responses realistic \u2014 reference real AWS offerings when the seller mentions training):
${awsDocsContext.slice(0, 2e3)}` : systemPrompt;
    const response = await invokeClaudeText(
      enrichedSystemPrompt,
      messages,
      { maxTokens: 1024, temperature: 0.8 }
    );
    return success({
      response,
      persona: persona.name,
      personaType: persona.persona
    });
  } catch (err) {
    console.error("Error in role-play:", err);
    return error(500, "Failed to generate role-play response");
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
