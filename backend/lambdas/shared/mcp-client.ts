/**
 * AWS Knowledge MCP Server Client
 * Queries https://knowledge-mcp.global.api.aws for AWS documentation,
 * T&C product info, best practices, and recommendations.
 */

const MCP_SERVER_URL = 'https://knowledge-mcp.global.api.aws';

interface MCPToolCall {
  method: string;
  params: {
    name: string;
    arguments: Record<string, unknown>;
  };
}

interface MCPResponse {
  content?: { type: string; text: string }[];
  error?: string;
}

/**
 * Call an MCP tool on the AWS Knowledge server
 */
async function callMCPTool(toolName: string, args: Record<string, unknown>): Promise<string> {
  try {
    const response = await fetch(`${MCP_SERVER_URL}/mcp/v1/tools/call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: args,
        },
      }),
    });

    if (!response.ok) {
      console.warn(`MCP tool ${toolName} returned ${response.status}`);
      return '';
    }

    const data: MCPResponse = await response.json();
    if (data.content && data.content.length > 0) {
      return data.content.map(c => c.text).join('\n');
    }
    return '';
  } catch (err) {
    console.warn(`MCP tool ${toolName} failed:`, err);
    return '';
  }
}

/**
 * Search AWS documentation for T&C-related content
 */
export async function searchAWSDocumentation(query: string): Promise<string> {
  return callMCPTool('search_documentation', {
    search_phrase: query,
    topic: 'training',
  });
}

/**
 * Get AWS T&C product documentation
 * Searches for Skill Builder, Certifications, Training delivery info
 */
export async function getTCProductDocs(productName: string): Promise<string> {
  return callMCPTool('search_documentation', {
    search_phrase: `AWS Training Certification ${productName}`,
  });
}

/**
 * Get recommendations for T&C engagement based on industry
 */
export async function getAWSRecommendations(industry: string): Promise<string> {
  return callMCPTool('search_documentation', {
    search_phrase: `AWS Training Certification ${industry} workforce development best practices`,
  });
}

/**
 * Fetch T&C-relevant AWS knowledge for an engagement context
 * Returns a combined string of relevant documentation snippets
 */
export async function fetchTCKnowledge(companyIndustry: string, topics: string[]): Promise<string> {
  const searches = [
    searchAWSDocumentation(`AWS Skill Builder enterprise training ${companyIndustry}`),
    searchAWSDocumentation(`AWS Certification program workforce development`),
    ...topics.slice(0, 2).map(t => searchAWSDocumentation(`AWS Training ${t}`)),
  ];

  const results = await Promise.allSettled(searches);
  const successful = results
    .filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled' && r.value.length > 0)
    .map(r => r.value);

  if (successful.length === 0) return '';

  return `AWS T&C DOCUMENTATION CONTEXT:\n${successful.slice(0, 3).join('\n\n').slice(0, 2000)}`;
}
