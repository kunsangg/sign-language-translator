import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
import urllib.request
import os
import cv2
import numpy as np

if not os.path.exists('hand_landmarker.task'):
    print("Downloading hand model...")
    urllib.request.urlretrieve("https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task", "hand_landmarker.task")
if not os.path.exists('pose_landmarker.task'):
    print("Downloading pose model...")
    urllib.request.urlretrieve("https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task", "pose_landmarker.task")

base_options_hand = python.BaseOptions(model_asset_path='hand_landmarker.task', delegate=python.BaseOptions.Delegate.CPU)
options_hand = vision.HandLandmarkerOptions(base_options=base_options_hand, num_hands=2)
hand_landmarker = vision.HandLandmarker.create_from_options(options_hand)

img = np.zeros((480, 640, 3), dtype=np.uint8)
mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=img)
res = hand_landmarker.detect(mp_image)
print("Hand results:", res)
