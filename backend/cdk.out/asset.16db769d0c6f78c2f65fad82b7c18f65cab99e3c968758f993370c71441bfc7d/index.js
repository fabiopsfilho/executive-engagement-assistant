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

// lambdas/account-insights/index.ts
var index_exports = {};
__export(index_exports, {
  handler: () => handler
});
module.exports = __toCommonJS(index_exports);
var import_client_dynamodb = require("@aws-sdk/client-dynamodb");
var import_lib_dynamodb = require("@aws-sdk/lib-dynamodb");

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

// lambdas/account-insights/index.ts
var ddbClient = new import_client_dynamodb.DynamoDBClient({});
var ddb = import_lib_dynamodb.DynamoDBDocumentClient.from(ddbClient);
var SYSTEM_PROMPT = `You are a senior AWS Training & Certification (T&C) strategist helping Account Managers prepare for executive engagements. You generate highly specific, actionable insights for each account based on their unique data.

Your responses must be:
- Specific to THIS account (reference real data points, names, numbers)
- Actionable (tell the AM exactly what to do, not generic advice)
- Grounded in the T&C framework (Skill Builder, Certification, Private Training, Skills Guild, Cloud Institute, re/Start, Jam)
- Written in a direct, conversational tone (2-3 sentences max per answer)
- Different for every account \u2014 never use generic templates

T&C Engagement Patterns to consider:
- Talent War: losing talent to competitors, high open roles
- Board Pressure: board asking about AI/cloud ROI, workforce readiness
- Compliance Trigger: regulatory requirements (EU AI Act, HIPAA, etc.)
- Subscription Underperformance: low activation, upcoming renewal

Persona-specific first moves:
- CHRO: Learning Needs Assessment
- CFO: Custom ROI model (Forrester 229% ROI)
- CIO/CTO: Role-based Skill Builder pilot
- CEO: Skills Transformation Partnership vision

Return ONLY valid JSON with these four fields. Each field should be 2-3 sentences of highly specific, data-grounded insight.`;
async function handler(event) {
  try {
    const accountId = event.pathParameters?.accountId;
    if (!accountId) {
      return error(400, "accountId is required");
    }
    const body = JSON.parse(event.body || "{}");
    const { accountData, tcData } = body;
    if (!accountData) {
      return error(400, "accountData is required");
    }
    const cacheKey = `insights:${accountData.customer_name?.toLowerCase().replace(/\s+/g, "-")}`;
    try {
      const cached = await ddb.send(new import_lib_dynamodb.GetCommand({
        TableName: process.env.INTELLIGENCE_CACHE_TABLE,
        Key: { cacheKey }
      }));
      if (cached.Item && cached.Item.ttl > Math.floor(Date.now() / 1e3)) {
        return success(cached.Item.data);
      }
    } catch {
    }
    const context = buildAccountContext(accountData, tcData);
    const persona = accountData.ebc_data?.attendees?.[0]?.persona || "CTO";
    const industry = accountData.industry || "Technology";
    const themes = accountData.ebc_data?.themes || [];
    const kbContext = await getTCStrategyContext(industry, persona, themes);
    const userMessage = `Generate four strategic insights for this account. Be HIGHLY SPECIFIC \u2014 reference actual names, numbers, and signals from the data. Use the T&C Knowledge Base context to recommend specific plays, proof points, and approaches that are documented in our strategy materials.

ACCOUNT DATA:
${context}
${kbContext}

Return JSON with exactly these fields:
{
  "who_to_focus": "Which specific executive(s) to prioritize and WHY based on their signals",
  "what_conversations": "What specific conversation angles to drive based on their signals and pain points",
  "where_to_start": "The specific first move \u2014 what T&C play to lead with and why it fits THIS account",
  "whats_happening": "What's happening in their world that creates urgency for T&C NOW"
}`;
    const result = await invokeClaudeJSON(
      SYSTEM_PROMPT,
      [{ role: "user", content: userMessage }],
      { maxTokens: 1024, temperature: 0.7 }
    );
    try {
      await ddb.send(new import_lib_dynamodb.PutCommand({
        TableName: process.env.INTELLIGENCE_CACHE_TABLE,
        Item: {
          cacheKey,
          data: result,
          ttl: Math.floor(Date.now() / 1e3) + 3600,
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        }
      }));
    } catch (cacheErr) {
      console.warn("Failed to cache insights:", cacheErr);
    }
    return success(result);
  } catch (err) {
    console.error("Error generating account insights:", err);
    return error(500, "Failed to generate account insights");
  }
}
function buildAccountContext(accountData, tcData) {
  const lines = [];
  lines.push(`Company: ${accountData.customer_name}`);
  lines.push(`Industry: ${accountData.industry} | Segment: ${accountData.segment} | Geo: ${accountData.geo}`);
  lines.push(`AWS Spend: $${(accountData.aws_spend?.current_year || 0).toLocaleString()} (prior year: $${(accountData.aws_spend?.prior_year || 0).toLocaleString()})`);
  lines.push(`PPA: ${accountData.aws_spend?.ppa || "None"}`);
  if (accountData.sfdc_data) {
    lines.push(`
SALESFORCE:`);
    lines.push(`Open Opportunities: ${accountData.sfdc_data.open_opps}`);
    lines.push(`T2K: ${accountData.sfdc_data.t2k ? "Yes" : "No"}`);
    lines.push(`Account Plan Priority: ${accountData.sfdc_data.account_plan_priority}`);
    lines.push(`SMGS Phase: ${accountData.sfdc_data.smgs_phase}`);
  }
  if (accountData.tc_current_state) {
    lines.push(`
T&C CURRENT STATE:`);
    lines.push(`Skill Builder: ${accountData.tc_current_state.skill_builder ? `Yes (${accountData.tc_current_state.skill_builder_seats} seats, ${accountData.tc_current_state.activation_rate}% activation)` : "No"}`);
    lines.push(`Certifications: ${accountData.tc_current_state.certifications}`);
    lines.push(`Prior Engagement: ${accountData.tc_current_state.prior_engagement || "None"}`);
    lines.push(`Renewal Date: ${accountData.tc_current_state.renewal_date || "N/A"}`);
  }
  if (tcData) {
    lines.push(`
T&C OPPORTUNITY DATA:`);
    lines.push(`Total Pipeline: $${(tcData.totalPipeline || 0).toLocaleString()}`);
    lines.push(`Open T&C Opportunities: ${tcData.openOpportunities || 0}`);
    lines.push(`Closed Won Revenue: $${(tcData.closedWonRevenue || 0).toLocaleString()}`);
    lines.push(`Products: ${(tcData.products || []).join(", ") || "None"}`);
    lines.push(`Total Students: ${tcData.totalStudents || 0}`);
  }
  if (accountData.ebc_data) {
    lines.push(`
EBC DATA:`);
    lines.push(`Meeting Dates: ${(accountData.ebc_data.meeting_dates || []).join(", ")}`);
    lines.push(`Themes: ${(accountData.ebc_data.themes || []).join(", ")}`);
    lines.push(`Attendees: ${(accountData.ebc_data.attendees || []).map((a) => `${a.name} (${a.title}, ${a.persona})`).join("; ")}`);
  }
  if (accountData.signals?.length) {
    lines.push(`
SIGNALS:`);
    accountData.signals.forEach((s) => {
      lines.push(`[${s.severity}] ${s.label}: ${s.evidence}`);
    });
  }
  if (accountData.public_intelligence) {
    const pi = accountData.public_intelligence;
    lines.push(`
PUBLIC INTELLIGENCE:`);
    if (pi.earnings_call_signals?.length) lines.push(`Earnings Calls: ${pi.earnings_call_signals.join("; ")}`);
    if (pi.linkedin_job_postings) lines.push(`LinkedIn: ${pi.linkedin_job_postings.cloud_ai_roles} cloud/AI roles (${pi.linkedin_job_postings.yoy_change} YoY)`);
    if (pi.executive_social?.length) {
      lines.push(`Executive Social:`);
      pi.executive_social.forEach((e) => lines.push(`  - ${e.name} (${e.title}): "${e.post_theme}"`));
    }
    if (pi.glassdoor_signals?.length) lines.push(`Glassdoor: ${pi.glassdoor_signals.join("; ")}`);
    if (pi.industry_context) lines.push(`Industry Context: ${pi.industry_context}`);
    if (pi.news_signals?.length) lines.push(`News: ${pi.news_signals.join("; ")}`);
  }
  return lines.join("\n");
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
