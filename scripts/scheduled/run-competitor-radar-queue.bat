@echo off
cd /d "%~dp0..\.."
npx tsx src/worker/competitorRadarQueue.ts
