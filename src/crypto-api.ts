// CoinGecko free API wrapper — real HTTP calls, retry with backoff.

const BASE_URL = "https://api.coingecko.com/api/v3";
const MAX_RETRIES = 3;

async function fetchWithRetry(path: string): Promise<unknown> {
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(`${BASE_URL}${path}`, {
        headers: { Accept: "application/json" },
      });
      if (response.status === 429) {
        const retryAfter = response.headers.get("Retry-After");
        const delay = retryAfter ? parseInt(retryAfter, 10) * 1000 : 2000 * (attempt + 1);
        await sleep(delay);
        continue;
      }
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.json();
    } catch (err) {
      lastError = err;
      if (attempt < MAX_RETRIES - 1) {
        await sleep(1000 * (attempt + 1));
      }
    }
  }
  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface CoinSearchResult {
  id: string;
  name: string;
  symbol: string;
  marketCapRank: number | null;
}

export interface CoinPrice {
  usd: number;
  usd24hChange: number;
}

export async function searchCoins(query: string): Promise<CoinSearchResult[]> {
  try {
    const data = (await fetchWithRetry(`/search?query=${encodeURIComponent(query)}`)) as {
      coins?: Array<{ id: string; name: string; symbol: string; market_cap_rank: number | null }>;
    };
    if (!data.coins) return [];
    return data.coins.slice(0, 10).map((c) => ({
      id: c.id,
      name: c.name,
      symbol: c.symbol.toUpperCase(),
      marketCapRank: c.market_cap_rank,
    }));
  } catch {
    return [];
  }
}

export async function getPrice(coinId: string): Promise<CoinPrice | null> {
  try {
    const data = (await fetchWithRetry(
      `/simple/price?ids=${encodeURIComponent(coinId)}&vs_currencies=usd&include_24hr_change=true`,
    )) as Record<string, { usd?: number; usd_24h_change?: number }>;
    const entry = data[coinId];
    if (!entry || entry.usd == null) return null;
    return {
      usd: entry.usd,
      usd24hChange: entry.usd_24h_change ?? 0,
    };
  } catch {
    return null;
  }
}

export async function getPrices(coinIds: string[]): Promise<Record<string, CoinPrice>> {
  if (coinIds.length === 0) return {};
  try {
    const ids = coinIds.map(encodeURIComponent).join(",");
    const data = (await fetchWithRetry(
      `/simple/price?ids=${ids}&vs_currencies=usd&include_24h_change=true`,
    )) as Record<string, { usd?: number; usd_24h_change?: number }>;
    const result: Record<string, CoinPrice> = {};
    for (const [id, entry] of Object.entries(data)) {
      if (entry.usd != null) {
        result[id] = {
          usd: entry.usd,
          usd24hChange: entry.usd_24h_change ?? 0,
        };
      }
    }
    return result;
  } catch {
    return {};
  }
}
