// =====================================
// MODULE: Remotion Config
// Purpose: Render ayarlari - harita katmani WebGL gerektirdiginden ANGLE secilir
// Dependencies: @remotion/cli/config
// Author: BestMarketer Team
// Last Modified: 2026-08-18
// =====================================

import { Config } from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
// MapLibre harita katmani WebGL ile cizilir; ANGLE olmadan bos kare uretir.
Config.setChromiumOpenGlRenderer('angle');
