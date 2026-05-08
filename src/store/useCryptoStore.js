import { create } from 'zustand'

const PORTFOLIO_KEY = 'cryptoPortfolio'
const ALERTS_KEY = 'cryptoAlerts'
const THEME_KEY = 'cryptoTheme'

const toNumber = (value) => {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

const readArrayFromStorage = (key) => {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const saveArrayToStorage = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify(data))
  } catch {
    // no-op
  }
}

const readThemeFromStorage = () => {
  try {
    return localStorage.getItem(THEME_KEY) === 'dark'
  } catch {
    return false
  }
}

const getEnv = (viteKey, reactKey, fallback) => {
  const env = import.meta.env || {}
  return env[viteKey] || env[reactKey] || fallback
}

const normalizeCrypto = (coin) => {
  const symbol = `${coin.symbol.toUpperCase()}USDT`
  const sparkline = (coin.sparkline_in_7d?.price || [])
    .slice(-30)
    .map((price) => toNumber(price))

  return {
    id: coin.id,
    name: coin.name,
    symbol,
    baseSymbol: coin.symbol.toUpperCase(),
    price: toNumber(coin.current_price),
    change24h: toNumber(coin.price_change_percentage_24h),
    sparkline,
  }
}

const isAlertTriggered = (alert, price) => {
  if (alert.condition === 'above') return price >= alert.targetPrice
  if (alert.condition === 'below') return price <= alert.targetPrice
  return false
}

export const useCryptoStore = create((set) => ({
  cryptos: [],
  isLoading: false,
  error: '',
  searchQuery: '',
  wsState: 'CLOSED',
  activeView: 'market',
  selectedSymbol: '',
  portfolio: [],
  alerts: [],
  notifications: [],
  isDarkTheme: false,

  hydrateFromStorage: () => {
    const portfolio = readArrayFromStorage(PORTFOLIO_KEY)
    const alerts = readArrayFromStorage(ALERTS_KEY)
    const isDarkTheme = readThemeFromStorage()

    set({ portfolio, alerts, isDarkTheme })
    document.documentElement.classList.toggle('dark', isDarkTheme)
  },

  loadInitialData: async () => {
    set({ isLoading: true, error: '' })
    const apiBase = getEnv(
      'VITE_COINGECKO_API_URL',
      'REACT_APP_COINGECKO_API_URL',
      'https://api.coingecko.com/api/v3',
    )

    try {
      const response = await fetch(
        `${apiBase}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=25&page=1&sparkline=true&price_change_percentage=24h`,
      )
      if (!response.ok) {
        throw new Error(`Initial data request failed with status ${response.status}`)
      }

      const data = await response.json()
      const cryptos = data.map(normalizeCrypto)

      set({ cryptos, isLoading: false, error: '' })
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch crypto data',
      })
    }
  },

  setSearchQuery: (searchQuery) => set({ searchQuery }),

  setWebSocketState: (wsState) => set({ wsState }),

  updatePrice: (symbol, priceRaw) => {
    const nextPrice = toNumber(priceRaw)

    set((state) => {
      const cryptos = state.cryptos.map((crypto) => {
        if (crypto.symbol !== symbol) return crypto
        const nextSparkline = [...crypto.sparkline, nextPrice].slice(-30)
        return {
          ...crypto,
          price: nextPrice,
          sparkline: nextSparkline,
        }
      })

      const byId = new Map(cryptos.map((coin) => [coin.id, coin]))
      const notifications = [...state.notifications]

      for (const alert of state.alerts) {
        const coin = byId.get(alert.id)
        if (!coin) continue
        if (isAlertTriggered(alert, coin.price) && !notifications.includes(alert.id)) {
          notifications.push(alert.id)
        }
      }

      return { cryptos, notifications }
    })
  },

  setActiveView: (activeView) => set({ activeView }),

  setSelectedSymbol: (selectedSymbol) => set({ selectedSymbol }),

  clearNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((item) => item !== id),
    })),

  addPortfolioItem: (item) =>
    set((state) => {
      const portfolioItem = {
        id: item.id,
        quantity: toNumber(item.quantity),
        purchasePrice: toNumber(item.purchasePrice),
      }
      const portfolio = [...state.portfolio, portfolioItem]
      saveArrayToStorage(PORTFOLIO_KEY, portfolio)
      return { portfolio }
    }),

  addAlert: (item) =>
    set((state) => {
      const alert = {
        id: item.id,
        targetPrice: toNumber(item.targetPrice),
        condition: item.condition === 'below' ? 'below' : 'above',
      }
      const alerts = [...state.alerts, alert]
      saveArrayToStorage(ALERTS_KEY, alerts)

      const coin = state.cryptos.find((crypto) => crypto.id === alert.id)
      const notifications = [...state.notifications]
      if (coin && isAlertTriggered(alert, coin.price) && !notifications.includes(alert.id)) {
        notifications.push(alert.id)
      }

      return { alerts, notifications }
    }),

  toggleTheme: () =>
    set((state) => {
      const isDarkTheme = !state.isDarkTheme
      document.documentElement.classList.toggle('dark', isDarkTheme)
      try {
        localStorage.setItem(THEME_KEY, isDarkTheme ? 'dark' : 'light')
      } catch {
        // no-op
      }
      return { isDarkTheme }
    }),
}))
