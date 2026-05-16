import { useEffect, useState } from 'react'

export default function Controls({
  isCapturing,
  onToggleCapture,
  onCopyText,
  onClear,
  onSpeak,
  sentenceText,
  isSpeaking,
}) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return undefined
    const t = setTimeout(() => setCopied(false), 1200)
    return () => clearTimeout(t)
  }, [copied])

  const handleCopy = async () => {
    await onCopyText()
    setCopied(true)
  }

  return (
    <div className="controls">
      <button
        type="button"
        className={`controls__start ${isCapturing ? 'controls__start--stop' : ''}`}
        onClick={onToggleCapture}
      >
        {isCapturing ? '■ Stop' : '▶ Start Camera'}
      </button>
      <div className="controls__grid">
        <button type="button" className="controls__btn" onClick={handleCopy}>
          {copied ? '✓ Copied' : 'Copy text'}
        </button>
        <button type="button" className="controls__btn controls__btn--clear" onClick={onClear}>
          Clear
        </button>
        <button
          type="button"
          className="controls__btn controls__btn--speak"
          onClick={onSpeak}
          disabled={!sentenceText.trim()}
        >
          {isSpeaking ? '◉ Speaking…' : 'Speak'}
        </button>
      </div>
    </div>
  )
}
