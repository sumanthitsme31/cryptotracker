import { useEffect, useMemo, useRef } from 'react'
import { useCryptoStore } from '../store/useCryptoStore'

const WS_STATES = {
  0: 'CONNECTING',
  1: 'OPEN',
  2: 'CLOSING',
  3: 'CLOSED',
}
const MAX_WEBSOCKET_SYMBOLS = 40

const getEnv = (viteKey, reactKey, fallback) => {
  const env = import.meta.env || {}
  return env[viteKey] || env[reactKey] || fallback
}

export const useBinanceWebSocket = (symbols) => {
  const setWebSocketState = useCryptoStore((state) => state.setWebSocketState)
  const updatePrice = useCryptoStore((state) => state.updatePrice)
  const reconnectAttempts = useRef(0)

  const wsUrl = getEnv(
    'VITE_BINANCE_WS_URL',
    'REACT_APP_BINANCE_WS_URL',
    'wss://stream.binance.com:9443/ws',
  )

  const stableSymbols = useMemo(
    () => Array.from(new Set(symbols)).filter(Boolean).slice(0, MAX_WEBSOCKET_SYMBOLS),
    [symbols],
  )

  useEffect(() => {
    if (stableSymbols.length === 0) return undefined

    let ws = null
    let shouldReconnect = true
    let reconnectTimer = null

    const connect = () => {
      setWebSocketState('CONNECTING')
      ws = new WebSocket(wsUrl)

      ws.onopen = () => {
        reconnectAttempts.current = 0
        setWebSocketState('OPEN')
        ws.send(
          JSON.stringify({
            method: 'SUBSCRIBE',
            params: stableSymbols.map((symbol) => `${symbol.toLowerCase()}@trade`),
            id: Date.now(),
          }),
        )
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          const payload = data.data || data
          if (!payload?.s || !payload?.p) return
          updatePrice(payload.s, payload.p)
        } catch {
          // no-op
        }
      }

      ws.onerror = () => {
        if (ws) {
          setWebSocketState(WS_STATES[ws.readyState] || 'CLOSED')
        }
      }

      ws.onclose = () => {
        setWebSocketState('CLOSED')
        if (!shouldReconnect) return

        const retryDelay = Math.min(1000 * 2 ** reconnectAttempts.current, 8000)
        reconnectAttempts.current += 1
        reconnectTimer = setTimeout(connect, retryDelay)
      }
    }

    connect()

    return () => {
      shouldReconnect = false
      if (reconnectTimer) clearTimeout(reconnectTimer)
      if (ws && ws.readyState <= 1) {
        setWebSocketState('CLOSING')
        ws.close()
      }
    }
  }, [setWebSocketState, stableSymbols, updatePrice, wsUrl])
}
