import { renderRemotion } from '../src/render/renderRemotion.js';

const result = await renderRemotion(
  'HotelTourLandscape',
  {
    videoSrc: 'data/work/1/mixed_1.mp4',
    title: 'Ihr Perfekter Urlaub: Top-Hotel & Ausflüge an der Türkischen Riviera',
    cues: [],
    channelHandle: 'Gezi / Seyahat',
    titleDurationSec: 3,
    infoChips: [],
  },
  'data/work/1/render_1.mp4',
  1,
);
console.log('render ok', result);
