"""
Stage 0 validation (see plan: 3D karakter/sahne pipeline'ina gecis): test
whether Tencent Hunyuan3D-2 (open source, self-hosted) can turn a Bimble
reference PNG into a usable 3D mesh. Shape-only for this first pass (no
texture pipeline yet - that needs extra custom_rasterizer/differentiable_
renderer native builds, higher risk; texture can be added once shape quality
is confirmed).

Usage:
    modal run bimble_hunyuan3d_test.py --image ../public/bimble/calm.png --out bimble_mesh.glb
"""
import modal

app = modal.App("bimble-hunyuan3d-test")

image = (
    modal.Image.debian_slim(python_version="3.10")
    .apt_install("git", "libgl1", "libglib2.0-0")
    .pip_install(
        "torch==2.4.0", "torchvision", "numpy", "pillow", "trimesh",
        "transformers", "diffusers", "accelerate", "einops", "omegaconf",
        "huggingface_hub", "safetensors", "scipy", "opencv-python-headless",
        "pymeshlab", "rembg", "onnxruntime",
    )
    .run_commands(
        "git clone https://github.com/Tencent-Hunyuan/Hunyuan3D-2.git /Hunyuan3D-2",
    )
    .run_commands(
        # requirements.txt torch/transformers'i pinlemiyor - "pip install -r"
        # farkli/CPU-only bir surumle torch'u sessizce degistirebiliyor, bu
        # yuzden repo kurulumundan SONRA bilinen-calisan CUDA torch'u tekrar
        # zorla kuruyoruz (son adim = kazanan surum).
        "cd /Hunyuan3D-2 && pip install -r requirements.txt && pip install -e .",
    )
    .pip_install(
        # requirements.txt icindeki pinlenmemis 'transformers' en son surumu
        # (5.x) cekiyor, o da PyTorch >= 2.5 sartiyor - kok neden bu, diag
        # ile dogrulandi (2026-09-04). 2.4.0 yerine uyumlu bir cift.
        "torch==2.6.0", "torchvision==0.21.0",
    )
    # NOT: Hunyuan3D-Paint (doku) icin custom_rasterizer/differentiable_renderer
    # native CUDA extension derlemesi gerekiyor, bu da CUDA_HOME/nvcc'nin
    # build-time'da mevcut oldugu bir GPU devel image ister - debian_slim'de
    # yok, build patlar (2026-09-04 bulgusu). Doku ERTELENDI, once rigging/
    # animasyon test edilecek (kullanicinin asil onceligi). Geri donulecekse:
    # modal.Image.from_registry("nvidia/cuda:12.1.0-devel-ubuntu22.04", add_python="3.10")
    # tabanina gecilmeli.
)

MODEL_VOLUME = modal.Volume.from_name("hunyuan3d-weights", create_if_missing=True)
MODEL_DIR = "/models"


@app.function(image=image, gpu="A10G", timeout=120)
def diagnose():
    import subprocess
    print("--- torch ---")
    try:
        import torch
        print("torch version:", torch.__version__, "cuda:", torch.cuda.is_available())
    except Exception as e:
        print("torch import FAILED:", repr(e))
    print("--- transformers ---")
    import transformers
    print("transformers version:", transformers.__version__)
    from transformers.utils import is_torch_available
    print("is_torch_available():", is_torch_available())
    print("--- pip show torch/torchvision/transformers ---")
    print(subprocess.run(["pip", "show", "torch", "torchvision", "transformers"], capture_output=True, text=True).stdout)
    print("--- pip check (dependency conflicts) ---")
    print(subprocess.run(["pip", "check"], capture_output=True, text=True).stdout)


@app.function(
    image=image, gpu="A10G", timeout=900, volumes={MODEL_DIR: MODEL_VOLUME},
    secrets=[modal.Secret.from_name("huggingface-secret")],
)
def generate_mesh(image_bytes: bytes, with_texture: bool = False) -> bytes:
    import io, os, sys
    sys.path.insert(0, "/Hunyuan3D-2")
    from PIL import Image
    from rembg import remove
    from hy3dgen.shapegen import Hunyuan3DDiTFlowMatchingPipeline

    img = Image.open(io.BytesIO(image_bytes)).convert("RGBA")
    img = remove(img)  # arka planı temizle - şekil üretimi için önemli

    shape_pipeline = Hunyuan3DDiTFlowMatchingPipeline.from_pretrained(
        "tencent/Hunyuan3D-2", cache_dir=MODEL_DIR, token=os.environ.get("HF_TOKEN"),
    )
    mesh = shape_pipeline(image=img)[0]

    if with_texture:
        from hy3dgen.texgen import Hunyuan3DPaintPipeline
        paint_pipeline = Hunyuan3DPaintPipeline.from_pretrained(
            "tencent/Hunyuan3D-2", cache_dir=MODEL_DIR, token=os.environ.get("HF_TOKEN"),
        )
        mesh = paint_pipeline(mesh, image=img)

    out_path = "/tmp/mesh.glb"
    mesh.export(out_path)
    with open(out_path, "rb") as f:
        return f.read()


@app.local_entrypoint()
def diag():
    diagnose.remote()


@app.local_entrypoint()
def main(image: str, out: str = "bimble_mesh.glb"):
    import pathlib
    data = generate_mesh.remote(pathlib.Path(image).read_bytes())
    pathlib.Path(out).write_bytes(data)
    print(f"Wrote {out} ({len(data)} bytes)")
