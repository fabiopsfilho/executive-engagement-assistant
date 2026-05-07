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

// lambdas/intelligence/index.ts
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

// lambdas/intelligence/index.ts
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
    const urlMatches = html.match(/href="\/url\?q=([^&"]+)/g) || [];
    const urls = urlMatches.map((m) => decodeURIComponent(m.replace('href="/url?q=', ""))).filter((u) => u.startsWith("http") && !u.includes("google.com"));
    if (urls.length > 0) {
      snippets.push(`URLS FOUND: ${urls.slice(0, 5).join(" | ")}`);
    }
    const matches = html.match(/<div[^>]*class="[^"]*"[^>]*>([^<]{40,300})<\/div>/g) || [];
    for (const match of matches.slice(0, 10)) {
      const text = match.replace(/<[^>]+>/g, "").trim();
      if (text.length > 40 && !text.includes("Google") && !text.includes("Sign in") && !text.includes("cookie")) {
        snippets.push(text);
      }
    }
    const textMatches = html.match(/class="BNeawe[^"]*"[^>]*>([^<]{20,500})/g) || [];
    for (const match of textMatches.slice(0, 8)) {
      const text = match.replace(/class="BNeawe[^"]*"[^>]*>/, "").trim();
      if (text.length > 20) {
        snippets.push(text);
      }
    }
    return snippets.slice(0, 10).join("\n");
  } catch (e) {
    console.warn("Google search failed for:", query, e);
    return "";
  }
}
var SYSTEM_PROMPT = `You are an intelligence analyst supporting the AWS Training & Certification Skills Enablement team. You will receive REAL Google search results about a company. Extract and structure ONLY factual information found in the search results into JSON.

CRITICAL GUARDRAILS:
1. ONLY include information that is DIRECTLY supported by the search results provided.
2. For executive_social: ONLY include executives where you found REAL LinkedIn posts or profiles in the search results. Include the LinkedIn URL if visible. If no executive social data was found, return an empty array [].
3. NEVER fabricate names, titles, quotes, or data. If search results are empty or irrelevant, return empty arrays/zero values.
4. For linkedin_job_postings: Only include real numbers if found in search results. If not found, use 0 and empty string.
5. For glassdoor_signals: Only include REAL review excerpts found in search results. If none found, return empty array [].
6. Do NOT label anything as an estimate or unavailable \u2014 just omit what wasn't found.

JSON structure:
{"earnings_call_signals":["quote1","quote2"],"linkedin_job_postings":{"cloud_ai_roles":number,"yoy_change":"+X%"},"executive_social":[{"name":"Real Name","title":"Real Title","post_theme":"What they posted about","url":"https://linkedin.com/..."}],"glassdoor_signals":["real review excerpt"],"industry_context":"context from news","news_signals":["real news"],"signals":[{"severity":"HIGH","label":"label","evidence":"evidence from search"}],"tc_opportunity_score":number}

Return ONLY valid JSON, no markdown.`;
async function handler(event) {
  try {
    const accountId = event.pathParameters?.accountId;
    if (!accountId) {
      return error(400, "accountId is required");
    }
    const companyName = event.queryStringParameters?.company || accountId;
    const industry = event.queryStringParameters?.industry || "Technology";
    const cacheKey = `intelligence:${companyName.toLowerCase().replace(/\s+/g, "-")}`;
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
    const [linkedinResults, glassdoorResults, newsResults, dataBookResults, executivePostsResults] = await Promise.all([
      googleSearch(`${companyName} site:linkedin.com/jobs cloud AI engineer`),
      googleSearch(`${companyName} site:glassdoor.com reviews culture training`),
      googleSearch(`${companyName} cloud AI digital transformation 2025 2026 news`),
      googleSearch(`${companyName} AWS cloud spend revenue technology investment`),
      googleSearch(`"${companyName}" CEO OR CTO OR CFO OR CHRO site:linkedin.com`)
    ]);
    const searchContext = [
      linkedinResults ? `LINKEDIN JOB POSTINGS:
${linkedinResults}` : "",
      executivePostsResults ? `EXECUTIVE LINKEDIN PROFILES & POSTS:
${executivePostsResults}` : "",
      glassdoorResults ? `GLASSDOOR EMPLOYEE REVIEWS:
${glassdoorResults}` : "",
      newsResults ? `COMPANY NEWS & TRANSFORMATION:
${newsResults}` : "",
      dataBookResults ? `COMPANY DATA, REVENUE & INVESTMENT:
${dataBookResults}` : ""
    ].filter(Boolean).join("\n\n");
    const userMessage = searchContext ? `Based on these REAL Google search results about ${companyName} (${industry}), extract and structure the intelligence into JSON. Only use facts from the search results:

${searchContext}` : `Generate workforce intelligence JSON for: ${companyName} (${industry}). Note: no search results available \u2014 use your training knowledge to provide relevant industry context and signals. Do not label anything as an estimate.`;
    const result = await invokeClaudeJSON(
      SYSTEM_PROMPT,
      [{ role: "user", content: userMessage }],
      { maxTokens: 2048, temperature: 0.3 }
    );
    try {
      await ddb.send(new import_lib_dynamodb.PutCommand({
        TableName: process.env.INTELLIGENCE_CACHE_TABLE,
        Item: {
          cacheKey,
          data: result,
          ttl: Math.floor(Date.now() / 1e3) + 86400,
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        }
      }));
    } catch (cacheErr) {
      console.warn("Failed to cache:", cacheErr);
    }
    return success(result);
  } catch (err) {
    console.error("Error generating intelligence:", err);
    return error(500, "Failed to generate intelligence");
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
