import { State, STATE_TIMING, GESTURE_CONFIG } from '../config.js';
import { Gesture } from '../gesture/GestureRecognizer.js';

export { State };

export class StateMachine {
  constructor() {
    this.current = State.INTRO_TEXT;
    this.introDone = false;
    this.defaultState = State.FISH_SCHOOL;

    this.stableGesture = null;
    this.stableConfidence = 0;
    this.stableSince = null;
    this.lastTransitionTime = 0;
    this.lostGestureSince = null;

    this.debug = {
      gesture: 'NONE',
      confidence: 0,
      stableMs: 0,
      state: State.INTRO_TEXT,
      triggered: false,
    };
  }

  startIntro() {
    this.current = State.INTRO_TEXT;
    this.introDone = false;
    setTimeout(() => {
      this.introDone = true;
      if (this.current === State.INTRO_TEXT) {
        this.transitionTo(State.FISH_SCHOOL);
      }
    }, STATE_TIMING.introDuration * 1000);
  }

  evaluateGesture(result) {
    const now = performance.now();

    this.debug.gesture = result.gesture;
    this.debug.confidence = result.confidence;
    this.debug.state = this.current;
    this.debug.triggered = false;

    if (!this.introDone) return null;

    const gesture = result.gesture;
    const confidence = result.confidence;
    const minConf = GESTURE_CONFIG.minConfidence || 0.35;
    const isConfident = gesture !== Gesture.NONE && confidence >= minConf;

    // 追踪稳定手势：NONE 帧不重置，只通过 lostGestureSince 管理丢失
    if (isConfident) {
      if (gesture === this.stableGesture) {
        if (this.stableSince === null) this.stableSince = now;
      } else {
        this.stableGesture = gesture;
        this.stableConfidence = confidence;
        this.stableSince = now;
      }
      this.lostGestureSince = null;
    } else if (this.stableGesture !== null && this.stableGesture !== Gesture.NONE) {
      // 手势暂时丢失，记下丢失时间（不重置 stableSince）
      if (this.lostGestureSince === null) this.lostGestureSince = now;
    }

    this.debug.stableMs = this.stableSince ? now - this.stableSince : 0;

    // 冷却间隔
    if (now - this.lastTransitionTime < STATE_TIMING.cooldownMs) {
      return null;
    }

    // 手势丢失超时 → 回 IDLE
    if (
      this.lostGestureSince !== null &&
      now - this.lostGestureSince >= STATE_TIMING.lossDelayMs &&
      this.current !== State.FISH_SCHOOL
    ) {
      this.stableSince = null;
      this.stableGesture = Gesture.NONE;
      this.lostGestureSince = null;
      this.transitionTo(State.FISH_SCHOOL);
      this.debug.triggered = true;
      return State.FISH_SCHOOL;
    }

    // 当前无稳定手势
    if (!isConfident) return null;

    // 稳定时间不足
    if (!this.stableSince || now - this.stableSince < STATE_TIMING.debounceMs) {
      return null;
    }

    const targetState = this.mapGestureToState(this.stableGesture);
    if (targetState === this.current) return null;
    if (targetState === this.defaultState) return null; // 默认状态由手势丢失触发

    this.transitionTo(targetState);
    this.debug.triggered = true;
    return targetState;
  }

  transitionTo(state) {
    this.lastTransitionTime = performance.now();
    this.current = state;
    this.lostGestureSince = null;
    this.debug.state = state;
    this.onTransition?.(state);
  }

  mapGestureToState(gesture) {
    if (gesture === 'OPEN_PALM') return State.EXPLOSION;
    if (gesture === 'FIST') return State.FIST_COMPACT;
    if (gesture === 'HEART_FINGER') return State.BAIT_BALL;
    return State.FISH_SCHOOL;
  }
}
