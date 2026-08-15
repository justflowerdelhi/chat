type FetchOptions = RequestInit & { timeout?: number };

export async function fetchWithRetry(
  url: string,
  options: FetchOptions = {},
  { retries = 3, retryDelay = 500, retryOn = [408, 429, 500, 502, 503, 504] } = {}
): Promise<Response> {
  const { timeout = 10000, ...rest } = options;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, { ...rest, signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok && retryOn.includes(response.status) && attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay * Math.pow(2, attempt)));
        continue;
      }

      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (attempt === retries) throw error;
      await new Promise((resolve) => setTimeout(resolve, retryDelay * Math.pow(2, attempt)));
    }
  }

  throw new Error(`fetchWithRetry exhausted retries for ${url}`);
}
