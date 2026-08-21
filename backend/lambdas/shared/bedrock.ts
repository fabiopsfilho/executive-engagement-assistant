import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

const client = new BedrockRuntimeClient({
  region: process.env.BEDROCK_REGION || 'us-east-1',
});

export interface BedrockMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function invokeClaudeJSON<T>(
  systemPrompt: string,
  messages: BedrockMessage[],
  options: { maxTokens?: number; temperature?: number } = {}
): Promise<T> {
  const { maxTokens = 4096, temperature = 0.7 } = options;

  const body = JSON.stringify({
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: maxTokens,
    temperature,
    system: systemPrompt,
    messages: messages.map(m => ({
      role: m.role,
      content: m.content,
    })),
  });

  const command = new InvokeModelCommand({
    modelId: process.env.BEDROCK_MODEL_ID || 'us.anthropic.claude-haiku-4-5-20251001-v1:0',
    contentType: 'application/json',
    accept: 'application/json',
    body: new TextEncoder().encode(body),
  });

  const response = await client.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));
  const text = responseBody.content[0].text;

  // Try to parse as JSON (Claude often wraps in markdown code blocks)
  let jsonStr = text.trim();

  // Strip leading ```json or ``` fence (with or without a closing fence — handles truncation)
  const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)(?:```|$)/);
  if (fenceMatch) {
    jsonStr = fenceMatch[1].trim();
  }

  // Isolate the JSON object/array if there's leading prose
  const firstBrace = jsonStr.search(/[{[]/);
  if (firstBrace > 0) {
    jsonStr = jsonStr.slice(firstBrace);
  }

  try {
    return JSON.parse(jsonStr) as T;
  } catch {
    // Attempt to repair truncated JSON (e.g. hit max_tokens mid-output)
    try {
      return JSON.parse(repairTruncatedJson(jsonStr)) as T;
    } catch {
      // If JSON parsing still fails, return the raw text wrapped in an object
      return { raw: text } as unknown as T;
    }
  }
}

/**
 * Best-effort repair of JSON truncated mid-output. Closes an unterminated
 * string then balances any open braces/brackets.
 */
function repairTruncatedJson(s: string): string {
  let str = s.trim();
  const quoteCount = (str.match(/(?<!\\)"/g) || []).length;
  if (quoteCount % 2 !== 0) str += '"';
  const opens: string[] = [];
  for (const ch of str) {
    if (ch === '{' || ch === '[') opens.push(ch);
    else if (ch === '}' || ch === ']') opens.pop();
  }
  str = str.replace(/,\s*$/, '');
  while (opens.length) {
    const o = opens.pop();
    str += o === '{' ? '}' : ']';
  }
  return str;
}

export async function invokeClaudeText(
  systemPrompt: string,
  messages: BedrockMessage[],
  options: { maxTokens?: number; temperature?: number } = {}
): Promise<string> {
  const { maxTokens = 4096, temperature = 0.7 } = options;

  const body = JSON.stringify({
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: maxTokens,
    temperature,
    system: systemPrompt,
    messages: messages.map(m => ({
      role: m.role,
      content: m.content,
    })),
  });

  const command = new InvokeModelCommand({
    modelId: process.env.BEDROCK_MODEL_ID || 'us.anthropic.claude-haiku-4-5-20251001-v1:0',
    contentType: 'application/json',
    accept: 'application/json',
    body: new TextEncoder().encode(body),
  });

  const response = await client.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));
  return responseBody.content[0].text;
}
