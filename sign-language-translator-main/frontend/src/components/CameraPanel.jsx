import Webcam from 'react-webcam'
import ConfidenceBar from './ConfidenceBar.jsx'

export default function CameraPanel({
  webcamRef,
  isCapturing,
  currentWord,
  currentConf,
  flashSmoothed,
  handDetected,
  isConnected,
}) {
  return (
    <section className="camera-panel">
      <div className="camera-panel__frame">
        {!isCapturing ? (
          <div className="camera-panel__placeholder">
            <span className="camera-panel__placeholder-icon" aria-hidden>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                <path
                  d="M4 7a2 2 0 012-2h2l1-1h6l1 1h2a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V7z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <circle cx="12" cy="13" r="3" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </span>
            <p>Click Start to begin</p>
          </div>
        ) : null}
        <Webcam
          audio={false}
          ref={webcamRef}
          mirrored
          screenshotFormat="image/jpeg"
          screenshotQuality={0.6}
          videoConstraints={{ facingMode: 'user' }}
          width="100%"
          height="100%"
          className="camera-panel__video"
        />
        {isCapturing ? (
          <>
            <div className="camera-panel__grid" aria-hidden />
            <div
              className={`camera-panel__scanline ${isConnected ? '' : 'camera-panel__scanline--dim'}`}
              aria-hidden
            />
            <div className={`camera-panel__bracket camera-panel__bracket--tl ${handDetected ? 'camera-panel__bracket--on' : ''}`} />
            <div className={`camera-panel__bracket camera-panel__bracket--tr ${handDetected ? 'camera-panel__bracket--on' : ''}`} />
            <div className={`camera-panel__bracket camera-panel__bracket--bl ${handDetected ? 'camera-panel__bracket--on' : ''}`} />
            <div className={`camera-panel__bracket camera-panel__bracket--br ${handDetected ? 'camera-panel__bracket--on' : ''}`} />
            <div
              className={`camera-panel__hand-badge ${
                handDetected ? 'camera-panel__hand-badge--ok' : 'camera-panel__hand-badge--bad'
              }`}
            >
              {handDetected ? 'HAND DETECTED' : 'NO HAND'}
            </div>
          </>
        ) : null}
      </div>
      <div className="camera-panel__caption">
        <div className="camera-panel__caption-label">Live translation</div>
        <div className={`camera-panel__word-row ${flashSmoothed ? 'camera-panel__word-row--flash' : ''}`}>
          <span className="camera-panel__word">
            {currentWord || '—'}
            <span className="camera-panel__cursor" aria-hidden>
              |
            </span>
          </span>
        </div>
        <ConfidenceBar confidence={currentConf} word={currentWord} />
        {isCapturing && !handDetected ? (
          <p className="camera-panel__hint">Show your hand to the camera</p>
        ) : null}
      </div>
    </section>
  )
}
