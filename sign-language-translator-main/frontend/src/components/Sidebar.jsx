import Controls from './Controls.jsx'
import SentenceBuilder from './SentenceBuilder.jsx'
import WordHistory from './WordHistory.jsx'

export default function Sidebar({
  mode,
  onModeChange,
  sentence,
  onClearSentence,
  history,
  wordCount,
  fps,
  landmarksOn,
  labelsList,
  isCapturing,
  onToggleCapture,
  onCopyText,
  onClearAll,
  onSpeak,
  sentenceText,
  isSpeaking,
}) {
  return (
    <aside className="sidebar">
      <div className="sidebar__modes">
        <span className="sidebar__section-label">Mode</span>
        <div className="sidebar__mode-btns">
          <button
            type="button"
            className={`sidebar__mode ${mode === 'words' ? 'sidebar__mode--active' : ''}`}
            onClick={() => onModeChange('words')}
          >
            Words
          </button>
          <button
            type="button"
            className={`sidebar__mode ${mode === 'letters' ? 'sidebar__mode--active' : ''}`}
            onClick={() => onModeChange('letters')}
          >
            Letters
          </button>
          <button
            type="button"
            className={`sidebar__mode ${mode === 'phrases' ? 'sidebar__mode--active' : ''}`}
            onClick={() => onModeChange('phrases')}
          >
            Phrases
          </button>
        </div>
      </div>
      <SentenceBuilder sentence={sentence} onClear={onClearSentence} />
      {labelsList && labelsList.length > 0 ? (
        <p className="sidebar__vocab">{labelsList.length} signs in vocabulary</p>
      ) : null}
      <div className="sidebar__stats">
        <div className="sidebar__stat">
          <div className="sidebar__stat-value">{wordCount}</div>
          <div className="sidebar__stat-label">Words</div>
        </div>
        <div className="sidebar__stat">
          <div className="sidebar__stat-value">{fps}</div>
          <div className="sidebar__stat-label">FPS</div>
        </div>
        <div className="sidebar__stat">
          <div className="sidebar__stat-value">{landmarksOn ? 'ON' : '—'}</div>
          <div className="sidebar__stat-label">Landmarks</div>
        </div>
      </div>
      <WordHistory history={history} />
      <Controls
        isCapturing={isCapturing}
        onToggleCapture={onToggleCapture}
        onCopyText={onCopyText}
        onClear={onClearAll}
        onSpeak={onSpeak}
        sentenceText={sentenceText}
        isSpeaking={isSpeaking}
      />
    </aside>
  )
}
