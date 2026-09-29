# Crypto Price Fetch API

A small Express API that fetches live crypto prices from Binance for one or many requested symbols.

## Start the server

```bash
npm install
npm start
```

The app runs on:

```text
http://localhost:3000
```

## Endpoints

### Health check

```bash
curl http://localhost:3000/health
```

### Single coin price

```bash
curl "http://localhost:3000/api/price?symbol=btc"
curl "http://localhost:3000/api/price?symbol=BTCUSDT"
curl "http://localhost:3000/api/price?symbol=eth&quote=USDT"
```

### Multiple coin prices

```bash
curl "http://localhost:3000/api/prices?symbols=btc,eth,sol"
curl "http://localhost:3000/api/prices?symbols=BTCUSDT,ETHUSDT,SOLUSDT"
curl "http://localhost:3000/api/prices?symbols=btc,eth&quote=USDT"
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
