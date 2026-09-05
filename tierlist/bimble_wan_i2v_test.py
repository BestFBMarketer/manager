"""
Test: Wan2.2-I2V-A14B image-to-video on a Bimble emotion PNG, to check whether
open-source I2V models can add believable body motion to our abstract cartoon
cloud-creature (2026-09-04 user request - full scene animation, not just
static-image color-swap).

Usage:
    modal run bimble_wan_i2v_test.py --image ../public/bimble/happy.png --out wan_test.mp4
"""
import modal

app = modal.App("bimble-wan-i2v-test")

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("ffmpeg")
    .pip_install(
        "torch==2.6.0", "torchvision", "accelerate", "transformers",
        "diffusers>=0.31.0", "safetensors", "sentencepiece", "imageio",
        "imageio-ffmpeg", "Pillow", "huggingface_hub",
    )
)
MODEL_VOLUME = modal.Volume.from_name("wan22-i2v-weights", create_if_missing=True)
MODEL_DIR = "/models"
MODEL_ID = "Wan-AI/Wan2.2-I2V-A14B-Diffusers"


@app.function(
    image=image, gpu="A100-40GB", timeout=1200, volumes={MODEL_DIR: MODEL_VOLUME},
    secrets=[modal.Secret.from_name("huggingface-secret")],
)
def generate(image_bytes: bytes, prompt: str, num_frames: int = 49) -> bytes:
    import io, os, torch
    from diffusers import WanImageToVideoPipeline
    from diffusers.utils import export_to_video
    from PIL import Image

    pipe = WanImageToVideoPipeline.from_pretrained(
        MODEL_ID, torch_dtype=torch.bfloat16, cache_dir=MODEL_DIR,
        token=os.environ.get("HF_TOKEN"),
    )
    pipe.to("cuda")

    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    output = pipe(image=img, prompt=prompt, num_frames=num_frames).frames[0]

    out_path = "/tmp/out.mp4"
    export_to_video(output, out_path, fps=16)
    with open(out_path, "rb") as f:
        return f.read()


@app.local_entrypoint()
def main(image: str, out: str = "wan_test.mp4",
         prompt: str = "the soft round cloud character bounces excitedly and waves its little arms, cheerful subtle body motion, flat 2D cartoon animation style, simple background, no camera movement"):
    import pathlib
    data = generate.remote(pathlib.Path(image).read_bytes(), prompt)
    pathlib.Path(out).write_bytes(data)
    print(f"Wrote {out} ({len(data)} bytes)")
