"""
SadTalker on Modal: single photo (Crash Dummy) + audio (Callum/VoiceBox line)
-> lip-synced talking-head video. Replaces the static <Img> in TierList.tsx's
DummyPanel with an OffthreadVideo per tier item (and for hook/outro lines).

Usage:
    modal run modal_sadtalker.py --image dummy.png --audio line_01.wav --out line_01.mp4
"""
import modal

app = modal.App("tierlist-sadtalker")

image = (
    modal.Image.debian_slim(python_version="3.10")
    .apt_install("git", "ffmpeg", "libgl1", "libglib2.0-0")
    .pip_install(
        "torch==2.0.1", "torchvision==0.15.2", "torchaudio==2.0.2",
    )
    .pip_install(
        "numpy==1.23.4", "face_alignment==1.3.5", "imageio==2.19.3",
        "imageio-ffmpeg==0.4.7", "librosa==0.9.2", "numba==0.56.4",
        "resampy==0.3.1", "pydub==0.25.1", "scipy==1.10.1",
        "kornia==0.6.8", "tqdm", "yacs==0.1.8", "pyyaml", "joblib==1.1.0",
        "scikit-image==0.19.3", "huggingface_hub", "safetensors", "facexlib==0.3.0",
        "lmdb", "addict", "future", "tb-nightly", "Pillow",
    )
    .run_commands(
        # basicsr/gfpgan are imported unconditionally by SadTalker's inference.py
        # (not actually optional despite the --enhancer flag), but basicsr's
        # legacy setup.py pulls a 'cuda-toolkit' extra requiring
        # nvidia-cublas==13.1.1.3.* which conflicts with the nvidia-cublas
        # already installed by torch on Modal's current CUDA base image.
        # --no-deps skips that broken dependency resolution; every actual
        # runtime dependency basicsr/gfpgan need (opencv, numpy, etc.) is
        # already installed above.
        "pip install --no-deps basicsr==1.4.2 gfpgan==1.3.8",
    )
    .run_commands(
        "git clone https://github.com/OpenTalker/SadTalker.git /SadTalker",
    )
    .run_commands(
        "python -c \"from huggingface_hub import snapshot_download; "
        "snapshot_download('vinthony/SadTalker', local_dir='/SadTalker/checkpoints', "
        "allow_patterns=['*.pth', '*.tar', '*.dat', '*.safetensors', 'BFM/*', 'hub/*'])\"",
    )
)

CHECKPOINTS_VOLUME = modal.Volume.from_name("sadtalker-checkpoints", create_if_missing=True)


@app.function(image=image, gpu="A10G", timeout=600, volumes={"/cache": CHECKPOINTS_VOLUME})
def generate_talking_video(image_bytes: bytes, audio_bytes: bytes, image_ext: str, audio_ext: str) -> bytes:
    import subprocess
    import tempfile
    import os
    import glob

    with tempfile.TemporaryDirectory() as tmp:
        img_path = os.path.join(tmp, f"source{image_ext}")
        audio_path = os.path.join(tmp, f"driven{audio_ext}")
        with open(img_path, "wb") as f:
            f.write(image_bytes)
        with open(audio_path, "wb") as f:
            f.write(audio_bytes)

        result_dir = os.path.join(tmp, "results")
        os.makedirs(result_dir, exist_ok=True)

        cmd = [
            "python", "/SadTalker/inference.py",
            "--driven_audio", audio_path,
            "--source_image", img_path,
            "--result_dir", result_dir,
            "--still",
            "--preprocess", "full",
        ]
        subprocess.run(cmd, check=True, cwd="/SadTalker")

        mp4s = glob.glob(os.path.join(result_dir, "**", "*.mp4"), recursive=True)
        if not mp4s:
            raise RuntimeError("SadTalker produced no output video")

        # SadTalker's own writer defaults to the legacy mpeg4/mp4v codec,
        # which most browsers/players (and the chat preview panel) can't
        # decode - always show black. Re-encode to H.264 before returning.
        h264_path = os.path.join(tmp, "out_h264.mp4")
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-i", mp4s[0],
             "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", h264_path],
            check=True,
        )
        with open(h264_path, "rb") as f:
            return f.read()


@app.local_entrypoint()
def main(image: str, audio: str, out: str = "talking.mp4"):
    import pathlib
    img_path = pathlib.Path(image)
    audio_path = pathlib.Path(audio)
    data = generate_talking_video.remote(
        img_path.read_bytes(), audio_path.read_bytes(), img_path.suffix, audio_path.suffix
    )
    pathlib.Path(out).write_bytes(data)
    print(f"Wrote {out} ({len(data)} bytes)")
