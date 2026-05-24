import { createTextTargets } from './textShape.js';
import { createSymbolTargets } from './symbolShape.js';
import { TEXT_CONFIG, SHAPE_CONFIG } from '../config.js';

export function createShapeTargets(count) {
  return {
    introText: createTextTargets({
      count,
      text: TEXT_CONFIG.intro,
      width: SHAPE_CONFIG.introText.width,
      height: SHAPE_CONFIG.introText.height,
    }),
    loveText: createTextTargets({
      count,
      text: TEXT_CONFIG.love,
      width: SHAPE_CONFIG.loveText.width,
      height: SHAPE_CONFIG.loveText.height,
    }),
    idleHeart: createSymbolTargets({
      count,
      type: 'heart',
      width: SHAPE_CONFIG.idleHeart.width,
      height: SHAPE_CONFIG.idleHeart.height,
    }),
    bigHeart: createSymbolTargets({
      count,
      type: 'heart',
      width: SHAPE_CONFIG.bigHeart.width,
      height: SHAPE_CONFIG.bigHeart.height,
    }),
    smallHeart: createSymbolTargets({
      count,
      type: 'heart',
      width: SHAPE_CONFIG.smallHeart.width,
      height: SHAPE_CONFIG.smallHeart.height,
    }),
  };
}
