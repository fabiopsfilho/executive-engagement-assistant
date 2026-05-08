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

// lambdas/account-insights/index.ts
var ddbClient = new import_client_dynamodb.DynamoDBClient({});
var ddb = import_lib_dynamodb.DynamoDBDocumentClient.from(ddbClient);
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

SPECIFIC FUNCTION \u2014 ACCOUNT INSIGHTS:
You help the T&C Skills Enablement team prepare for executive engagement conversations focused on skills transformation.

ADDITIONAL GUARDRAILS:
1. NEVER INFER OR SPECULATE. Only reference data that was actually provided or found.
2. If data is missing for a field, be brief and honest \u2014 say "Based on available data..." not make claims.
3. CHAMPION DESIGNATION: Only call someone an "AWS champion" if there is explicit evidence of AWS-related activity (AWS posts, AWS certifications, AWS event attendance). Otherwise, do not use that term.
4. Frame everything through the T&C Skills Enablement lens: skills transformation, workforce development, training ROI, certification programs, learning culture.
5. Do NOT show or reference anything marked as unavailable or not found \u2014 just focus on what IS available.

Your responses must be:
- Based ONLY on confirmed data provided (reference real data points, names, numbers)
- Actionable for the T&C Skills Enablement team (what skills transformation conversations to drive)
- Grounded in the T&C framework (Skill Builder, Certification, Private Training, Skills Guild, Cloud Institute, re/Start, Jam)
- Written in a direct, conversational tone (2-3 sentences max per answer)
- Honest about data limitations \u2014 if limited data, say so briefly

T&C Engagement Patterns to consider:
- Talent War: losing talent to competitors, high open roles
- Board Pressure: board asking about AI/cloud ROI, workforce readiness
- Compliance Trigger: regulatory requirements (EU AI Act, HIPAA, etc.)
- Subscription Underperformance: low activation, upcoming renewal

Return ONLY valid JSON with these four fields. Each field should be 2-3 sentences based on confirmed data only.`;
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
    const context = buildAccountContext(accountData, tcData);
    const persona = accountData.ebc_data?.attendees?.[0]?.persona || "CTO";
    const industry = accountData.industry || "Technology";
    const themes = accountData.ebc_data?.themes || [];
    const [kbContext, mcpContext] = await Promise.all([
      getTCStrategyContext(industry, persona, themes).catch(() => ""),
      getTCProductKnowledge(industry, themes).catch(() => "")
    ]);
    const allContext = [kbContext, mcpContext].filter(Boolean).join("\n\n");
    const userMessage = `Generate four strategic insights for this account. Be HIGHLY SPECIFIC \u2014 reference actual names, numbers, and signals from the data. Use the T&C Knowledge Base context to recommend specific plays, proof points, and approaches that are documented in our strategy materials.

ACCOUNT DATA:
${context}
${allContext ? `
AWS T&C KNOWLEDGE & DOCUMENTATION:
${allContext}` : ""}

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
T&C OPPORTUNITY DATA (IMPORTANT \u2014 use this to inform your recommendations):`);
    lines.push(`Total Pipeline: $${(tcData.totalPipeline || 0).toLocaleString()}`);
    lines.push(`Open T&C Opportunities: ${tcData.openOpportunities || 0}`);
    lines.push(`Closed Won Revenue: $${(tcData.closedWonRevenue || 0).toLocaleString()}`);
    lines.push(`Products: ${(tcData.products || []).join(", ") || "None"}`);
    lines.push(`Total Students: ${tcData.totalStudents || 0}`);
    if (tcData.openOpportunities > 0) {
      lines.push(`NOTE: This customer has ACTIVE T&C opportunities. Reference these in your recommendations \u2014 build on existing engagement.`);
    }
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
  if (accountData.accountPlanText) {
    lines.push(`
ACCOUNT PLAN DOCUMENT (uploaded by user \u2014 this is the customer's strategic plan, analyze it for T&C opportunities):`);
    lines.push(accountData.accountPlanText.slice(0, 8e3));
  }
  return lines.join("\n");
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
