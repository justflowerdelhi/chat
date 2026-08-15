const PRICES: Record<string, { prompt: number; completion: number }> = {
  'gpt-4o-mini': { prompt: 0.00015, completion: 0.0006 },
  'gpt-4o': { prompt: 0.0025, completion: 0.01 },
};

export function calculateOpenAICost(model: string, promptTokens: number, completionTokens: number): number {
  const price = PRICES[model] || { prompt: 0.0025, completion: 0.01 };
  return promptTokens * price.prompt + completionTokens * price.completion;
}
