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

// lambdas/advisor-chat/index.ts
var SYSTEM_PROMPT = `You are the AWS Engagement Advisor \u2014 an expert AI assistant that helps AWS Account Managers and T&C Business Development Managers prepare for and execute executive engagements. You have deep expertise in:

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
    messages.push({
      role: "user",
      content: `${contextBlock}

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
