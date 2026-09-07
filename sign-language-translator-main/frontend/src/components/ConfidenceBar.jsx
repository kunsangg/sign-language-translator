export default function ConfidenceBar({ confidence, word }) {
  const pct = Math.round(Math.max(0, Math.min(1, confidence)) * 100)
  let tier = 'high'
  if (confidence < 0.6) tier = 'low'
  else if (confidence < 0.8) tier = 'mid'

  return (
    <div className="confidence-bar">
      <div className="confidence-bar__row">
        <span
          className={`confidence-bar__dot confidence-bar__dot--${tier}`}
          aria-hidden
        />
        <span className="confidence-bar__label">CONFIDENCE</span>
        {word ? (
          <span className="confidence-bar__word">{word}</span>
        ) : null}
        <span className="confidence-bar__pct">{pct}%</span>
      </div>
      <div className="confidence-bar__track">
        <div
          className={`confidence-bar__fill confidence-bar__fill--${tier}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
