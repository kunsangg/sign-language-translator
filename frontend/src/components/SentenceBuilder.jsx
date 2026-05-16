export default function SentenceBuilder({ sentence, onClear }) {
  const text = sentence.join(' ')
  const charCount = text.length

  return (
    <div className="sentence-builder">
      <div className="sentence-builder__head">
        <span className="sentence-builder__title">Sentence</span>
        <button type="button" className="sentence-builder__clear" onClick={onClear}>
          Clear
        </button>
      </div>
      <div className="sentence-builder__box">
        {sentence.length === 0 ? (
          <p className="sentence-builder__empty">
            Your translated sentence will appear here
          </p>
        ) : (
          <p className="sentence-builder__words">
            {sentence.map((w, i) => (
              <span key={`${w}-${i}`} className="sentence-builder__word">
                {w}
                {i < sentence.length - 1 ? ' ' : ''}
              </span>
            ))}
          </p>
        )}
        <span className="sentence-builder__count">{charCount} chars</span>
      </div>
    </div>
  )
}
