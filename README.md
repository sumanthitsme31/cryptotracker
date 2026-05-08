# CryptoTracker

Real-time cryptocurrency dashboard built with React, Zustand, CoinGecko REST API, and Binance WebSocket streams.

## Features

- Initial market data fetch from CoinGecko
- Live price updates via Binance WebSocket
- Search/filter by coin name/symbol
- Sparkline charts per row and detailed price chart modal
- Portfolio management persisted to `localStorage` (`cryptoPortfolio`)
- Price alerts persisted to `localStorage` (`cryptoAlerts`)
- Alert notifications when thresholds are met
- Light/dark theme switcher (`html.dark`)
- Dockerized frontend deployment with Nginx and healthcheck

## Environment

Copy `.env.example` to `.env` and adjust values if needed.

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

## Build and lint

```bash
npm run lint
npm run build
```

## Run with Docker Compose

```bash
docker-compose up -d --build
```

Open `http://localhost:8080`.

Health endpoint: `http://localhost:8080/health`

## Required test IDs

Implemented IDs include:

- `search-input`
- `crypto-row-<symbol>`
- `price-<symbol>`
- `sparkline-<symbol>`
- `price-change-24h-<symbol>` with `data-direction`
- `portfolio-item-<id>`
- `portfolio-total-value`
- `portfolio-pl`
- `price-chart`
- `alert-notification-<id>`

## WebSocket state verification

The app exposes:

```js
window.getWebSocketState()
```

Returns one of: `CONNECTING`, `OPEN`, `CLOSING`, `CLOSED`.
