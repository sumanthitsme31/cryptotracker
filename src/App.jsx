import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { useBinanceWebSocket } from './hooks/useBinanceWebSocket'
import { useCryptoStore } from './store/useCryptoStore'

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value >= 1000 ? 2 : 6,
  }).format(value)

const formatPercent = (value) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`

function Sparkline({ points, testId, width = 110, height = 28 }) {
  if (!points || points.length < 2) {
    return <svg data-testid={testId} width={width} height={height} />
  }

  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = max - min || 1

  const path = points
    .map((point, index) => {
      const x = (index / (points.length - 1)) * width
      const y = height - ((point - min) / range) * height
      return `${x},${y}`
    })
    .join(' ')

  return (
    <svg data-testid={testId} width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline fill="none" stroke="currentColor" strokeWidth="2" points={path} />
    </svg>
  )
}

function App() {
  const {
    cryptos,
    isLoading,
    error,
    searchQuery,
    wsState,
    activeView,
    selectedSymbol,
    portfolio,
    alerts,
    notifications,
    isDarkTheme,
    hydrateFromStorage,
    loadInitialData,
    setSearchQuery,
    setActiveView,
    setSelectedSymbol,
    addPortfolioItem,
    addAlert,
    clearNotification,
    toggleTheme,
  } = useCryptoStore()

  const [portfolioForm, setPortfolioForm] = useState({ id: 'bitcoin', quantity: '1', purchasePrice: '0' })
  const [alertForm, setAlertForm] = useState({ id: 'bitcoin', targetPrice: '0', condition: 'above' })

  useEffect(() => {
    hydrateFromStorage()
    loadInitialData()
  }, [hydrateFromStorage, loadInitialData])

  const symbols = useMemo(() => cryptos.map((coin) => coin.symbol), [cryptos])
  useBinanceWebSocket(symbols)

  useEffect(() => {
    window.getWebSocketState = () => wsState
    return () => {
      delete window.getWebSocketState
    }
  }, [wsState])

  const filteredCryptos = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return cryptos
    return cryptos.filter(
      (coin) =>
        coin.name.toLowerCase().includes(query) ||
        coin.baseSymbol.toLowerCase().includes(query) ||
        coin.symbol.toLowerCase().includes(query),
    )
  }, [cryptos, searchQuery])

  const selectedCrypto = cryptos.find((coin) => coin.symbol === selectedSymbol)

  const currentPriceById = useMemo(() => {
    const map = new Map()
    for (const coin of cryptos) map.set(coin.id, coin.price)
    return map
  }, [cryptos])

  const portfolioSummary = useMemo(() => {
    return portfolio.reduce(
      (acc, item) => {
        const currentPrice = currentPriceById.get(item.id) || 0
        const totalValue = item.quantity * currentPrice
        const totalCost = item.quantity * item.purchasePrice
        acc.totalValue += totalValue
        acc.totalPL += totalValue - totalCost
        return acc
      },
      { totalValue: 0, totalPL: 0 },
    )
  }, [currentPriceById, portfolio])

  const handleAddPortfolio = (event) => {
    event.preventDefault()
    addPortfolioItem(portfolioForm)
  }

  const handleAddAlert = (event) => {
    event.preventDefault()
    addAlert(alertForm)
  }

  return (
    <main className="app-shell">
      <header className="toolbar">
        <h1>Crypto Tracker</h1>
        <div className="toolbar-actions">
          <button type="button" onClick={() => setActiveView('market')} className={activeView === 'market' ? 'active' : ''}>
            Market
          </button>
          <button type="button" onClick={() => setActiveView('portfolio')} className={activeView === 'portfolio' ? 'active' : ''}>
            Portfolio
          </button>
          <button data-testid="theme-switcher" type="button" onClick={toggleTheme}>
            {isDarkTheme ? 'Light' : 'Dark'} Theme
          </button>
        </div>
      </header>

      <section className="status-row">
        <span>WebSocket: {wsState}</span>
        {error && <span className="error">{error}</span>}
      </section>

      {notifications.map((id) => (
        <div key={id} className="alert" data-testid={`alert-notification-${id}`}>
          <span>Price alert triggered for {id}</span>
          <button type="button" onClick={() => clearNotification(id)}>
            Dismiss
          </button>
        </div>
      ))}

      {activeView === 'market' && (
        <>
          <input
            data-testid="search-input"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search by name or symbol"
          />

          {isLoading && <p>Loading market data...</p>}

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Price</th>
                  <th>24h</th>
                  <th>Trend</th>
                </tr>
              </thead>
              <tbody>
                {filteredCryptos.map((coin) => {
                  const direction = coin.change24h >= 0 ? 'up' : 'down'
                  return (
                    <tr
                      key={coin.symbol}
                      data-testid={`crypto-row-${coin.symbol}`}
                      onClick={() => setSelectedSymbol(coin.symbol)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') setSelectedSymbol(coin.symbol)
                      }}
                      tabIndex={0}
                    >
                      <td>{coin.name} ({coin.symbol})</td>
                      <td data-testid={`price-${coin.symbol}`}>{formatCurrency(coin.price)}</td>
                      <td data-testid={`price-change-24h-${coin.symbol}`} data-direction={direction} className={direction}>
                        {formatPercent(coin.change24h)}
                      </td>
                      <td>
                        <Sparkline testId={`sparkline-${coin.symbol}`} points={coin.sparkline} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeView === 'portfolio' && (
        <section className="portfolio-grid">
          <article>
            <h2>Your Portfolio</h2>
            <form onSubmit={handleAddPortfolio} className="form-block">
              <select
                value={portfolioForm.id}
                onChange={(event) => setPortfolioForm((prev) => ({ ...prev, id: event.target.value }))}
              >
                {cryptos.map((coin) => (
                  <option key={coin.id} value={coin.id}>
                    {coin.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                step="any"
                value={portfolioForm.quantity}
                onChange={(event) => setPortfolioForm((prev) => ({ ...prev, quantity: event.target.value }))}
                placeholder="Quantity"
              />
              <input
                type="number"
                step="any"
                value={portfolioForm.purchasePrice}
                onChange={(event) => setPortfolioForm((prev) => ({ ...prev, purchasePrice: event.target.value }))}
                placeholder="Purchase price"
              />
              <button type="submit">Add Holding</button>
            </form>

            <ul className="portfolio-list">
              {portfolio.map((item, index) => (
                <li key={`${item.id}-${index}`} data-testid={`portfolio-item-${item.id}`}>
                  {item.id} · Qty {item.quantity} · Buy {formatCurrency(item.purchasePrice)}
                </li>
              ))}
            </ul>

            <p data-testid="portfolio-total-value">Total Value: {formatCurrency(portfolioSummary.totalValue)}</p>
            <p data-testid="portfolio-pl">P/L: {formatCurrency(portfolioSummary.totalPL)}</p>
          </article>

          <article>
            <h2>Price Alerts</h2>
            <form onSubmit={handleAddAlert} className="form-block">
              <select
                value={alertForm.id}
                onChange={(event) => setAlertForm((prev) => ({ ...prev, id: event.target.value }))}
              >
                {cryptos.map((coin) => (
                  <option key={coin.id} value={coin.id}>
                    {coin.name}
                  </option>
                ))}
              </select>
              <select
                value={alertForm.condition}
                onChange={(event) => setAlertForm((prev) => ({ ...prev, condition: event.target.value }))}
              >
                <option value="above">Above</option>
                <option value="below">Below</option>
              </select>
              <input
                type="number"
                step="any"
                value={alertForm.targetPrice}
                onChange={(event) => setAlertForm((prev) => ({ ...prev, targetPrice: event.target.value }))}
                placeholder="Target price"
              />
              <button type="submit">Add Alert</button>
            </form>

            <ul className="portfolio-list">
              {alerts.map((alert, index) => (
                <li key={`${alert.id}-${alert.condition}-${index}`}>
                  {alert.id} {alert.condition} {formatCurrency(alert.targetPrice)}
                </li>
              ))}
            </ul>
          </article>
        </section>
      )}

      {selectedCrypto && (
        <div className="modal-backdrop" onClick={() => setSelectedSymbol('')}>
          <section className="modal" onClick={(event) => event.stopPropagation()}>
            <h2>{selectedCrypto.name} Details</h2>
            <p>Current Price: {formatCurrency(selectedCrypto.price)}</p>
            <Sparkline testId="price-chart" points={selectedCrypto.sparkline} width={520} height={220} />
            <button type="button" onClick={() => setSelectedSymbol('')}>
              Close
            </button>
          </section>
        </div>
      )}
    </main>
  )
}

export default App
