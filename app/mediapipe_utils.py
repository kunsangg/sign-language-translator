import numpy as np
import os
import urllib.request
import ssl
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

class MockHolistic:
    def process(self, image):
        class MockResults:
            pose_landmarks = None
            left_hand_landmarks = None
            right_hand_landmarks = None
        return MockResults()

    def close(self):
        pass

class TasksHolistic:
    def __init__(self):
        backend_dir = os.path.dirname(os.path.abspath(__file__))
        hand_model_path = os.path.join(backend_dir, 'hand_landmarker.task')
        pose_model_path = os.path.join(backend_dir, 'pose_landmarker.task')

        ssl_ctx = ssl._create_unverified_context()

        if not os.path.exists(hand_model_path):
            with urllib.request.urlopen("https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task", context=ssl_ctx) as resp, open(hand_model_path, 'wb') as out:
                out.write(resp.read())
        if not os.path.exists(pose_model_path):
            with urllib.request.urlopen("https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task", context=ssl_ctx) as resp, open(pose_model_path, 'wb') as out:
                out.write(resp.read())

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
    Extract pose (33x4), left hand (21x3), right hand (21x3) from Holistic results.
    Normalizes coordinates relative to origins (nose for pose, wrist for hands),
    scales hand coordinates by hand size for distance-invariance,
    and applies hand symmetry fallback for reliable single-hand detection.
    """
    pose_flat = np.zeros(132, dtype=np.float32)
    if getattr(results, "pose_landmarks", None):
        lm = results.pose_landmarks.landmark
        ref_x, ref_y, ref_z = lm[0].x, lm[0].y, lm[0].z
        for i, p in enumerate(lm):
            base = i * 4
            pose_flat[base] = p.x - ref_x
            pose_flat[base + 1] = p.y - ref_y
            pose_flat[base + 2] = p.z - ref_z
            pose_flat[base + 3] = getattr(p, "visibility", 1.0)

    left_hand_flat = np.zeros(63, dtype=np.float32)
    has_left = False
    if getattr(results, "left_hand_landmarks", None):
        lm = results.left_hand_landmarks.landmark
        has_left = True
        wx, wy, wz = lm[0].x, lm[0].y, lm[0].z
        mx, my, mz = lm[9].x, lm[9].y, lm[9].z
        dist = np.sqrt((mx - wx)**2 + (my - wy)**2 + (mz - wz)**2)
        scale = float(dist) if dist > 0.01 else 1.0
        for i, p in enumerate(lm):
            base = i * 3
            left_hand_flat[base] = (p.x - wx) / scale
            left_hand_flat[base + 1] = (p.y - wy) / scale
            left_hand_flat[base + 2] = (p.z - wz) / scale

    right_hand_flat = np.zeros(63, dtype=np.float32)
    has_right = False
    if getattr(results, "right_hand_landmarks", None):
        lm = results.right_hand_landmarks.landmark
        has_right = True
        wx, wy, wz = lm[0].x, lm[0].y, lm[0].z
        mx, my, mz = lm[9].x, lm[9].y, lm[9].z
        dist = np.sqrt((mx - wx)**2 + (my - wy)**2 + (mz - wz)**2)
        scale = float(dist) if dist > 0.01 else 1.0
        for i, p in enumerate(lm):
            base = i * 3
            right_hand_flat[base] = (p.x - wx) / scale
            right_hand_flat[base + 1] = (p.y - wy) / scale
            right_hand_flat[base + 2] = (p.z - wz) / scale

    if has_left and not has_right:
        right_hand_flat = left_hand_flat.copy()
    elif has_right and not has_left:
        left_hand_flat = right_hand_flat.copy()

    return np.concatenate([pose_flat, left_hand_flat, right_hand_flat])

def get_mediapipe_model():
    try:
        import mediapipe as mp
        if hasattr(mp, "solutions") and hasattr(mp.solutions, "holistic"):
            return mp.solutions.holistic.Holistic(
                min_detection_confidence=0.5,
                min_tracking_confidence=0.5,
            )
    except Exception as e:
        print(f"Warning: Could not initialize mp.solutions.holistic ({e}). Trying TasksHolistic.")

    try:
        return TasksHolistic()
    except Exception as e:
        print(f"Warning: Could not initialize TasksHolistic ({e}). Falling back to MockHolistic.")
        return MockHolistic()


