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

// lambdas/generate-pitch/index.ts
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
async function invokeClaudeJSON(systemPrompt, messages, options = {}) {
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
  const text = responseBody.content[0].text;
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = jsonMatch ? jsonMatch[1].trim() : text.trim();
  try {
    return JSON.parse(jsonStr);
  } catch {
    return { raw: text };
  }
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

// lambdas/generate-pitch/index.ts
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

SPECIFIC FUNCTION \u2014 PITCH DECK GENERATION:
You are an expert at creating executive pitch decks for AWS Training & Certification engagements. You create narrative-driven presentations that position T&C as a strategic accelerator, not a product pitch.

DECK STRUCTURE (7-8 slides):
1. TITLE \u2014 Customer \xD7 AWS T&C partnership framing
2. STORY \u2014 The persona-specific narrative (their challenge, in their words)
3. DATA \u2014 The intelligence that makes the case (hiring data, signals, industry context)
4. INSIGHT \u2014 Proof points from peer organizations (matched to persona and industry)
5. ACTION \u2014 Recommended approach (T&C plays, phased)
6. INVESTMENT \u2014 Revenue framework with ROI data
7. CLOSE \u2014 Next steps with specific timeline and commitments
8. (Optional) ADDITIONAL \u2014 User-added topics

RULES:
1. Speaker notes must coach the presenter on HOW to deliver, not just WHAT to say
2. Content should be concise enough for a slide (bullet points, key phrases) not paragraphs
3. Speaker notes should include: what to watch for in the room, how to handle likely reactions, which proof point to emphasize for this persona
4. The deck tells a story \u2014 each slide builds on the previous
5. Ground everything in the specific account data provided

Return JSON:
{
  "title": "...",
  "subtitle": "...",
  "duration": "20-25 minutes",
  "audience": "...",
  "slides": [{"slideNumber": 1, "title": "...", "content": "...", "speakerNotes": "...", "type": "title|story|data|insight|action|close"}]
}`;
async function handler(event) {
  try {
    if (!event.body) {
      return error(400, "Request body is required");
    }
    const request = JSON.parse(event.body);
    const { accountContext, persona, engagementPlan, userNotes } = request;
    if (!accountContext || !persona || !engagementPlan) {
      return error(400, "accountContext, persona, and engagementPlan are required");
    }
    const userMessage = `Generate a pitch deck for:

CUSTOMER: ${accountContext.customer_name} (${accountContext.industry}, ${accountContext.segment})
AWS SPEND: $${(accountContext.aws_spend_current / 1e6).toFixed(1)}M | PPA: ${accountContext.ppa}
PRIORITY: ${accountContext.account_plan_priority}

TARGET PERSONA: ${persona.name} (${persona.title}) \u2014 ${persona.persona}

INTELLIGENCE:
- LinkedIn: ${accountContext.linkedin_roles} cloud/AI roles (${accountContext.linkedin_yoy} YoY)
- Earnings: ${accountContext.earnings_signals.slice(0, 3).join("; ")}
- Executive Social: ${accountContext.executive_social.filter((e) => e.name === persona.name).map((e) => `"${e.post_theme}"`).join("; ") || "No direct social signals"}
- Glassdoor: ${accountContext.glassdoor_signals.slice(0, 2).join("; ")}
- Industry: ${accountContext.industry_context}
- News: ${accountContext.news_signals.slice(0, 2).join("; ")}
- T&C State: ${accountContext.tc_state}

ENGAGEMENT PLAN CONTEXT:
- Narrative: ${engagementPlan.narrative.slice(0, 500)}
- Conversation Starters: ${engagementPlan.conversation_starters[0]}
- Recommended Plays: ${engagementPlan.recommended_plays.map((p) => p.play_name).join(", ")}
- Pipeline: ${engagementPlan.total_pipeline}
- Proof Points: ${engagementPlan.proof_points.map((p) => `${p.customer}: ${p.metric}`).join("; ")}

${userNotes && userNotes.length > 0 ? `ADDITIONAL TOPICS:
${userNotes.join("\n")}` : ""}

Create a 7-slide pitch deck tailored to ${persona.name}'s perspective as a ${persona.persona}. The speaker notes should coach the presenter on delivery, reactions to watch for, and which proof points to emphasize.`;
    let awsDocsContext = "";
    try {
      const [mcpDocs, kbDocs] = await Promise.all([
        getTCProductKnowledge(accountContext.industry, [persona.persona]).catch(() => ""),
        getTCStrategyContext(accountContext.industry, persona.persona).catch(() => "")
      ]);
      awsDocsContext = [mcpDocs, kbDocs].filter(Boolean).join("\n\n");
    } catch {
    }
    const fullMessage = awsDocsContext ? `${userMessage}

AWS T&C REFERENCE MATERIAL:
${awsDocsContext}

Use the reference material to include specific, real AWS T&C offerings and proof points in the slides.` : userMessage;
    const result = await invokeClaudeJSON(
      SYSTEM_PROMPT,
      [{ role: "user", content: fullMessage }],
      { maxTokens: 4096, temperature: 0.7 }
    );
    return success(result);
  } catch (err) {
    console.error("Error generating pitch:", err);
    return error(500, "Failed to generate pitch deck");
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
