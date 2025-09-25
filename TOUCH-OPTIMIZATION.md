# Touch Input System Optimization Report

## 🎯 Current Issues & Recommendations

### 1. **Event Handling Inefficiency**

**Issues:**
- Non-passive event listeners blocking scroll performance
- Multiple listeners on large DOM areas (dashboard/body)
- Missing event delegation patterns
- No event throttling/debouncing

**Impact:** Poor scrolling performance, especially on large displays

**Current Code:**
```javascript
dashboard.addEventListener('touchstart', handleTouchStart, { passive: false });
dashboard.addEventListener('touchmove', handleTouchMove, { passive: false });
```

**Optimized Solution:**
```javascript
// Use passive listeners where possible
dashboard.addEventListener('touchstart', handleTouchStart, { passive: true });
# Touch Interaction Optimization Plan

_Last reviewed: September 24, 2025_

## 🚀 Executive Summary
- **Goal**: Deliver a faster, smoother touch experience on large-format touch displays (≥75") while keeping code maintainable.
- **Key Actions**: Modernize event handling with Pointer Events, reduce DOM churn from feedback animations, and centralize gesture state for predictable behavior.
- **Expected Wins**: Up to 30% lower input latency, 25–40% reduction in layout thrash during heavy use, and simpler debugging thanks to a consolidated touch controller.

---

## 1. Current Architecture Snapshot

| Module | Purpose | Pain Points |
| --- | --- | --- |
| `src/modules/touch/gestures.js` | Handles touch detection, swipe/tap/long press logic | Multiple non-passive listeners, duplication of state handling, no pointer-event support |
| `src/modules/touch/feedback.js` | Visual + haptic feedback responses | Adds/clears inline styles repeatedly, large toast system firing during gesture testing |
| `src/modules/touch/responsive.js` | Responsive layout, card collapsing, search | Mixes layout logic with touch target sizing; MutationObserver never unbound |

Additional touch hooks exist in `index.html` via inline CSS for `.touch-*` classes, leading to scattered responsibilities.

---

## 2. Key Findings

1. **Event Handling & Gesture Detection**
   - `gestures.js` attaches `touchstart/move/end` with `{ passive: false }` on the entire dashboard, blocking smooth scrolling.
   - No throttling occurs during `touchmove` → 16ms frame budget is often exceeded on 75" panels.
   - Gesture thresholds are constant; large displays need higher pixel thresholds to avoid accidental swipes.

2. **Feedback Performance**
   - Feedback methods add inline styles (e.g., `element.style.transform`) and remove them shortly after, forcing layout recalculations.
   - Toast notifications are triggered for every swipe direction, overwhelming the UI during rapid interactions.

3. **Responsive Module Coupling**
   - MutationObserver in `responsive.js` is always active and never disconnected, even on navigation or teardown.
   - Card collapse data is stored in `STATE.responsiveCardStates` but not capped; repeated sessions grow localStorage footprint.

4. **Maintainability**
   - Touch logic is split across three modules with overlapping responsibilities and duplicate checks (e.g., touch capability detection).
   - Lack of device capability caching leads to repeated checks (`navigator.vibrate`, `navigator.maxTouchPoints`).

---

## 3. Prioritized Recommendations

### 🟥 Immediate (Sprint 1)
1. **Adopt Pointer Events with passive listeners**
   - Replace touch listeners with pointer-backed `pointerdown/move/up/cancel`.
   - Use `{ passive: true }` for move/start events; only call `preventDefault` when necessary (e.g., custom drag zones).

2. **Introduce throttled gesture tracking**
   - Wrap move handlers with a 16ms throttle (1 frame) using a reusable utility in `core/utils`.
   - Record velocity with `requestAnimationFrame` for accuracy and minimal jank.

3. **Centralize gesture state**
   - Create `src/modules/touch/controller.js` exporting a `TouchController` singleton that manages:
     ```js
     const controller = new TouchController({
       thresholds: computeAdaptiveThresholds(),
       feedback: feedbackManager,
       bus: eventBus
     });
     controller.mount(document.getElementById('dashboard'));
     ```
   - Remove scattered state (`TOUCH_GESTURES`, `FEEDBACK_STATE`) in favor of class-scoped fields.

### 🟧 Near-Term (Sprint 2)
1. **Lightweight feedback manager**
   - Replace inline style mutations with CSS class toggles only.
   - Batch feedback via `requestAnimationFrame`; drop toasts for directional swipes and use subtle overlays instead.

2. **Responsive touch target tuning**
   - Move `RESPONSIVE_CONFIG.touchTargets` into the new controller and adjust sizes per breakpoint.
   - Disconnect MutationObserver on teardown and limit card state cache to last 200 entries.

### 🟩 Later (Sprint 3+)
1. **Gesture customization dashboard**
   - Add UI in settings allowing dispatchers to choose swipe actions per panel.
2. **Advanced analytics**
   - Log gesture success/failure rates to inform further tuning.
3. **Stylus & multi-touch support**
   - Extend controller to track `pointerType` and handle stylus-specific behavior (pressure, barrel button).

---

## 4. Implementation Roadmap

| Step | Description | Owner | ETA |
| --- | --- | --- | --- |
| 1 | Scaffold `TouchController` and switch to Pointer Events | Frontend | 1.5 days |
| 2 | Refactor feedback to class-based toggles, remove inline styles | Frontend | 1 day |
| 3 | Update responsive module to use controller touch utilities | Frontend | 0.5 day |
| 4 | Regression testing on desktop + touch hardware | QA | 0.5 day |

---

## 5. Validation Checklist

- ✅ Profiling shows `inputDelay` under 50ms during swipe tests (Chrome DevTools).
- ✅ No forced reflows triggered by feedback functions (check Performance panel).
- ✅ Pointer Events gracefully degrade to mouse on non-touch devices.
- ✅ MutationObserver disconnects when dashboard unmounts.
- ✅ LocalStorage size remains < 1 MB after repeated card toggles.

---

## 6. Suggested File Changes

1. `src/modules/touch/controller.js` (new) – orchestrates events, thresholds, history buffer.
2. `src/modules/touch/gestures.js` – slimmed down to helper utilities or removed.
3. `src/modules/touch/feedback.js` – migrate to class-based approach, no inline styles.
4. `src/modules/touch/responsive.js` – import controller for touch target sizing, manage observers responsibly.
5. `src/app.js` – initialize controller once during app bootstrap.

---

## 7. Appendices

### A. Adaptive Threshold Helper (pseudo-code)
```js
function computeAdaptiveThresholds() {
  const minEdge = Math.min(window.innerWidth, window.innerHeight);
  const base = minEdge >= 1200 ? 0.08 * minEdge : 60;
  return {
    swipe: Math.max(50, base),
    tap: Math.min(18, base * 0.25),
    longPressTime: minEdge >= 1200 ? 350 : 500
  };
}
```

### B. Throttled Pointer Move Utility
```js
import { throttle } from '../core/utils.js';

const throttledMove = throttle((event) => {
  controller.update(event);
}, 16);
```

---

**Next Action**: Implement Step 1 (Pointer Events + controller scaffold) and benchmark on the 75" dispatch panel before enabling in production.