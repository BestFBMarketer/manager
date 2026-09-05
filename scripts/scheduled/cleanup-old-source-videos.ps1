# =====================================
# MODULE: Cleanup Old Source Videos
# Purpose: G:\Drive'im\shortsfactory\sourcevideos altindaki 30+ gunluk ham
#          kaynak klipleri otomatik siler (retention policy, 2026-09-05
#          kullanici karari). Uretimi bitmis videolar icin kaynak klip
#          gerekirse yt-dlp ile yeniden indirilebilir - kalici saklamaya
#          gerek yok.
# Kullanim: Windows Task Scheduler ile gunluk calistirilir.
# Author: BestMarketer Team
# Last Modified: 2026-09-05
# =====================================

$root = "G:\Drive'ım\shortsfactory\sourcevideos"
$retentionDays = 30
$cutoff = (Get-Date).AddDays(-$retentionDays)
$logPath = Join-Path $PSScriptRoot "cleanup-log.txt"

if (-not (Test-Path $root)) {
    "[$(Get-Date -Format 'yyyy-MM-dd HH:mm')] UYARI: $root bulunamadi, atlaniyor" | Add-Content -Path $logPath
    exit 0
}

$oldFiles = Get-ChildItem -Path $root -Recurse -File -ErrorAction SilentlyContinue | Where-Object { $_.LastWriteTime -lt $cutoff }

$deletedCount = 0
$deletedBytes = 0
foreach ($file in $oldFiles) {
    $deletedBytes += $file.Length
    "[$(Get-Date -Format 'yyyy-MM-dd HH:mm')] silindi ($([math]::Round($file.Length/1MB,1)) MB, $($file.LastWriteTime.ToString('yyyy-MM-dd'))): $($file.FullName)" | Add-Content -Path $logPath
    Remove-Item $file.FullName -Force -ErrorAction SilentlyContinue
    $deletedCount++
}

# Bos kalan klasorleri temizle (en derinden yukariya dogru)
Get-ChildItem -Path $root -Recurse -Directory -ErrorAction SilentlyContinue |
    Sort-Object -Property FullName -Descending |
    Where-Object { (Get-ChildItem $_.FullName -Force -ErrorAction SilentlyContinue | Measure-Object).Count -eq 0 } |
    Remove-Item -Force -ErrorAction SilentlyContinue

"[$(Get-Date -Format 'yyyy-MM-dd HH:mm')] tur tamamlandi: $deletedCount dosya, $([math]::Round($deletedBytes/1MB,1)) MB silindi" | Add-Content -Path $logPath
