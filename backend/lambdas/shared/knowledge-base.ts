import { BedrockAgentRuntimeClient, RetrieveCommand } from '@aws-sdk/client-bedrock-agent-runtime';

const client = new BedrockAgentRuntimeClient({
  region: process.env.BEDROCK_REGION || 'us-east-1',
});

const KNOWLEDGE_BASE_ID = process.env.KNOWLEDGE_BASE_ID || 'TJHYCVRLXH';

/**
 * Retrieve relevant content from the T&C Training Strategy Knowledge Base.
 * Returns concatenated text chunks relevant to the query.
 */
export async function retrieveFromKnowledgeBase(query: string, maxResults = 5): Promise<string> {
  try {
    const command = new RetrieveCommand({
      knowledgeBaseId: KNOWLEDGE_BASE_ID,
      retrievalQuery: { text: query },
      retrievalConfiguration: {
        vectorSearchConfiguration: {
          numberOfResults: maxResults,
        },
      },
    });

    const response = await client.send(command);
    const results = response.retrievalResults || [];

    if (results.length === 0) return '';

    const chunks = results
      .filter(r => r.content?.text)
      .map(r => r.content!.text!)
      .join('\n\n---\n\n');

    return chunks.slice(0, 3000); // Limit to avoid prompt bloat
  } catch (err) {
    console.warn('Knowledge base retrieval failed:', err);
    return '';
  }
}

/**
 * Retrieve T&C strategy content relevant to a specific industry and persona.
 */
export async function getTCStrategyContext(industry: string, persona: string, topics: string[] = []): Promise<string> {
  const queries = [
    `${persona} executive engagement strategy ${industry} training certification`,
    ...topics.slice(0, 2).map(t => `${t} workforce development ${industry}`),
  ];

  const results = await Promise.all(
    queries.map(q => retrieveFromKnowledgeBase(q, 3).catch(() => ''))
  );

  const combined = results.filter(Boolean).join('\n\n');
  if (!combined) return '';

  return `\n\nT&C KNOWLEDGE BASE CONTEXT:\n${combined.slice(0, 4000)}`;
}
