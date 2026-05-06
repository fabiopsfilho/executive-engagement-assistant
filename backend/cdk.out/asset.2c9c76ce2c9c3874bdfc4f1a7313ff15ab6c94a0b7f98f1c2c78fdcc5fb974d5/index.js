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

// lambdas/generate-agenda/index.ts
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

// lambdas/generate-agenda/index.ts
var SYSTEM_PROMPT = `You are an expert at designing executive engagement agendas for AWS Training & Certification. You create agendas grounded in Amazon Leadership Principles that position T&C as a strategic accelerator.

TWO FORMATS:
1. EBC (Executive Business Council) \u2014 Half-day strategic session (3-4 hours) with multiple executives. Includes Working Backwards workshop, intelligence briefing, proof points, investment framework, and commitments.
2. Training Strategy Session \u2014 1-hour focused session covering workforce landscape, non-technical roles approach, technical roles approach, engagement model, and next steps.

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
5. The agenda should tell a story \u2014 each block builds on the previous one

Return JSON:
{
  "title": "...",
  "subtitle": "...",
  "format": "Half-Day EBC | 1-Hour Training Session",
  "date": "...",
  "location": "...",
  "duration": "...",
  "blocks": [{"time": "9:00 AM", "duration": "15 min", "title": "...", "description": "...", "owner": "...", "type": "welcome|discovery|insight|demo|workshop|action|break"}],
  "principles": ["Principle \u2014 Application"],
  "preparation": ["Prep item 1", "Prep item 2"]
}`;
async function handler(event) {
  try {
    if (!event.body) {
      return error(400, "Request body is required");
    }
    const request = JSON.parse(event.body);
    const { accountContext, format, persona, userNotes } = request;
    if (!accountContext || !format) {
      return error(400, "accountContext and format are required");
    }
    const userMessage = `Generate a ${format === "ebc" ? "half-day EBC strategic session" : "1-hour Training Strategy Session"} agenda for:

CUSTOMER: ${accountContext.customer_name} (${accountContext.industry})
STRATEGIC PRIORITY: ${accountContext.account_plan_priority}
EBC DATE: ${accountContext.ebc_date}
LOCATION: ${accountContext.ebc_location}
THEMES: ${accountContext.ebc_themes.join(", ")}

ATTENDEES:
${accountContext.attendees.map((a) => `- ${a.name} (${a.title}) \u2014 ${a.persona}`).join("\n")}

T&C STATE: ${accountContext.tc_state}
KEY SIGNALS: ${accountContext.signals_summary}
PUBLIC INTELLIGENCE: ${accountContext.public_intelligence_summary}

${persona ? `FOCUS PERSONA: ${persona.name} (${persona.title}) \u2014 ${persona.persona}` : "MULTI-PERSONA: Design for the full executive audience"}
${userNotes && userNotes.length > 0 ? `
ADDITIONAL TOPICS TO INCLUDE:
${userNotes.join("\n")}` : ""}

Design an agenda that:
1. Opens with the customer's own words and priorities
2. Builds the case for workforce development through data and proof points
3. Includes interactive elements (Working Backwards workshop, discovery questions)
4. Closes with specific commitments from both sides
5. Weaves in the specific signals and intelligence for this account`;
    const result = await invokeClaudeJSON(
      SYSTEM_PROMPT,
      [{ role: "user", content: userMessage }],
      { maxTokens: 4096, temperature: 0.6 }
    );
    return success(result);
  } catch (err) {
    console.error("Error generating agenda:", err);
    return error(500, "Failed to generate agenda");
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
