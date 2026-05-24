import { createTextTargets } from './textShape.js';
import { createSymbolTargets } from './symbolShape.js';
import { TEXT_CONFIG, SHAPE_CONFIG } from '../config.js';

export function createShapeTargets(count, scale = 1) {
  const sx = (w) => w * scale;
  const sy = (h) => h * scale;

  return {
    introText: createTextTargets({
      count,
      text: TEXT_CONFIG.intro,
      width: sx(SHAPE_CONFIG.introText.width),
      height: sy(SHAPE_CONFIG.introText.height),
    }),
    loveText: createTextTargets({
      count,
      text: TEXT_CONFIG.love,
      width: sx(SHAPE_CONFIG.loveText.width),
      height: sy(SHAPE_CONFIG.loveText.height),
    }),
    idleHeart: createSymbolTargets({
      count,
      type: 'heart',
      width: sx(SHAPE_CONFIG.idleHeart.width),
      height: sy(SHAPE_CONFIG.idleHeart.height),
    }),
    bigHeart: createSymbolTargets({
      count,
      type: 'heart',
      width: sx(SHAPE_CONFIG.bigHeart.width),
      height: sy(SHAPE_CONFIG.bigHeart.height),
    }),
    smallHeart: createSymbolTargets({
      count,
      type: 'heart',
      width: sx(SHAPE_CONFIG.smallHeart.width),
      height: sy(SHAPE_CONFIG.smallHeart.height),
    }),
  };
}
