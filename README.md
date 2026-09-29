# Crypto Price Fetch API

A small Express API that fetches live crypto prices from Binance for one or many requested symbols.

## Production URL

```text
https://cryptopricefetch.vercel.app
```

Use this as the base URL in frontend code.

For local development only:

```text
http://localhost:3000
```

## Start the server

```bash
npm install
npm start
```

## Endpoints

### Health check

```bash
curl "https://cryptopricefetch.vercel.app/health"
```

### Single coin price

```bash
curl "https://cryptopricefetch.vercel.app/api/price?symbol=btc"
curl "https://cryptopricefetch.vercel.app/api/price?symbol=BTCUSDT"
curl "https://cryptopricefetch.vercel.app/api/price?symbol=eth&quote=USDT"
```

### Multiple coin prices

```bash
curl "https://cryptopricefetch.vercel.app/api/prices?symbols=btc,eth,sol"
curl "https://cryptopricefetch.vercel.app/api/prices?symbols=BTCUSDT,ETHUSDT,SOLUSDT"
curl "https://cryptopricefetch.vercel.app/api/prices?symbols=btc,eth&quote=USDT"
```

### Local dev examples

```bash
curl "http://localhost:3000/health"
curl "http://localhost:3000/api/price?symbol=btc"
```

## Example response

```json
{
  "success": true,
  "quote": "USDT",
  "requestedSymbols": ["BTCUSDT", "ETHUSDT", "SOLUSDT"],
  "prices": [
    { "symbol": "BTCUSDT", "price": "59875.50", "source": "binance" },
    { "symbol": "ETHUSDT", "price": "3124.00", "source": "binance" },
    { "symbol": "SOLUSDT", "price": "148.20", "source": "binance" }
  ]
}
```
