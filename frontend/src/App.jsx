import { useCallback, useEffect, useRef, useState } from 'react'
import CameraPanel from './components/CameraPanel.jsx'
import Sidebar from './components/Sidebar.jsx'

function getApiBase() {
  const v = import.meta.env.VITE_API_URL
  if (v && String(v).length) return String(v).replace(/\/$/, '')
  return import.meta.env.DEV ? '/api' : ''
}

function getWsUrl() {
  const v = import.meta.env.VITE_WS_URL
  if (v && String(v).length) return String(v)
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${window.location.host}/ws`
}

function dataUrlToUint8(dataUrl) {
  const b64 = dataUrl.split(',')[1]
  const binary = atob(b64)
  const arr = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) arr[i] = binary.charCodeAt(i)
  return arr
}

function TopBar({ status }) {
  let dotClass = 'topbar__dot'
  let label = 'OFFLINE'
  if (status === 'connecting') {
    dotClass = 'topbar__dot topbar__dot--muted'
    label = 'CONNECTING'
  } else if (status === 'live') {
    dotClass = 'topbar__dot topbar__dot--pulse'
    label = 'LIVE'
  } else if (status === 'ready') {
    dotClass = 'topbar__dot topbar__dot--static'
    label = 'READY'
  } else {
    dotClass = 'topbar__dot topbar__dot--muted'
    label = 'OFFLINE'
  }

  return (
    <header className="topbar">
      <div className="topbar__brand">
        <span className="topbar__logo" aria-hidden>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path
              d="M7 10c0-2 1.5-4 5-4s5 2 5 4v2M5 12v2c0 3 2.5 5 7 5s7-2 7-5v-2"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
            <path
              d="M9 14l2 2 4-4"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <div className="topbar__titles">
          <span className="topbar__name">Handsign</span>
          <span className="topbar__sub"> / ASL Translator</span>
        </div>
      </div>
      <div className="topbar__right">
        <span className="topbar__badge">ASL → English</span>
        <span className="topbar__status">
          <span className={dotClass} />
          <span className="topbar__status-text">{label}</span>
        </span>
      </div>
    </header>
  )
}

export default function App() {
  const [isConnected, setIsConnected] = useState(false)
  const [isCapturing, setIsCapturing] = useState(false)
  const [currentWord, setCurrentWord] = useState('')
  const [currentConf, setCurrentConf] = useState(0)
  const [sentence, setSentence] = useState([])
  const [history, setHistory] = useState([])
  const [landmarksDetected, setLandmarksDetected] = useState(false)
  const [handDetected, setHandDetected] = useState(false)
  const [landmarks, setLandmarks] = useState(null)
  const [fps, setFps] = useState(0)
  const [mode, setMode] = useState('words')
  const [labelsList, setLabelsList] = useState([])
  const [flashSmoothed, setFlashSmoothed] = useState(false)
  const [wsPhase, setWsPhase] = useState('idle')
  const [showReconnect, setShowReconnect] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)

  const webcamRef = useRef(null)
  const wsRef = useRef(null)
  const rafRef = useRef(null)
  const lastSentRef = useRef(0)
  const fpsFramesRef = useRef([])
  const lastWordAddedRef = useRef(null)
  const reconnectTimerRef = useRef(null)
  const isCapturingRef = useRef(false)
  const sendingRef = useRef(false)

  useEffect(() => {
    isCapturingRef.current = isCapturing
  }, [isCapturing])

  const fetchLabels = useCallback(async () => {
    try {
      const res = await fetch(`${getApiBase()}/labels`)
      if (!res.ok) return
      const data = await res.json()
      if (Array.isArray(data)) setLabelsList(data)
    } catch {
      setLabelsList([])
    }
  }, [])

  useEffect(() => {
    fetchLabels()
  }, [fetchLabels])

  const clearSentenceOnly = useCallback(() => {
    setSentence([])
    lastWordAddedRef.current = null
  }, [])

  const clearAll = useCallback(() => {
    setSentence([])
    setHistory([])
    lastWordAddedRef.current = null
  }, [])

  const handleCopyText = useCallback(async () => {
    const text = sentence.join(' ')
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
  }, [sentence])

  const handleSpeak = useCallback(() => {
    const text = sentence.join(' ')
    if (!text.trim() || typeof window === 'undefined' || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.onstart = () => setIsSpeaking(true)
    u.onend = () => setIsSpeaking(false)
    u.onerror = () => setIsSpeaking(false)
    window.speechSynthesis.speak(u)
  }, [sentence])

  const connectWs = useCallback(() => {
    if (wsRef.current) {
      const s = wsRef.current.readyState
      if (s === WebSocket.OPEN || s === WebSocket.CONNECTING) return
    }

    setWsPhase('connecting')
    setShowReconnect(false)
    const url = getWsUrl()
    const ws = new WebSocket(url)
    ws.binaryType = 'arraybuffer'
    wsRef.current = ws

    ws.onopen = () => {
      setIsConnected(true)
      setWsPhase('open')
    }

    ws.onmessage = (ev) => {
      sendingRef.current = false
      try {
        const data = JSON.parse(ev.data)
        const rawW = data.raw_word || ''
        const rawC = typeof data.raw_confidence === 'number' ? data.raw_confidence : 0
        setCurrentWord(rawW)
        setCurrentConf(rawC)
        setLandmarksDetected(!!data.landmarks_detected)
        setHandDetected(!!data.hand_detected)
        setLandmarks({
          left_hand: data.left_hand,
          right_hand: data.right_hand,
          pose: data.pose
        })

        if (data.word != null && data.word !== '') {
          const w = data.word
          setFlashSmoothed(true)
          setTimeout(() => setFlashSmoothed(false), 400)

          setSentence((prev) => {
            const last = prev.length ? prev[prev.length - 1] : null
            if (last === w) return prev
            lastWordAddedRef.current = w
            return [...prev, w]
          })
          setHistory((h) => {
            const next = [
              { word: w, confidence: data.confidence || rawC, timestamp: Date.now() },
              ...h,
            ]
            return next.slice(0, 20)
          })
        }
      } catch {
        /* ignore */
      }
    }

    ws.onerror = () => {
      setShowReconnect(true)
    }

    ws.onclose = () => {
      wsRef.current = null
      setIsConnected(false)
      setWsPhase('closed')
      if (!isCapturingRef.current) {
        setShowReconnect(false)
        return
      }
      setShowReconnect(true)
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = setTimeout(() => {
        if (isCapturingRef.current) connectWs()
      }, 3000)
    }
  }, [])

  const disconnectWs = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    setIsConnected(false)
    setWsPhase('idle')
    setShowReconnect(false)
  }, [])

  useEffect(() => {
    if (!isCapturing) {
      disconnectWs()
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      return undefined
    }
    connectWs()

    const loop = (now) => {
      rafRef.current = requestAnimationFrame(loop)
      const ws = wsRef.current
      if (!isCapturingRef.current || !webcamRef.current || !ws || ws.readyState !== WebSocket.OPEN) {
        return
      }
      if (sendingRef.current || now - lastSentRef.current < 66) return
      lastSentRef.current = now

      const shot = webcamRef.current.getScreenshot()
      if (!shot) return

      const buf = dataUrlToUint8(shot)
      sendingRef.current = true
      ws.send(buf)

      const frames = fpsFramesRef.current
      frames.push(now)
      const cutoff = now - 1000
      while (frames.length && frames[0] < cutoff) frames.shift()
      setFps(frames.length)
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [isCapturing, connectWs, disconnectWs])

  const toggleCapture = useCallback(() => {
    setIsCapturing((c) => !c)
  }, [])

  const manualReconnect = useCallback(() => {
    disconnectWs()
    setTimeout(() => connectWs(), 0)
  }, [connectWs, disconnectWs])

  let topStatus = 'ready'
  if (!isCapturing) {
    topStatus = 'ready'
  } else if (isConnected) {
    topStatus = 'live'
  } else if (wsPhase === 'closed') {
    topStatus = 'offline'
  } else {
    // idle / connecting / open (before isConnected flush) — avoid false OFFLINE on startup
    topStatus = 'connecting'
  }

  const sentenceText = sentence.join(' ')

  return (
    <div className="shell">
      <TopBar status={topStatus} />
      {showReconnect && isCapturing ? (
        <div className="reconnect-banner">
          <span>
            Can’t reach the backend. Run <code className="reconnect-banner__code">python main.py</code> in
            the <code className="reconnect-banner__code">backend</code> folder (port 8000), then retry.
          </span>
          <button type="button" className="reconnect-banner__btn" onClick={manualReconnect}>
            Reconnect now
          </button>
        </div>
      ) : null}
      <div className="shell__main">
        <CameraPanel
          webcamRef={webcamRef}
          isCapturing={isCapturing}
          currentWord={currentWord}
          currentConf={currentConf}
          flashSmoothed={flashSmoothed}
          handDetected={handDetected}
          isConnected={isConnected}
          landmarks={landmarks}
        />
        <Sidebar
          mode={mode}
          onModeChange={setMode}
          sentence={sentence}
          onClearSentence={clearSentenceOnly}
          history={history}
          wordCount={sentence.length}
          fps={fps}
          landmarksOn={landmarksDetected}
          labelsList={labelsList}
          isCapturing={isCapturing}
          onToggleCapture={toggleCapture}
          onCopyText={handleCopyText}
          onClearAll={clearAll}
          onSpeak={handleSpeak}
          sentenceText={sentenceText}
          isSpeaking={isSpeaking}
        />
      </div>
    </div>
  )
}
