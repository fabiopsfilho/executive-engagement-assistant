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

// lambdas/generate-engagement/index.ts
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
async function getEngagementKnowledge(industry, persona) {
  const queries = [
    `AWS Training Certification ${industry} executive engagement ${persona}`,
    `AWS Skill Builder workforce transformation ${industry}`
  ];
  const results = await Promise.all(
    queries.map((q) => searchAWSDocumentation(q).catch(() => ""))
  );
  return results.filter(Boolean).join("\n\n").slice(0, 2e3);
}

// lambdas/generate-engagement/index.ts
var SYSTEM_PROMPT = `You are an expert AWS Training & Certification (T&C) engagement strategist. Your job is to generate persona-specific executive engagement plans that position AWS T&C as a strategic accelerator for the customer's cloud transformation.

You have deep knowledge of:
- AWS T&C offerings: Skill Builder (self-paced digital), Skills Guild (enterprise program), Private Training (ILT), Certifications, Learning Needs Assessments, Executive AI Literacy programs
- Proof points: Bell Canada (67% cloud sales increase), Holcim (85% participation, 38% team growth), UNSW (70% skill uplift, 54% AWS proficiency growth), CloudCall (50% time-to-market reduction), LTIMindtree (40,000+ trained), Fortinet (83% sales opportunity increase Year 2), Forrester TEI (229% ROI, <6 month payback)
- Persona priorities: CEO (competitive positioning, board readiness, transformation vision), CFO (ROI, payback, build vs. buy economics), CTO/CIO (delivery acceleration, time-to-competency, technical credibility), CHRO (retention, participation, culture, talent strategy)

CRITICAL RULES:
1. Ground every conversation starter in a SPECIFIC data point from the account intelligence (an earnings call quote, a LinkedIn post theme, a hiring number, a Glassdoor signal). Never be generic.
2. The narrative must tell a STORY about this specific executive at this specific company \u2014 not a generic pitch about training.
3. Revenue estimates must be realistic and phased. Use ranges. Base them on account size, current T&C state, and industry benchmarks.
4. Proof points must be matched to the persona type and industry context.
5. Recommended plays must connect to the customer's specific transformation priorities, not just list products.

Return your response as a JSON object matching this exact structure:
{
  "persona": "CEO|CFO|CTO|CIO|CHRO|Other",
  "persona_name": "Full Name",
  "persona_title": "Full Title",
  "narrative": "2-3 paragraph narrative...",
  "conversation_starters": ["starter 1", "starter 2", "starter 3"],
  "recommended_plays": [{"play_name": "...", "description": "..."}],
  "revenue_estimate": [{"offering": "...", "estimated_value": "$X-$Y", "timeline": "Q_ 20__"}],
  "total_pipeline": "$X-$Y over N months",
  "proof_points": [{"customer": "...", "industry": "...", "metric": "...", "demonstrates": "..."}]
}`;
async function handler(event) {
  try {
    if (!event.body) {
      return error(400, "Request body is required");
    }
    const request = JSON.parse(event.body);
    const { accountData, persona, userNotes } = request;
    if (!accountData || !persona) {
      return error(400, "accountData and persona are required");
    }
    let awsKnowledge = "";
    try {
      awsKnowledge = await getEngagementKnowledge(accountData.industry, persona.persona);
    } catch {
    }
    const userMessage = `Generate a persona-specific engagement plan for the following:

ACCOUNT: ${accountData.customer_name}
INDUSTRY: ${accountData.industry}
SEGMENT: ${accountData.segment} (${accountData.geo})
AWS SPEND: $${(accountData.aws_spend.current_year / 1e6).toFixed(1)}M (up from $${(accountData.aws_spend.prior_year / 1e6).toFixed(1)}M prior year)
PPA: ${accountData.aws_spend.ppa || "None"}

SALESFORCE DATA:
- Open Opportunities: ${accountData.sfdc_data.open_opps}
- T2K: ${accountData.sfdc_data.t2k ? "Yes" : "No"}
- Account Plan Priority: ${accountData.sfdc_data.account_plan_priority}
- SMGS Phase: ${accountData.sfdc_data.smgs_phase}

T&C CURRENT STATE:
- Skill Builder: ${accountData.tc_current_state.skill_builder ? `Yes (${accountData.tc_current_state.skill_builder_seats} seats, ${accountData.tc_current_state.activation_rate}% activation)` : "No structured engagement"}
- Certifications: ${accountData.tc_current_state.certifications}
- Prior Engagement: ${accountData.tc_current_state.prior_engagement}
- Renewal Date: ${accountData.tc_current_state.renewal_date || "N/A"}

PUBLIC INTELLIGENCE:
- Earnings Call Signals: ${accountData.public_intelligence.earnings_call_signals.join("; ")}
- LinkedIn Job Postings: ${accountData.public_intelligence.linkedin_job_postings.cloud_ai_roles} cloud/AI roles (${accountData.public_intelligence.linkedin_job_postings.yoy_change} YoY)
- Executive Social Activity: ${accountData.public_intelligence.executive_social.map((e) => `${e.name} (${e.title}): "${e.post_theme}"`).join("; ")}
- Glassdoor Signals: ${accountData.public_intelligence.glassdoor_signals.join("; ")}
- Industry Context: ${accountData.public_intelligence.industry_context}
- News: ${accountData.public_intelligence.news_signals.join("; ")}

TARGET PERSONA:
- Name: ${persona.name}
- Title: ${persona.title}
- Type: ${persona.persona}

${userNotes && userNotes.length > 0 ? `ADDITIONAL CONTEXT FROM SELLER:
${userNotes.join("\n")}` : ""}
${awsKnowledge ? `
AWS T&C DOCUMENTATION REFERENCE:
${awsKnowledge}` : ""}

IMPORTANT: When generating conversation starters and recommended plays, reference the T&C current state and any existing training engagement. If they have existing products, build on that. If they're greenfield, lead with assessment and pilot approaches. Use the AWS T&C documentation reference to recommend specific, real AWS Training & Certification offerings.

Generate the engagement plan. Remember: ground everything in the specific data above. Reference ${persona.name}'s own words and public activity. Make the narrative tell THEIR story, not ours.`;
    const result = await invokeClaudeJSON(
      SYSTEM_PROMPT,
      [{ role: "user", content: userMessage }],
      { maxTokens: 4096, temperature: 0.7 }
    );
    return success(result);
  } catch (err) {
    console.error("Error generating engagement plan:", err);
    return error(500, "Failed to generate engagement plan");
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
