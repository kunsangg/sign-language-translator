import os
from pathlib import Path
import matplotlib.pyplot as plt
import numpy as np

from dataset_loader import load_dataset

SCRIPT_DIR = Path(__file__).resolve().parent
BACKEND_MODEL_DIR = SCRIPT_DIR.parent / "app" / "model"
MODEL_OUT_H5 = BACKEND_MODEL_DIR / "model.h5"
MODEL_OUT_PKL = BACKEND_MODEL_DIR / "model.pkl"
LABELS_OUT = BACKEND_MODEL_DIR / "labels.txt"
CURVES_OUT = SCRIPT_DIR / "training_curves.png"


def augment_sequence(seq: np.ndarray) -> np.ndarray:
    """
    Augment a keypoint sequence (30, 258) with noise, scaling, and shift.
    """
    aug = seq.copy()
    # Add random noise
    noise = np.random.normal(0, 0.005, size=aug.shape)
    aug += noise
    # Random scale factor between 0.95 and 1.05
    scale = np.random.uniform(0.95, 1.05)
    aug[:, :132] *= scale
    aug[:, 132:] *= scale
    # Random small shift
    shift_x = np.random.uniform(-0.02, 0.02)
    shift_y = np.random.uniform(-0.02, 0.02)
    # Apply shift to x, y channels
    for i in range(0, 132, 4):
        aug[:, i] += shift_x
        aug[:, i + 1] += shift_y
    for i in range(132, 258, 3):
        aug[:, i] += shift_x
        aug[:, i + 1] += shift_y
    return aug


def train_with_tensorflow(X_train, X_val, y_train, y_val, num_classes, label_names):
    import tensorflow as tf
    from tensorflow.keras.callbacks import EarlyStopping, ModelCheckpoint, ReduceLROnPlateau
    from tensorflow.keras.layers import Dense, Dropout, LSTM, BatchNormalization
    from tensorflow.keras.models import Sequential
    from tensorflow.keras.optimizers import Adam

    # Perform 4x Data Augmentation on X_train
    augmented_X = [X_train]
    augmented_y = [y_train]
    for _ in range(3):
        aug_X = np.stack([augment_sequence(s) for s in X_train], axis=0)
        augmented_X.append(aug_X)
        augmented_y.append(y_train)

    X_train_aug = np.concatenate(augmented_X, axis=0)
    y_train_aug = np.concatenate(augmented_y, axis=0)

    # Shuffle augmented dataset
    perm = np.random.permutation(len(X_train_aug))
    X_train_aug = X_train_aug[perm]
    y_train_aug = y_train_aug[perm]

    y_train_oh = tf.keras.utils.to_categorical(y_train_aug, num_classes)
    y_val_oh = tf.keras.utils.to_categorical(y_val, num_classes)

    seq_len = X_train.shape[1]
    model = Sequential(
        [
            LSTM(128, return_sequences=True, input_shape=(seq_len, 258)),
            BatchNormalization(),
            Dropout(0.3),
            LSTM(128, return_sequences=True),
            BatchNormalization(),
            Dropout(0.3),
            LSTM(64, return_sequences=False),
            BatchNormalization(),
            Dropout(0.3),
            Dense(64, activation="relu"),
            Dropout(0.2),
            Dense(num_classes, activation="softmax"),
        ]
    )

    model.compile(
        optimizer=Adam(learning_rate=0.001),
        loss="categorical_crossentropy",
        metrics=["accuracy"],
    )

    callbacks = [
        EarlyStopping(
            monitor="val_loss",
            patience=20,
            restore_best_weights=True,
        ),
        ReduceLROnPlateau(
            monitor="val_loss",
            factor=0.5,
            patience=7,
        ),
        ModelCheckpoint(
            filepath=str(MODEL_OUT_H5),
            monitor="val_loss",
            save_best_only=True,
        ),
    ]

    history = model.fit(
        X_train_aug,
        y_train_oh,
        validation_data=(X_val, y_val_oh),
        epochs=120,
        batch_size=32,
        callbacks=callbacks,
        verbose=1,
    )

    model.save(str(MODEL_OUT_H5))

    train_acc = float(history.history["accuracy"][-1])
    val_acc = float(history.history["val_accuracy"][-1])
    print(f"Final train accuracy: {train_acc:.4f}")
    print(f"Final val accuracy: {val_acc:.4f}")

    fig, ax = plt.subplots(figsize=(10, 4))
    ax.plot(history.history["loss"], label="train_loss")
    ax.plot(history.history["val_loss"], label="val_loss")
    ax.set_xlabel("Epoch")
    ax.set_ylabel("Loss")
    ax.legend()
    ax2 = ax.twinx()
    ax2.plot(history.history["accuracy"], label="train_acc", linestyle="--")
    ax2.plot(history.history["val_accuracy"], label="val_acc", linestyle="--")
    ax2.set_ylabel("Accuracy")
    ax2.legend(loc="lower right")
    fig.tight_layout()
    fig.savefig(CURVES_OUT, dpi=150)
    plt.close(fig)
    print(f"Saved training curves to {CURVES_OUT}")


def train_with_sklearn(X_train, X_val, y_train, y_val, num_classes, label_names):
    import joblib
    from sklearn.neural_network import MLPClassifier

    print("TensorFlow not available — using Scikit-Learn MLPClassifier for training...")
    X_train_flat = X_train.reshape(X_train.shape[0], -1)
    X_val_flat = X_val.reshape(X_val.shape[0], -1)

    clf = MLPClassifier(hidden_layer_sizes=(128, 64), max_iter=200, random_state=42)
    clf.fit(X_train_flat, y_train)

    train_acc = clf.score(X_train_flat, y_train)
    val_acc = clf.score(X_val_flat, y_val)
    print(f"Final train accuracy: {train_acc:.4f}")
    print(f"Final val accuracy: {val_acc:.4f}")

    joblib.dump(clf, MODEL_OUT_PKL)
    print(f"Saved scikit-learn model to {MODEL_OUT_PKL}")


def main():
    os.chdir(SCRIPT_DIR)

    (
        X_train,
        X_val,
        _X_test,
        y_train,
        y_val,
        _y_test,
        label_names,
        encoder,
    ) = load_dataset("data")

    num_classes = len(encoder.classes_)
    BACKEND_MODEL_DIR.mkdir(parents=True, exist_ok=True)

    use_tf = False
    try:
        import tensorflow as tf
        use_tf = True
    except Exception as e:
        print(f"TensorFlow import failed ({e})")
        use_tf = False

    if use_tf:
        train_with_tensorflow(X_train, X_val, y_train, y_val, num_classes, label_names)
    else:
        train_with_sklearn(X_train, X_val, y_train, y_val, num_classes, label_names)

    with open(LABELS_OUT, "w", encoding="utf-8") as f:
        for name in label_names:
            f.write(f"{name}\n")
    print(f"Saved label list to {LABELS_OUT}")


if __name__ == "__main__":
    main()
