# 🤟 Real-Time Sign Language Translator

An end-to-end, high-performance **Real-Time American Sign Language (ASL) to English Translator** built with **FastAPI**, **MediaPipe Holistic**, **Keras / TensorFlow (LSTM Neural Network)**, and **Vite + React**.

Captures webcam video frames in the browser, streams JPEGs over WebSockets to the FastAPI server, extracts scale-invariant 258-dimensional landmark features, predicts gesture sequences via an LSTM model, and renders live **Cinema Movie Subtitles** overlays.

---

## ✨ Key Features & Technical Innovations

- **🚀 Ultra-Fast Inference (~0.3s Latency)**:
  - Reduced sequence buffers to **5 frames per sequence**, yielding fast word detection triggers.
- **📐 Scale-Invariant & Position-Independent Normalization**:
  - Keypoints are normalized relative to wrist origin `lm[0]` and scaled by Wrist-to-Middle-MCP distance `dist(lm[0], lm[9])`. The model recognizes signs accurately regardless of how close or far the user stands from the camera.
- **🛡️ Missed-Hand Hysteresis & Tracking Tolerance**:
  - Includes a 6-frame tolerance buffer when hand tracking flickers, preventing artificial zero-padding sequence resets.
- **🎬 Cinema Movie Subtitles UI**:
  - Single-page **`100vh` zero-scroll interface** featuring movie-style subtitles with real-time word popups directly overlaid on the webcam video feed.
- **⚡ Exponential Moving Average (EMA) FPS Metrics**:
  - Smooth, flicker-free ~30 FPS frame rate indicator calculated via `EMA = (0.85 * prev) + (0.15 * raw)`.
- **🧠 Stacked LSTM Neural Network**:
  - Stacked LSTM model with Batch Normalization, Dropout regularization, and 4x on-the-fly Data Augmentation achieving **99.5%+ training accuracy**.

---

## 📚 Vocabulary

### Active Trained Classes (12 Signs)
`bad` • `good` • `hello` • `help` • `love` • `no` • `please` • `sorry` • `stop` • `thanks` • `who` • `yes`

### Extended ASL Vocabulary (24 Total Target Words)
`what` • `where` • `how` • `name` • `friend` • `eat` • `drink` • `water` • `home` • `work` • `learn` • `more`

---

## 📁 Project Structure

```
├── app/
│   ├── main.py             # FastAPI app, WebSocket endpoint (/ws), CORS configuration
│   ├── inference.py        # Keras Inference Engine & 5-frame rolling buffer
│   ├── mediapipe_utils.py  # 258-D landmark extraction & scale-invariant normalization
│   ├── smoother.py         # PredictionSmoother (hysteresis thresholding & hysteresis)
│   ├── model/
│   │   ├── model.h5        # Trained Keras LSTM Model
│   │   └── labels.txt      # Active vocabulary class labels
├── frontend/
│   ├── src/
│   │   ├── App.jsx         # React UI single-page 100vh layout with Cinema Subtitles
│   │   ├── index.css       # Styling, glassmorphism design tokens & movie subtitle overlay
│   │   └── main.jsx        # React root entry point
│   ├── package.json
│   └── vite.config.js      # Vite dev server configuration & backend proxy (/ws, /api)
├── training/
│   ├── collect_data.py     # Interactive OpenCV webcam sequence collector
│   ├── dataset_loader.py   # Dataset loader with train/val stratified splits
│   ├── train.py            # LSTM training pipeline with 4x data augmentation
│   ├── evaluate.py         # Confusion matrix & model validation reporter
│   └── data/               # Recorded .npy landmark sequence files
├── run.py                  # Root launcher for backend server (Uvicorn)
├── requirements.txt        # Python dependencies
└── README.md               # Project documentation
```

---

## ⚡ Quick Start

### 1. Prerequisites & Environment Setup

Clone the repository and set up a Python environment (Python 3.10+):

```bash
git clone https://github.com/kunsangg/sign-language-translator.git
cd sign-language-translator

python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

---

### 2. Start Backend Server

Launch the FastAPI backend server (serves HTTP on port `8000` and WebSocket on `/ws`):

```bash
python run.py
```

Verify backend health at: `http://localhost:8000/health` (returns `{"status": "ok", "model_loaded": true}`).

---

### 3. Start Frontend UI

In a new terminal, launch the Vite dev server:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` in your web browser and grant webcam permissions to start translating!

---

## 🎯 Dataset Collection & Model Retraining

### Collect Custom / New Sign Sequences

To record new hand sign sequences using your camera:

```bash
python training/collect_data.py
```

- Each sign records 5 fast sequences (5 frames each).
- `.npy` sequence files are automatically saved under `training/data/{sign}/`.

---

### Re-Train Neural Network Model

To train the LSTM neural network on all collected signs:

```bash
python training/train.py
```

- Automatically applies **4x data augmentation** (gaussian noise, scale jitter, spatial translation).
- Exports the best model to `app/model/model.h5` and labels to `app/model/labels.txt`.
- Generates `training/training_curves.png`.

---

## 📜 Technical Pipeline Architecture

```
[ Web Camera ]
      │ (JPEG over WebSocket @ 30 FPS)
      ▼
[ FastAPI WebSocket (/ws) ]
      │
      ▼
[ MediaPipe Holistic ] ──> (258 Keypoints: Pose + Wrist-Scaled Hands)
      │
      ▼
[ 5-Frame Rolling Sequence Buffer ]
      │
      ▼
[ LSTM Neural Network ] ──> (Softmax Confidence Probabilities)
      │
      ▼
[ Prediction Smoother ] ──> (Hysteresis & Consecutive Match Verification)
      │
      ▼
[ Cinema Subtitles Overlay ] (React Frontend Render)
```

---

## 🛡️ License

Distributed under the MIT License. Feel free to use, modify, and distribute.
