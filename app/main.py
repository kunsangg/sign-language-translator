import logging
from pathlib import Path

import cv2
import numpy as np
import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.inference import InferenceEngine
from app.mediapipe_utils import extract_keypoints, get_mediapipe_model
from app.smoother import PredictionSmoother

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Handsign API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BACKEND_DIR = Path(__file__).resolve().parent
LABELS_PATH = BACKEND_DIR / "model" / "labels.txt"
MODEL_PATH = BACKEND_DIR / "model" / "model.h5"


def _load_labels_list():
    default = [
        "hello", "thanks", "yes", "no", "please", "sorry", "help", "good",
        "bad", "more", "stop", "love", "what", "where", "who", "how",
        "name", "friend", "eat", "drink", "water", "home", "work", "learn",
    ]
    if LABELS_PATH.is_file():
        with open(LABELS_PATH, "r", encoding="utf-8") as f:
            loaded = [line.strip() for line in f if line.strip()]
        if loaded:
            return loaded
    return default


@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": MODEL_PATH.is_file()}


@app.get("/labels")
def labels():
    return _load_labels_list()


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    inference = InferenceEngine(
        model_path=str(BACKEND_DIR / "model" / "model.h5"),
        sequence_length=30,
    )
    smoother = PredictionSmoother(
        threshold=0.50,
        min_frames=3,
        cooldown_frames=6,
    )
    holistic = get_mediapipe_model()

    try:
        while True:
            data = await websocket.receive_bytes()

            frame = cv2.imdecode(np.frombuffer(data, dtype=np.uint8), cv2.IMREAD_COLOR)
            if frame is None:
                await websocket.send_json(
                    {
                        "word": None,
                        "confidence": 0.0,
                        "raw_word": "",
                        "raw_confidence": 0.0,
                        "landmarks_detected": False,
                        "hand_detected": False,
                    }
                )
                continue

            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            rgb.flags.writeable = False
            results = holistic.process(rgb)

            pose_ok = results.pose_landmarks is not None
            left_ok = results.left_hand_landmarks is not None
            right_ok = results.right_hand_landmarks is not None
            landmarks_detected = pose_ok or left_ok or right_ok
            hand_detected = left_ok or right_ok

            keypoints = extract_keypoints(results)
            
            raw_word = ""
            raw_confidence = 0.0
            smoothed_word = None
            out_confidence = 0.0

            smoother.tick()

            if not hand_detected:
                inference.reset()
                smoother.update(None, 0.0)
            else:
                inference.add_frame(keypoints)
                pred = inference.predict()
                if pred is not None:
                    raw_word = pred["word"]
                    raw_confidence = float(pred["confidence"])
                    emitted = smoother.update(raw_word, raw_confidence)
                    if emitted is not None:
                        smoothed_word = emitted
                        out_confidence = raw_confidence
                else:
                    smoother.update(None, 0.0)


            def format_landmarks(lm_list):
                if not lm_list: return None
                return [{"x": p.x, "y": p.y} for p in lm_list.landmark]

            await websocket.send_json(
                {
                    "word": smoothed_word,
                    "confidence": out_confidence,
                    "raw_word": raw_word,
                    "raw_confidence": raw_confidence,
                    "landmarks_detected": landmarks_detected,
                    "hand_detected": hand_detected,
                    "left_hand": format_landmarks(results.left_hand_landmarks),
                    "right_hand": format_landmarks(results.right_hand_landmarks),
                    "pose": format_landmarks(results.pose_landmarks),
                }
            )
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected")
    finally:
        holistic.close()
        inference.reset()
        smoother.reset()

frontend_dist = BACKEND_DIR.parent / "frontend" / "dist"
if frontend_dist.is_dir():
    assets_dir = frontend_dist / "assets"
    if assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        if full_path == "" or full_path == "/":
            return FileResponse(frontend_dist / "index.html")
        requested_file = frontend_dist / full_path
        if requested_file.is_file():
            return FileResponse(requested_file)
        return FileResponse(frontend_dist / "index.html")

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=False)
