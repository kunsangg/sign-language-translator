import { useEffect, useRef } from 'react'
import Webcam from 'react-webcam'
import ConfidenceBar from './ConfidenceBar.jsx'

const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [0, 17], [17, 18], [18, 19], [19, 20]
]

const POSE_CONNECTIONS = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24]
]

export default function CameraPanel({
  webcamRef,
  isCapturing,
  currentWord,
  currentConf,
  flashSmoothed,
  handDetected,
  isConnected,
  landmarks,
  sentence = [],
}) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const width = canvas.width
    const height = canvas.height

    ctx.clearRect(0, 0, width, height)

    if (landmarks && isCapturing) {
      const draw = (pts, conns, color) => {
        if (!pts) return
        ctx.strokeStyle = color
        ctx.lineWidth = 2
        ctx.fillStyle = color

        if (conns) {
          for (const [start, end] of conns) {
            const p1 = pts[start]
            const p2 = pts[end]
            if (p1 && p2) {
              ctx.beginPath()
              ctx.moveTo(p1.x * width, p1.y * height)
              ctx.lineTo(p2.x * width, p2.y * height)
              ctx.stroke()
            }
          }
        }
        for (const point of pts) {
          ctx.beginPath()
          ctx.arc(point.x * width, point.y * height, 3, 0, 2 * Math.PI)
          ctx.fill()
        }
      }

      draw(landmarks.pose, POSE_CONNECTIONS, 'rgba(255, 255, 255, 0.5)')
      draw(landmarks.left_hand, HAND_CONNECTIONS, 'rgba(0, 255, 0, 0.8)')
      draw(landmarks.right_hand, HAND_CONNECTIONS, 'rgba(255, 165, 0, 0.8)')
    }
  }, [landmarks, isCapturing])

  return (
    <section className="camera-panel">
      <div className="camera-panel__frame" style={{ position: 'relative' }}>
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
        {/* We use intrinsic resolution 640x480 to match typical webcam, objectFit cover handles scaling */}
        <canvas
          ref={canvasRef}
          width={640}
          height={480}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: 'scaleX(-1)', /* mirror it to match the webcam */
            pointerEvents: 'none',
            display: isCapturing ? 'block' : 'none'
          }}
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

            {/* Movie Subtitles & Live Word Popup Overlay */}
            <div className="movie-subtitles">
              {currentWord ? (
                <div className={`movie-subtitles__popup ${flashSmoothed ? 'movie-subtitles__popup--flash' : ''}`}>
                  <span className="movie-subtitles__popup-word">{currentWord}</span>
                </div>
              ) : null}
              {sentence.length === 0 && !currentWord ? (
                <span className="movie-subtitles__placeholder">
                  [Subtitles will appear here as you sign]
                </span>
              ) : (
                <p className="movie-subtitles__text">
                  {sentence.map((w, idx) => (
                    <span key={`${w}-${idx}`} className="movie-subtitles__word">
                      {w}{' '}
                    </span>
                  ))}
                  {currentWord && sentence[sentence.length - 1] !== currentWord ? (
                    <span className="movie-subtitles__active">{currentWord}</span>
                  ) : null}
                </p>
              )}
            </div>
          </>
        ) : null}
      </div>
      <div className="camera-panel__caption">
        <div className="camera-panel__caption-label">Live sentence translation</div>
        <div className={`camera-panel__word-row ${flashSmoothed ? 'camera-panel__word-row--flash' : ''}`}>
          <span className="camera-panel__word">
            {sentence.length > 0 ? sentence.join(' ') + (currentWord && sentence[sentence.length - 1] !== currentWord ? ' ' + currentWord : '') : (currentWord || '—')}
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
