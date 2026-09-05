import { NodeIO } from '@gltf-transform/core';
import { dedup, prune, quantize } from '@gltf-transform/functions';

const io = new NodeIO();
const inPath = process.argv[2];
const outPath = process.argv[3];

const doc = await io.read(inPath);

// Rigging test icin doku gereksiz - sadece geometri/oran onemli, boyutun cogu
// (~47MB) 3 buyuk PNG texture'dan geliyordu, hepsini kaldiriyoruz.
for (const tex of doc.getRoot().listTextures()) {
  tex.dispose();
}
for (const mat of doc.getRoot().listMaterials()) {
  mat.dispose();
}

// NOT: simplify/weld cikarildi - meshoptimizer simplify skin agirliklarini
// gozetmeden decimate ediyor gibi gorunuyor (2026-09-05: iki mesh de simplify
// SONRASI, bind pozunda saglam ama HERHANGI animasyonda tum govde parcalaniyordu;
// simplify uygulanmamis ilk mesh'te ise SADECE kollar bozuktu). Sadece doku
// silme + kayipsiz dedup/prune ile boyut testi.
// NOT (devam): quantize de cikarildi - skin'li primitiflerde node
// scale/offset ekleyerek inverseBindMatrices ile cakismis olabilir
// (2026-09-05, bir onceki test quantize ACIKTI, yine tum govde parcalandi).
// Simdi SADECE kayipsiz islemler: doku/materyal silme + dedup + prune.
await doc.transform(
  dedup(),
  prune(),
);

await io.write(outPath, doc);
console.log('done:', outPath);
