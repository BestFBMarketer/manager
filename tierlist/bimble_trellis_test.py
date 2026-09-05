"""
Stage 0 validation (pivot from Hunyuan3D-2, which hit an unresolved
transformers/torch backend-detection bug across 3 attempts): test Microsoft
TRELLIS.2 (open source, self-hosted) on a Bimble reference PNG.

Usage:
    modal run bimble_trellis_test.py --image ../public/bimble/calm.png --out bimble_mesh_trellis.glb
"""
import modal

app = modal.App("bimble-trellis-test")

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("git", "libgl1", "libglib2.0-0")
    .pip_install(
        "torch==2.4.0", "torchvision", "numpy", "pillow", "trimesh",
        "diffusers", "transformers", "accelerate", "safetensors",
        "huggingface_hub", "einops", "rembg", "onnxruntime",
    )
)

MODEL_VOLUME = modal.Volume.from_name("trellis2-weights", create_if_missing=True)
MODEL_DIR = "/models"


@app.function(
    image=image, gpu="A100-40GB", timeout=900, volumes={MODEL_DIR: MODEL_VOLUME},
    secrets=[modal.Secret.from_name("huggingface-secret")],
)
def generate_mesh(image_bytes: bytes) -> bytes:
    import io, os
    from PIL import Image
    from rembg import remove
    from diffusers import DiffusionPipeline

    img = Image.open(io.BytesIO(image_bytes)).convert("RGBA")
    img = remove(img)

    pipe = DiffusionPipeline.from_pretrained(
        "microsoft/TRELLIS.2-4B", torch_dtype="bfloat16", trust_remote_code=True,
        cache_dir=MODEL_DIR, token=os.environ.get("HF_TOKEN"),
    )
    pipe.to("cuda")

    result = pipe(image=img)
    mesh = result.mesh if hasattr(result, "mesh") else result[0]

    out_path = "/tmp/mesh.glb"
    mesh.export(out_path)
    with open(out_path, "rb") as f:
        return f.read()


@app.local_entrypoint()
def main(image: str, out: str = "bimble_mesh_trellis.glb"):
    import pathlib
    data = generate_mesh.remote(pathlib.Path(image).read_bytes())
    pathlib.Path(out).write_bytes(data)
    print(f"Wrote {out} ({len(data)} bytes)")
