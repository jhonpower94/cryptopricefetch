require('dotenv').config();

const express = require('express');
const axios = require('axios');
const { Redis } = require('@upstash/redis');

const app = express();
const PORT = process.env.PORT || 3000;
const BINANCE_PRICE_API = 'https://api.binance.com/api/v3/ticker/price';
const CACHE_TTL_MS = (() => {
  const rawValue = Number(process.env.CACHE_TTL_MS);
  return Number.isFinite(rawValue) && rawValue > 0 ? rawValue : 15000;
})();
const CACHE_TTL_SECONDS = Math.ceil(CACHE_TTL_MS / 1000);
const memoryCache = new Map();
const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  : null;

function getCacheKey(symbol, quote) {
  return `${String(symbol).toUpperCase()}:${String(quote).toUpperCase()}`;
}

async function getCachedPrice(symbol, quote) {
  const key = getCacheKey(symbol, quote);

  if (redis) {
    const value = await redis.get(key);
    return value ?? null;
  }

  const entry = memoryCache.get(key);
  if (!entry) return null;

  if (Date.now() > entry.expiresAt) {
    memoryCache.delete(key);
    return null;
  }

  return entry.value;
}

async function setCachedPrice(symbol, quote, price) {
  const key = getCacheKey(symbol, quote);

  if (redis) {
    await redis.set(key, price, { ex: CACHE_TTL_SECONDS });
    return;
  }

  memoryCache.set(key, {
    value: price,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

async function fetchBinancePrice(symbol) {
  const response = await axios.get(BINANCE_PRICE_API, {
    params: { symbol },
    timeout: 5000,
  });

  return response.data.price;
}

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'binance-crypto-price-fetcher',
    uptime: process.uptime(),
    cacheTtlMs: CACHE_TTL_MS,
    port: PORT,
    cacheProvider: redis ? 'upstash-redis' : 'memory',
  });
});

function normalizeSymbols(rawSymbols, quote) {
  if (!rawSymbols) return [];

  const list = Array.isArray(rawSymbols) ? rawSymbols : String(rawSymbols).split(',');

  return list
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean)
    .map((value) => {
      const cleaned = value.replace(/[^A-Z0-9]/g, '');
      if (!cleaned) return null;
      return cleaned.endsWith(quote) ? cleaned : `${cleaned}${quote}`;
    })
    .filter(Boolean);
}

app.get('/api/price', async (req, res) => {
  const symbolParam = req.query.symbol || req.query.coin;
  const quote = String(req.query.quote || req.query.base || 'USDT').toUpperCase();

  if (!symbolParam) {
    return res.status(400).json({
      success: false,
      error: "Missing required query parameter: 'symbol'",
    });
  }

  const symbol = normalizeSymbols([symbolParam], quote)[0];

  if (!symbol) {
    return res.status(400).json({
      success: false,
      error: 'Symbol is invalid.',
    });
  }

  try {
    const cachedPrice = await getCachedPrice(symbol, quote);

    if (cachedPrice !== null) {
      return res.json({
        success: true,
        symbol,
        price: cachedPrice,
        source: 'binance',
        cached: true,
      });
    }

    const price = await fetchBinancePrice(symbol);
    await setCachedPrice(symbol, quote, price);

    return res.json({
      success: true,
      symbol,
      price,
      source: 'binance',
      cached: false,
    });
  } catch (error) {
    const message = error.response?.data?.msg || error.message || 'Failed to fetch Binance price';
    const statusCode = error.response?.status || 502;

    return res.status(statusCode).json({
      success: false,
      symbol,
      error: message,
    });
  }
});

app.get('/api/prices', async (req, res) => {
  const symbolsParam = req.query.symbols ?? req.query.symbol;
  const quote = String(req.query.quote || req.query.base || 'USDT').toUpperCase();

  if (!symbolsParam) {
    return res.status(400).json({
      success: false,
      error: "Missing required query parameter: 'symbols'",
    });
  }

  const symbols = normalizeSymbols(symbolsParam, quote);

  if (!symbols.length) {
    return res.status(400).json({
      success: false,
      error: 'No valid crypto symbols provided.',
    });
  }

  try {
    const prices = [];
    const errors = [];
    const missingSymbols = [];

    const cacheChecks = await Promise.all(
      symbols.map(async (symbol) => {
        const cachedPrice = await getCachedPrice(symbol, quote);
        return { symbol, cachedPrice };
      })
    );

    cacheChecks.forEach(({ symbol, cachedPrice }) => {
      if (cachedPrice !== null) {
        prices.push({
          symbol,
          price: cachedPrice,
          source: 'binance',
          cached: true,
        });
      } else {
        missingSymbols.push(symbol);
      }
    });

    if (missingSymbols.length) {
      const priceRequests = missingSymbols.map(async (symbol) => {
        const price = await fetchBinancePrice(symbol);
        await setCachedPrice(symbol, quote, price);

        return {
          symbol,
          price,
          source: 'binance',
          cached: false,
        };
      });

      const priceResults = await Promise.allSettled(priceRequests);

      priceResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          prices.push(result.value);
        } else {
          const details = result.reason || {};
          errors.push({
            symbol: details.symbol || 'unknown',
            error: details.message || 'Failed to fetch price',
          });
        }
      });
    }

    const orderedPrices = symbols
      .map((symbol) => prices.find((entry) => entry.symbol === symbol))
      .filter(Boolean);

    if (!orderedPrices.length) {
      return res.status(502).json({
        success: false,
        quote,
        requestedSymbols: symbols,
        error: 'Failed to fetch any Binance prices.',
        errors,
      });
    }

    return res.json({
      success: true,
      quote,
      requestedSymbols: symbols,
      prices: orderedPrices,
      errors: errors.length ? errors : undefined,
    });
  } catch (error) {
    const message = error.response?.data?.msg || error.message || 'Failed to fetch multiple Binance prices';
    const statusCode = error.response?.status || 502;

    return res.status(statusCode).json({
      success: false,
      error: message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Crypto price API listening on http://localhost:${PORT}`);
});
