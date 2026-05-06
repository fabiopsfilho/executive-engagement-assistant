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

// lambdas/account-buzz/index.ts
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

// lambdas/account-buzz/index.ts
var ddbClient = new import_client_dynamodb.DynamoDBClient({});
var ddb = import_lib_dynamodb.DynamoDBDocumentClient.from(ddbClient);
var SYSTEM_PROMPT = `You are a senior AWS Training & Certification strategist analyzing real-time intelligence about a customer account. You synthesize multiple data signals into actionable insights.

Your analysis must be:
- Grounded in the ACTUAL data provided (reference specific numbers, names, quotes)
- Actionable (tell the Account Manager exactly what to do with this information)
- Connected to T&C opportunities (how does each signal create a training/certification opportunity?)
- Specific to THIS account (never generic)

For BUZZ (What people are saying): Synthesize executive social activity, hiring trends, employee sentiment, and industry news into a coherent narrative about what's happening at this company and what it means for T&C.

For NOW (What to focus on): Based on the signals, tell the AM exactly what to prioritize, what conversations to have, what questions to ask, and what their opening move should be.

Return ONLY valid JSON.`;
async function handler(event) {
  try {
    const accountId = event.pathParameters?.accountId;
    if (!accountId) return error(400, "accountId is required");
    const body = JSON.parse(event.body || "{}");
    const { accountData, tcData } = body;
    if (!accountData) return error(400, "accountData is required");
    const cacheKey = `buzz:${accountData.customer_name?.toLowerCase().replace(/\s+/g, "-")}`;
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
    const industry = accountData.industry || "Technology";
    const [mcpDocs, kbDocs] = await Promise.all([
      getTCProductKnowledge(industry, ["workforce transformation", "talent development"]).catch(() => ""),
      getTCStrategyContext(industry, "CTO", accountData.ebc_data?.themes || []).catch(() => "")
    ]);
    const awsContext = [mcpDocs, kbDocs].filter(Boolean).join("\n\n");
    const pi = accountData.public_intelligence || {};
    const context = `
COMPANY: ${accountData.customer_name} (${industry}, ${accountData.segment}, ${accountData.geo})
AWS SPEND: $${(accountData.aws_spend?.current_year || 0).toLocaleString()} (prior: $${(accountData.aws_spend?.prior_year || 0).toLocaleString()})
STRATEGIC PRIORITY: ${accountData.sfdc_data?.account_plan_priority || "Unknown"}
SMGS PHASE: ${accountData.sfdc_data?.smgs_phase || "Unknown"}
T2K: ${accountData.sfdc_data?.t2k ? "Yes" : "No"}

T&C STATE:
${accountData.tc_current_state?.skill_builder ? `Skill Builder: ${accountData.tc_current_state.skill_builder_seats} seats, ${accountData.tc_current_state.activation_rate}% activation` : "No Skill Builder (Greenfield)"}
Certifications: ${accountData.tc_current_state?.certifications || 0}
Prior Engagement: ${accountData.tc_current_state?.prior_engagement || "None"}
Renewal: ${accountData.tc_current_state?.renewal_date || "N/A"}

${tcData ? `T&C PIPELINE DATA:
Pipeline: $${(tcData.totalPipeline || 0).toLocaleString()}
Open Opportunities: ${tcData.openOpportunities || 0}
Closed Won: $${(tcData.closedWonRevenue || 0).toLocaleString()}
Products: ${(tcData.products || []).join(", ")}
Students: ${tcData.totalStudents || 0}` : "No T&C pipeline data available"}

SIGNALS:
${(accountData.signals || []).map((s) => `[${s.severity}] ${s.label}: ${s.evidence}`).join("\n")}

EXECUTIVE SOCIAL ACTIVITY:
${(pi.executive_social || []).map((e) => `${e.name} (${e.title}): "${e.post_theme}"${e.url ? ` [${e.url}]` : ""}`).join("\n") || "None detected"}

LINKEDIN HIRING:
${pi.linkedin_job_postings ? `${pi.linkedin_job_postings.cloud_ai_roles} cloud/AI roles (${pi.linkedin_job_postings.yoy_change} YoY)` : "No data"}

GLASSDOOR EMPLOYEE SENTIMENT:
${(pi.glassdoor_signals || []).map((s) => `"${s}"`).join("\n") || "No data"}

EARNINGS CALL SIGNALS:
${(pi.earnings_call_signals || []).join("\n") || "No data"}

INDUSTRY CONTEXT:
${pi.industry_context || "No data"}

NEWS SIGNALS:
${(pi.news_signals || []).join("\n") || "No data"}

EBC DATA:
Date: ${accountData.ebc_data?.meeting_dates?.[0] || "TBD"}
Location: ${accountData.ebc_data?.location || "TBD"}
Themes: ${(accountData.ebc_data?.themes || []).join(", ")}
Attendees: ${(accountData.ebc_data?.attendees || []).map((a) => `${a.name} (${a.persona})`).join(", ")}

${awsContext ? `AWS T&C KNOWLEDGE BASE & DOCUMENTATION:
${awsContext.slice(0, 3e3)}` : ""}`;
    const userMessage = `Analyze this account's intelligence and generate both BUZZ and NOW insights. Be highly specific \u2014 reference actual names, numbers, and quotes from the data.

${context}

Return JSON:
{
  "buzz_summary": "2-3 sentence synthesis of what's happening at this company based on all signals",
  "buzz_executive_insights": ["Insight about each executive's activity and what it means for T&C \u2014 1 per executive"],
  "buzz_hiring_analysis": "What the hiring data tells us about their skills gap and T&C opportunity",
  "buzz_sentiment_analysis": "What employees are saying and what it means for training programs",
  "now_focus": "The single most important thing to focus on right now and why",
  "now_initiatives": ["Top 3 specific initiatives to drive, each connected to a signal"],
  "now_key_asks": ["4 specific questions to ask in the next conversation, grounded in the data"],
  "now_opening_move": "The exact opening move \u2014 what to say, who to say it to, and why it works"
}`;
    const result = await invokeClaudeJSON(
      SYSTEM_PROMPT,
      [{ role: "user", content: userMessage }],
      { maxTokens: 2048, temperature: 0.7 }
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
    } catch {
    }
    return success(result);
  } catch (err) {
    console.error("Error generating buzz/now insights:", err);
    return error(500, "Failed to generate buzz/now insights");
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
