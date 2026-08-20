/**
 * Tavily Search API client
 * 
 * Replaces fragile Google scraping with a reliable search API.
 * The API key is stored as a Lambda environment variable (TAVILY_API_KEY).
 * Users don't need their own accounts — the key is server-side.
 */

const TAVILY_API_URL = 'https://api.tavily.com/search';

export interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

export interface TavilyResponse {
  results: TavilySearchResult[];
  answer?: string;
}

/**
 * Search the web using Tavily API.
 * Returns a formatted string of results suitable for Bedrock prompts.
 * 
 * @param query - Search query string
 * @param options - Optional configuration
 * @returns Formatted search results as a string (empty string if no results/error)
 */
export async function tavilySearch(
  query: string,
  options?: {
    maxResults?: number;
    includeAnswer?: boolean;
    searchDepth?: 'basic' | 'advanced';
    includeDomains?: string[];
  }
): Promise<string> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    console.warn('TAVILY_API_KEY not configured — search unavailable');
    return '';
  }

  try {
    const response = await fetch(TAVILY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query,
        max_results: options?.maxResults ?? 5,
        include_answer: options?.includeAnswer ?? false,
        search_depth: options?.searchDepth ?? 'basic',
        ...(options?.includeDomains?.length ? { include_domains: options.includeDomains } : {}),
      }),
    });

    if (!response.ok) {
      console.warn(`Tavily search failed (${response.status}):`, await response.text().catch(() => ''));
      return '';
    }

    const data: TavilyResponse = await response.json() as TavilyResponse;

    if (!data.results || data.results.length === 0) {
      return '';
    }

    // Format results as structured text for Bedrock prompts
    const formatted = data.results
      .map(r => `[${r.title}](${r.url})\n${r.content}`)
      .join('\n\n');

    return data.answer ? `SUMMARY: ${data.answer}\n\nSOURCES:\n${formatted}` : formatted;
  } catch (err) {
    console.warn('Tavily search error:', err);
    return '';
  }
}

/**
 * Search LinkedIn specifically using Tavily.
 * Constrains results to linkedin.com domain.
 */
export async function tavilyLinkedInSearch(query: string, maxResults = 5): Promise<string> {
  return tavilySearch(query, {
    maxResults,
    includeDomains: ['linkedin.com'],
  });
}

/**
 * Search Glassdoor specifically using Tavily.
 */
export async function tavilyGlassdoorSearch(query: string, maxResults = 3): Promise<string> {
  return tavilySearch(query, {
    maxResults,
    includeDomains: ['glassdoor.com'],
  });
}
