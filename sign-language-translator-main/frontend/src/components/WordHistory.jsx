function badgeClass(confidence) {
  const pct = confidence * 100
  if (pct >= 80) return 'word-history__badge word-history__badge--high'
  if (pct >= 60) return 'word-history__badge word-history__badge--mid'
  return 'word-history__badge word-history__badge--low'
}

export default function WordHistory({ history }) {
  return (
    <div className="word-history">
      <div className="word-history__title">Recent detections</div>
      <div className="word-history__list">
        {history.length === 0 ? (
          <p className="word-history__empty">Detected signs will appear here</p>
        ) : (
          history.map((item, idx) => (
            <div key={`${item.timestamp}-${idx}`} className="word-history__item">
              <span className="word-history__word">{item.word}</span>
              <span className={badgeClass(item.confidence)}>
                {Math.round(item.confidence * 100)}%
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
