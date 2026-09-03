#!/usr/bin/env python3
"""Generates all TTS lines for one TierList day via VoiceBox (Callum profile),
polls until complete, downloads audio, measures duration, writes an updated
script.json with audio paths + durationSec per line.

Usage: python generate_tts.py day1-nike/script.json
"""
import json
import subprocess
import sys
import time
from pathlib import Path

import requests

VOICEBOX = "http://127.0.0.1:17493"
CALLUM_ID = "d27fc81d-4296-46b9-bf2d-51d734ce7dd5"


def ffprobe_duration(path: Path) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
        capture_output=True, text=True, check=True,
    )
    return float(out.stdout.strip())


def generate_line(text: str, out_path: Path) -> float:
    resp = requests.post(f"{VOICEBOX}/generate", json={
        "profile_id": CALLUM_ID, "text": text, "engine": "qwen",
        "model_size": "1.7B", "normalize": True,
    })
    resp.raise_for_status()
    gen_id = resp.json()["id"]
    for _ in range(60):
        st = requests.get(f"{VOICEBOX}/history/{gen_id}").json()
        if st["status"] == "completed":
            break
        if st["status"] == "failed":
            raise RuntimeError(f"TTS failed for: {text[:50]}")
        time.sleep(2)
    else:
        raise RuntimeError(f"TTS timed out for: {text[:50]}")
    audio = requests.get(f"{VOICEBOX}/audio/{gen_id}")
    out_path.write_bytes(audio.content)
    return ffprobe_duration(out_path)


def main():
    script_path = Path(sys.argv[1]).resolve()
    day_dir = script_path.parent
    audio_dir = day_dir / "audio"
    audio_dir.mkdir(exist_ok=True)
    data = json.loads(script_path.read_text(encoding="utf-8"))

    print("Generating hook...")
    hook_path = audio_dir / "hook.wav"
    data["hookDurationSec"] = generate_line(data["hook"], hook_path)
    data["hookAudio"] = str(hook_path.relative_to(day_dir)).replace("\\", "/")
    print(f"  {data['hookDurationSec']:.2f}s")

    for i, item in enumerate(data["items"]):
        print(f"Generating item {i+1}/{len(data['items'])} ({item['brandLabel']})...")
        item_path = audio_dir / f"item_{i+1:02d}.wav"
        item["durationSec"] = generate_line(item["line"], item_path)
        item["audio"] = str(item_path.relative_to(day_dir)).replace("\\", "/")
        print(f"  {item['durationSec']:.2f}s")

    print("Generating outro...")
    outro_path = audio_dir / "outro.wav"
    data["outroDurationSec"] = generate_line(data["outro"], outro_path)
    data["outroAudio"] = str(outro_path.relative_to(day_dir)).replace("\\", "/")
    print(f"  {data['outroDurationSec']:.2f}s")

    out_path = day_dir / "script_timed.json"
    out_path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    total = data["hookDurationSec"] + data["outroDurationSec"] + sum(i["durationSec"] for i in data["items"])
    print(f"\nWrote {out_path} (total dialogue: {total:.1f}s)")


if __name__ == "__main__":
    main()
