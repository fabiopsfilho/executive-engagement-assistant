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

// lambdas/advisor-chat/index.ts
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

// lambdas/advisor-chat/index.ts
var SYSTEM_PROMPT = `You are a globally renowned expert in skills transformation for the age of Generative AI. You work for AWS Training & Certification and have deep expertise in:

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
3. If search results found real data about executives, reference it. If not, focus on the account signals and T&C opportunity \u2014 don't fabricate executive information.
4. CHAMPION DESIGNATION: Only if search results explicitly show AWS-related activity.
5. Frame everything through skills transformation: how can T&C help this customer build workforce capability?
6. Reference specific AWS T&C offerings when recommending approaches (Skill Builder, Skills Guild, Classroom Training, etc.)
7. Apply Amazon/AWS methodology: Working Backwards from the customer's workforce vision, Day 1 mindset, mechanisms over good intentions.

SPECIFIC FUNCTION \u2014 ENGAGEMENT ADVISOR:
You are the AWS Engagement Advisor \u2014 an expert AI assistant that helps AWS Account Managers and T&C Business Development Managers prepare for and execute executive engagements. You have deep expertise in:

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
6. Use proof points strategically \u2014 match them to the persona and industry.
7. Keep responses focused and practical. Sellers are busy.`;
async function handler(event) {
  try {
    if (!event.body) {
      return error(400, "Request body is required");
    }
    const request = JSON.parse(event.body);
    const { message, conversationHistory, accountContext, selectedPersona, capability } = request;
    if (!message || !accountContext) {
      return error(400, "message and accountContext are required");
    }
    const contextBlock = `
CURRENT ACCOUNT CONTEXT:
- Customer: ${accountContext.customer_name} (${accountContext.industry}, ${accountContext.segment})
- AWS Spend: $${(accountContext.aws_spend_current / 1e6).toFixed(1)}M | PPA: ${accountContext.ppa}
- Priority: ${accountContext.account_plan_priority}
- Pipeline: ${accountContext.open_opps} open opps | T2K: ${accountContext.t2k ? "Yes" : "No"} | Phase: ${accountContext.smgs_phase}
- T&C State: ${accountContext.tc_state}
- Signals: ${accountContext.signals.map((s) => `[${s.severity}] ${s.label}: ${s.evidence}`).join("; ")}
- Intelligence Summary: ${accountContext.public_intelligence_summary}
${selectedPersona ? `
SELECTED PERSONA: ${selectedPersona.name} (${selectedPersona.title}) \u2014 ${selectedPersona.persona}` : ""}
${capability ? `
ACTIVE CAPABILITY: ${capability}` : ""}`;
    const messages = [];
    if (conversationHistory && conversationHistory.length > 0) {
      for (const msg of conversationHistory.slice(-10)) {
        messages.push({
          role: msg.role === "user" ? "user" : "assistant",
          content: msg.content
        });
      }
    }
    let awsDocsContext = "";
    try {
      const [mcpDocs, kbDocs] = await Promise.all([
        getTCProductKnowledge(accountContext.industry, [message.slice(0, 50)]).catch(() => ""),
        getTCStrategyContext(accountContext.industry, selectedPersona?.persona || "CTO", [message.slice(0, 50)]).catch(() => "")
      ]);
      awsDocsContext = [mcpDocs, kbDocs].filter(Boolean).join("\n\n");
    } catch {
    }
    messages.push({
      role: "user",
      content: `${contextBlock}${awsDocsContext ? `

AWS T&C REFERENCE MATERIAL:
${awsDocsContext}` : ""}

SELLER'S QUESTION: ${message}`
    });
    const response = await invokeClaudeText(
      SYSTEM_PROMPT,
      messages,
      { maxTokens: 2048, temperature: 0.7 }
    );
    return success({
      response,
      capability: capability || "general"
    });
  } catch (err) {
    console.error("Error in advisor chat:", err);
    return error(500, "Failed to generate advisor response");
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
