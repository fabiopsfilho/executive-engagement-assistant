/**
 * AWS Knowledge MCP Server integration
 * Fetches official AWS T&C documentation to ground AI responses in real product knowledge.
 * Server: https://knowledge-mcp.global.api.aws
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
 * Call the AWS Knowledge MCP server's search_documentation tool
 */
async function callMCPTool(toolName: string, args: Record<string, unknown>): Promise<string> {
  try {
    const response = await fetch(`${MCP_SERVER_URL}/mcp/v1/tools/call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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
    topic: 'training-certification',
  });
}

/**
 * Get T&C product knowledge for engagement context
 * Searches for relevant AWS Training & Certification documentation
 */
export async function getTCProductKnowledge(industry: string, topics: string[]): Promise<string> {
  const queries = [
    `AWS Training Certification ${industry} workforce development`,
    `AWS Skill Builder enterprise subscription features`,
    ...topics.slice(0, 2).map(t => `AWS Training ${t}`),
  ];

  const results = await Promise.all(
    queries.map(q => searchAWSDocumentation(q).catch(() => ''))
  );

  const combined = results.filter(Boolean).join('\n\n');
  return combined.slice(0, 2000); // Limit to avoid prompt bloat
}

/**
 * Get latest AWS T&C announcements and features
 */
export async function getLatestTCAnnouncements(): Promise<string> {
  return searchAWSDocumentation('AWS Training Certification new features announcements 2025 2026');
}

/**
 * Get engagement-specific T&C knowledge for a given industry and persona
 */
export async function getEngagementKnowledge(industry: string, persona: string): Promise<string> {
  const queries = [
    `AWS Training Certification ${industry} executive engagement ${persona}`,
    `AWS Skill Builder workforce transformation ${industry}`,
  ];

  const results = await Promise.all(
    queries.map(q => searchAWSDocumentation(q).catch(() => ''))
  );

  return results.filter(Boolean).join('\n\n').slice(0, 2000);
}
