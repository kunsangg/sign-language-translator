import numpy as np
import os
import urllib.request
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

class TasksHolistic:
    def __init__(self):
        backend_dir = os.path.dirname(os.path.abspath(__file__))
        hand_model_path = os.path.join(backend_dir, 'hand_landmarker.task')
        pose_model_path = os.path.join(backend_dir, 'pose_landmarker.task')

        if not os.path.exists(hand_model_path):
            urllib.request.urlretrieve("https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task", hand_model_path)
        if not os.path.exists(pose_model_path):
            urllib.request.urlretrieve("https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task", pose_model_path)

        base_options_hand = python.BaseOptions(model_asset_path=hand_model_path)
        options_hand = vision.HandLandmarkerOptions(base_options=base_options_hand, num_hands=2)
        self.hand_landmarker = vision.HandLandmarker.create_from_options(options_hand)

        base_options_pose = python.BaseOptions(model_asset_path=pose_model_path)
        options_pose = vision.PoseLandmarkerOptions(base_options=base_options_pose)
        self.pose_landmarker = vision.PoseLandmarker.create_from_options(options_pose)

    def process(self, image):
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=image)
        hand_result = self.hand_landmarker.detect(mp_image)
        pose_result = self.pose_landmarker.detect(mp_image)

        class LandmarkList:
            def __init__(self, lms):
                self.landmark = lms

        class Results:
            def __init__(self):
                self.pose_landmarks = None
                self.left_hand_landmarks = None
                self.right_hand_landmarks = None

        res = Results()
        if pose_result.pose_landmarks:
            res.pose_landmarks = LandmarkList(pose_result.pose_landmarks[0])

        if hand_result.hand_landmarks:
            for i, handedness in enumerate(hand_result.handedness):
                # category_name is typically 'Left' or 'Right'
                if handedness[0].category_name == 'Left':
                    res.left_hand_landmarks = LandmarkList(hand_result.hand_landmarks[i])
                else:
                    res.right_hand_landmarks = LandmarkList(hand_result.hand_landmarks[i])

        return res

    def close(self):
        self.hand_landmarker.close()
        self.pose_landmarker.close()


def extract_keypoints(results) -> np.ndarray:
    """
    Extract pose (33A-4), left hand (21A-3), right hand (21A-3) from Holistic results.
    Returns flat array of shape (258,). Face landmarks are excluded.
    """
    pose_flat = np.zeros(132, dtype=np.float32)
    if getattr(results, "pose_landmarks", None):
        lm = results.pose_landmarks.landmark
        for i, p in enumerate(lm):
            base = i * 4
            pose_flat[base] = p.x
            pose_flat[base + 1] = p.y
            pose_flat[base + 2] = p.z
            pose_flat[base + 3] = getattr(p, "visibility", 1.0) # Tasks API might not have visibility on hands

    left_hand_flat = np.zeros(63, dtype=np.float32)
    if getattr(results, "left_hand_landmarks", None):
        lm = results.left_hand_landmarks.landmark
        for i, p in enumerate(lm):
            base = i * 3
            left_hand_flat[base] = p.x
            left_hand_flat[base + 1] = p.y
            left_hand_flat[base + 2] = p.z

    right_hand_flat = np.zeros(63, dtype=np.float32)
    if getattr(results, "right_hand_landmarks", None):
        lm = results.right_hand_landmarks.landmark
        for i, p in enumerate(lm):
            base = i * 3
            right_hand_flat[base] = p.x
            right_hand_flat[base + 1] = p.y
            right_hand_flat[base + 2] = p.z

    return np.concatenate([pose_flat, left_hand_flat, right_hand_flat])

def get_mediapipe_model():
    return TasksHolistic()
