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
async function googleSearch(query) {
  try {
    const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=5&hl=en`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9"
      }
    });
    if (!response.ok) return "";
    const html = await response.text();
    const snippets = [];
    const matches = html.match(/<div[^>]*class="[^"]*"[^>]*>([^<]{40,300})<\/div>/g) || [];
    for (const match of matches.slice(0, 8)) {
      const text = match.replace(/<[^>]+>/g, "").trim();
      if (text.length > 40 && !text.includes("Google") && !text.includes("Sign in") && !text.includes("cookie")) {
        snippets.push(text);
      }
    }
    const textMatches = html.match(/class="BNeawe[^"]*"[^>]*>([^<]{20,500})/g) || [];
    for (const match of textMatches.slice(0, 6)) {
      const text = match.replace(/class="BNeawe[^"]*"[^>]*>/, "").trim();
      if (text.length > 20) snippets.push(text);
    }
    return snippets.slice(0, 8).join("\n");
  } catch {
    return "";
  }
}
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

SPECIFIC FUNCTION \u2014 INTELLIGENCE ANALYSIS:
Your role here is to help the T&C Skills Enablement team identify opportunities for skills transformation conversations with customer executives.

ADDITIONAL GUARDRAILS:
1. NEVER INFER OR SPECULATE. Only report what was ACTUALLY FOUND in search results or provided data.
2. If no data was found for a person or topic, DO NOT include them. Omit them entirely \u2014 never say "unavailable" or "no data found".
3. CHAMPION DESIGNATION: Only designate someone as an "AWS champion" if search results explicitly show AWS-related activity (posts about AWS, AWS certifications, AWS events attendance). Otherwise, do not use that term.
4. EXECUTIVE VOICES: Only include executives where REAL public data was found (LinkedIn posts, conference talks, published articles). If the search returned nothing for a person, exclude them completely from the response.
5. Frame everything through the T&C lens: skills transformation, workforce development, training ROI, certification programs, learning culture.
6. Be honest about what you know vs. don't know. If data is limited, say "Based on available data..." not "This person is..."

For BUZZ (What people are saying): Only report what was actually found in search results \u2014 real LinkedIn posts, real Glassdoor reviews, real news articles. If nothing was found, say so briefly and focus on what IS available.

For NOW (What to focus on): Based on CONFIRMED signals only, recommend what the T&C team should prioritize for skills transformation conversations.

Return ONLY valid JSON. For any array field, return an empty array [] if no real data was found \u2014 do NOT fill with speculation.`;
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
    const companyName = accountData.customer_name || "Unknown";
    const [mcpDocs, kbDocs, linkedinResults, glassdoorResults, newsResults, executiveResults] = await Promise.all([
      getTCProductKnowledge(industry, ["workforce transformation", "talent development"]).catch(() => ""),
      getTCStrategyContext(industry, "CTO", accountData.ebc_data?.themes || []).catch(() => ""),
      googleSearch(`${companyName} site:linkedin.com cloud AI engineer jobs`).catch(() => ""),
      googleSearch(`${companyName} site:glassdoor.com reviews culture training development`).catch(() => ""),
      googleSearch(`${companyName} cloud AI digital transformation 2025 2026 news`).catch(() => ""),
      googleSearch(`"${companyName}" CEO OR CTO OR CFO OR CHRO site:linkedin.com`).catch(() => "")
    ]);
    const awsContext = [mcpDocs, kbDocs].filter(Boolean).join("\n\n");
    const onlineSearch = [
      linkedinResults ? `LINKEDIN SEARCH RESULTS:
${linkedinResults}` : "",
      glassdoorResults ? `GLASSDOOR SEARCH RESULTS:
${glassdoorResults}` : "",
      newsResults ? `NEWS & TRANSFORMATION SEARCH:
${newsResults}` : "",
      executiveResults ? `EXECUTIVE LINKEDIN PROFILES:
${executiveResults}` : ""
    ].filter(Boolean).join("\n\n");
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
${awsContext.slice(0, 3e3)}` : ""}
${onlineSearch ? `
REAL-TIME ONLINE SEARCH RESULTS:
${onlineSearch.slice(0, 3e3)}` : ""}`;
    const userMessage = `Analyze this account's intelligence and generate both BUZZ and NOW insights. Be highly specific \u2014 reference actual names, numbers, and quotes from the data.

Use the T&C Knowledge Base content as your primary reference for recommendations. The online search results supplement this with real-time data about the specific company.

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
