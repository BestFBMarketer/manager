#!/bin/bash
set -e
DUMMY="E:/claaudeproje/shortsfactory/manager/public/tierlist/dummy_v2.png"
cd "E:/claaudeproje/shortsfactory/manager/tierlist"
export PYTHONIOENCODING=utf-8
export PYTHONUTF8=1

for day in day1-nike day2-perfume day3-oldspice; do
  mkdir -p "$day/talking"
  python -c "
import json
d = json.load(open('$day/script_timed.json', encoding='utf-8'))
lines = [('hook', d['hookAudio'])]
for i, item in enumerate(d['items']):
    lines.append((f'item_{i+1:02d}', item['audio']))
lines.append(('outro', d['outroAudio']))
for name, audio in lines:
    print(f'{name}|{audio}')
" > "$day/lines.txt"
done

for day in day1-nike day2-perfume day3-oldspice; do
  while IFS='|' read -r name audio; do
    name="${name%$'\r'}"
    audio="${audio%$'\r'}"
    out="$day/talking/${name}.mp4"
    if [ -f "$out" ]; then
      echo "SKIP $out (exists)"
      continue
    fi
    for attempt in 1 2 3; do
      echo "=== $day/$name (attempt $attempt) ==="
      if modal run modal_sadtalker.py --image "$DUMMY" --audio "$day/$audio" --out "$out" >> "$day/talking_gen.log" 2>&1; then
        echo "OK $out"
        break
      else
        echo "FAILED $out attempt $attempt"
        sleep 8
      fi
    done
    sleep 3
  done < "$day/lines.txt"
done
echo "ALL_DONE"
