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

// lambdas/persona-intel/index.ts
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

// lambdas/persona-intel/index.ts
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
- AWS Training & Certification offerings: AWS Skill Builder, Classroom Training, AWS Certification programs, AWS Skills Guild, AWS Cloud Institute
- Executive engagement and relationship building
- Understanding executive motivations and communication styles

YOUR ROLE: Build a persona intelligence profile for a specific executive to help the AWS T&C Skills Enablement team prepare for an engagement conversation.

GUARDRAILS:
1. NEVER INFER about people or data you don't have. Only reference confirmed data from search results.
2. If search results found real data about this person, reference it. If not, focus on what their role/title typically cares about.
3. CHAMPION DESIGNATION: Only set is_aws_champion to true if search results EXPLICITLY show AWS-related activity (posts about AWS, AWS certifications, AWS events attendance).
4. Be honest about what you know vs. don't know.
5. Frame the engagement angle through skills transformation: how can T&C help this person achieve their goals?`;
async function handler(event) {
  try {
    const body = JSON.parse(event.body || "{}");
    const { personaName, personaTitle, company, industry } = body;
    if (!personaName || !company) {
      return error(400, "personaName and company are required");
    }
    const cacheKey = `persona-intel:${personaName.toLowerCase().replace(/\s+/g, "-")}:${company.toLowerCase().replace(/\s+/g, "-")}`;
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
    const [linkedinResults, cloudAIResults, companyResults] = await Promise.all([
      googleSearch(`"${personaName}" "${company}" site:linkedin.com`).catch(() => ""),
      googleSearch(`"${personaName}" "${company}" cloud OR AI OR training OR transformation`).catch(() => ""),
      googleSearch(`"${personaName}" "${company}" ${industry}`).catch(() => "")
    ]);
    const searchContext = [
      linkedinResults ? `LINKEDIN SEARCH:
${linkedinResults}` : "",
      cloudAIResults ? `CLOUD/AI ACTIVITY SEARCH:
${cloudAIResults}` : "",
      companyResults ? `COMPANY/INDUSTRY SEARCH:
${companyResults}` : ""
    ].filter(Boolean).join("\n\n");
    const userMessage = `Build a persona intelligence profile for this executive:

NAME: ${personaName}
TITLE: ${personaTitle || "Unknown"}
COMPANY: ${company}
INDUSTRY: ${industry || "Technology"}

SEARCH RESULTS:
${searchContext || "No search results found for this person."}

Return JSON:
{
  "name": "${personaName}",
  "title": "${personaTitle || "Unknown"}",
  "company": "${company}",
  "linkedin_summary": "What we found about them on LinkedIn (or 'No LinkedIn data found' if nothing)",
  "recent_activity": ["Recent posts, talks, or activity found \u2014 empty array if none found"],
  "interests": ["Topics they care about based on search results and their role"],
  "engagement_angle": "How to approach this person for a T&C/skills transformation conversation \u2014 be specific and actionable",
  "is_aws_champion": false
}

IMPORTANT: Only include information that was ACTUALLY found in the search results. Do not fabricate LinkedIn profiles or activity. If no data was found, say so honestly and base recommendations on their role/title.`;
    const result = await invokeClaudeJSON(
      SYSTEM_PROMPT,
      [{ role: "user", content: userMessage }],
      { maxTokens: 1024, temperature: 0.5 }
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
    } catch {
    }
    return success(result);
  } catch (err) {
    console.error("Error generating persona intelligence:", err);
    return error(500, "Failed to generate persona intelligence");
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
