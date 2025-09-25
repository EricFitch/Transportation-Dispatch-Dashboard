/* TOUCH - CONTROLLER MODULE
   Transportation Dispatch Dashboard

   Centralised pointer interaction coordinator for large-format dispatch touchscreens.
   Handles adaptive thresholds, gesture recognition orchestration, pointer pooling,
   and cross-module event dispatching.
*/

// Module dependencies
import { eventBus } from '../core/events.js';
import { debounce } from '../core/utils.js';

const DEFAULT_SELECTORS = '[data-touchable], button, .route-card, .staff-card, .asset-card, .panel, [role="button"]';
const HISTORY_LIMIT = 15;
const MAX_POINTER_POOL = 6;

const BASE_THRESHOLDS = {
	tap: { time: 220, distance: 14 },
	longPress: { time: 600, distance: 18 },
	swipe: { distance: 64, velocity: 0.35 }
};

function now() {
	return performance && performance.now ? performance.now() : Date.now();
}

function distance(aX, aY, bX, bY) {
	const dx = bX - aX;
	const dy = bY - aY;
	return Math.sqrt((dx * dx) + (dy * dy));
}

function clamp(value, min, max) {
	return Math.min(Math.max(value, min), max);
}

function throttle(fn, wait = 100) {
	let waiting = false;
	let pendingArgs = null;

	return function throttled(...args) {
		if (waiting) {
			pendingArgs = args;
			return;
		}

		fn.apply(this, args);
		waiting = true;

		setTimeout(() => {
			waiting = false;
			if (pendingArgs) {
				throttled.apply(this, pendingArgs);
				pendingArgs = null;
			}
		}, wait);
	};
}

class TouchController {
	constructor() {
		this.options = {
			selectors: DEFAULT_SELECTORS,
			enableMouseGestures: false,
			longPressContext: true
		};

		this.state = {
			mounted: false,
			root: null,
			thresholds: { ...BASE_THRESHOLDS },
			pointerPool: [],
			pointers: new Map(),
			history: [],
			contextMenuTarget: null,
			analytics: {
				swipeCount: 0,
				tapCount: 0,
				longPressCount: 0,
				lastGestureAt: null
			}
		};

		this.bound = {
			pointerDown: this.handlePointerDown.bind(this),
			pointerMove: this.handlePointerMove.bind(this),
			pointerUp: this.handlePointerUp.bind(this),
			pointerCancel: this.handlePointerCancel.bind(this),
			blur: this.handleWindowBlur.bind(this)
		};

		this.recalculateThresholds = debounce(() => {
			this.computeAdaptiveThresholds();
		}, 150);

		this.processMove = throttle(this.processPointerMove.bind(this), 16);
	}

	initialize(options = {}) {
		return this.mount(options);
	}

	mount(options = {}) {
		if (this.state.mounted) {
			this.unmount();
		}

		this.options = { ...this.options, ...options };

		const root = this.resolveRoot(options.root);
		if (!root) {
			console.warn('TouchController: Unable to resolve root element.');
			return false;
		}

		this.state.root = root;
		this.state.mounted = true;

		root.addEventListener('pointerdown', this.bound.pointerDown, { passive: false, capture: true });
		root.addEventListener('pointermove', this.bound.pointerMove, { passive: false, capture: true });
		root.addEventListener('pointerup', this.bound.pointerUp, { passive: false, capture: true });
		root.addEventListener('pointercancel', this.bound.pointerCancel, { passive: false, capture: true });
		window.addEventListener('blur', this.bound.blur);
		window.addEventListener('resize', this.recalculateThresholds);

		this.computeAdaptiveThresholds();

		eventBus.emit('touch:controllerMounted', {
			thresholds: this.state.thresholds
		});

		return true;
	}

	unmount() {
		if (!this.state.mounted || !this.state.root) {
			return;
		}

		const { root } = this.state;

		root.removeEventListener('pointerdown', this.bound.pointerDown, true);
		root.removeEventListener('pointermove', this.bound.pointerMove, true);
		root.removeEventListener('pointerup', this.bound.pointerUp, true);
		root.removeEventListener('pointercancel', this.bound.pointerCancel, true);
		window.removeEventListener('blur', this.bound.blur);
		window.removeEventListener('resize', this.recalculateThresholds);

		this.state.mounted = false;
		this.state.root = null;
		this.resetPointers();
	}

	resolveRoot(rootOption) {
		if (!rootOption) {
			return document.getElementById('dashboard') || document.body;
		}

		if (typeof rootOption === 'string') {
			return document.querySelector(rootOption);
		}

		if (rootOption instanceof HTMLElement) {
			return rootOption;
		}

		return null;
	}

	computeAdaptiveThresholds(viewport = null, pointerType = null) {
		const width = viewport?.width || window.innerWidth || 1280;
		const height = viewport?.height || window.innerHeight || 720;
		const diagonal = Math.sqrt((width * width) + (height * height));
		const baseScale = clamp(diagonal / 1400, 0.85, 1.4);

		const inputType = pointerType || (window.matchMedia('(pointer: coarse)').matches ? 'touch' : 'mouse');
		const coarseMultiplier = inputType === 'touch' ? 1.0 : 0.7;

		const tapDistance = clamp(BASE_THRESHOLDS.tap.distance * baseScale * coarseMultiplier, 10, 26);
		const longPressDistance = clamp(BASE_THRESHOLDS.longPress.distance * baseScale * coarseMultiplier, 12, 30);
		const swipeDistance = clamp(BASE_THRESHOLDS.swipe.distance * baseScale, 48, 120);

		const tapTime = inputType === 'touch' ? BASE_THRESHOLDS.tap.time + 40 : BASE_THRESHOLDS.tap.time;
		const longPressTime = inputType === 'touch' ? BASE_THRESHOLDS.longPress.time : BASE_THRESHOLDS.longPress.time - 120;

		this.state.thresholds = {
			tap: {
				time: tapTime,
				distance: tapDistance
			},
			longPress: {
				time: longPressTime,
				distance: longPressDistance
			},
			swipe: {
				distance: swipeDistance,
				velocity: BASE_THRESHOLDS.swipe.velocity
			}
		};

		eventBus.emit('touch:thresholdsUpdated', {
			thresholds: this.state.thresholds,
			viewport: { width, height }
		});

		return this.state.thresholds;
	}

	handlePointerDown(event) {
		if (!this.shouldHandle(event)) {
			return;
		}

		const target = this.resolveTarget(event.target);
		if (!target) {
			return;
		}

		const pointer = this.allocatePointer(event, target);

		this.applyActiveStyles(target);

		if (target.hasAttribute('data-touch-scroll-lock')) {
			event.preventDefault();
		}

		if (typeof target.setPointerCapture === 'function') {
			try {
				target.setPointerCapture(event.pointerId);
			} catch (error) {
				// Some elements cannot capture pointer; ignore.
			}
		}

		eventBus.emit('touch:pointerdown', {
			pointer,
			event
		});
	}

	handlePointerMove(event) {
		const pointer = this.state.pointers.get(event.pointerId);
		if (!pointer) {
			return;
		}

		pointer.pendingEvent = event;
		this.processMove(pointer);
	}

	processPointerMove(pointer) {
		const event = pointer.pendingEvent;
		if (!event) {
			return;
		}

		pointer.pendingEvent = null;

		const dx = event.clientX - pointer.startX;
		const dy = event.clientY - pointer.startY;
		const dt = now() - pointer.startTime;
		const dist = distance(pointer.startX, pointer.startY, event.clientX, event.clientY);

		pointer.lastX = event.clientX;
		pointer.lastY = event.clientY;
		pointer.lastTime = now();
		pointer.deltaX = dx;
		pointer.deltaY = dy;
		pointer.distance = dist;
		pointer.duration = dt;

		if (!pointer.longPressTriggered && dist > this.state.thresholds.longPress.distance) {
			this.clearLongPress(pointer);
		}

		if (!pointer.gesture && dist > this.state.thresholds.swipe.distance) {
			pointer.gesture = 'swipe';
			pointer.swipeDirection = Math.abs(dx) > Math.abs(dy)
				? (dx > 0 ? 'right' : 'left')
				: (dy > 0 ? 'down' : 'up');

			this.clearLongPress(pointer);

			eventBus.emit('touch:swipeStart', {
				pointerId: pointer.pointerId,
				direction: pointer.swipeDirection,
				pointer,
				event
			});
		}

		eventBus.emit('touch:pointermove', {
			pointerId: pointer.pointerId,
			pointer,
			event
		});
	}

	handlePointerUp(event) {
		const pointer = this.state.pointers.get(event.pointerId);
		if (!pointer) {
			return;
		}

		this.clearLongPress(pointer);

		pointer.lastX = event.clientX;
		pointer.lastY = event.clientY;
		pointer.lastTime = now();
		pointer.duration = pointer.lastTime - pointer.startTime;
		pointer.distance = distance(pointer.startX, pointer.startY, pointer.lastX, pointer.lastY);

		const result = this.resolveGesture(pointer);
		this.recordGesture(result);

		if (typeof pointer.target.releasePointerCapture === 'function') {
			try {
				pointer.target.releasePointerCapture(event.pointerId);
			} catch (error) {
				// Ignore failures to release capture.
			}
		}

		this.cleanupPointer(pointer);

		eventBus.emit('touch:pointerup', {
			pointer,
			event,
			result
		});
	}

	handlePointerCancel(event) {
		const pointer = this.state.pointers.get(event.pointerId);
		if (!pointer) {
			return;
		}

		this.clearLongPress(pointer);
		this.cleanupPointer(pointer);

		eventBus.emit('touch:pointercancel', {
			pointerId: event.pointerId
		});
	}

	handleWindowBlur() {
		this.resetPointers();
	}

	shouldHandle(event) {
		if (!this.state.mounted) {
			return false;
		}

		if (event.pointerType === 'mouse' && !this.options.enableMouseGestures) {
			return false;
		}

		if (event.button && event.button !== 0) {
			return false;
		}

		return true;
	}

	resolveTarget(node) {
		if (!node) return null;
		return node.closest(this.options.selectors);
	}

	allocatePointer(event, target) {
		const pointer = this.state.pointerPool.pop() || {
			pointerId: null,
			type: null,
			target: null,
			startX: 0,
			startY: 0,
			lastX: 0,
			lastY: 0,
			startTime: 0,
			lastTime: 0,
			duration: 0,
			distance: 0,
			deltaX: 0,
			deltaY: 0,
			swipeDirection: null,
			gesture: null,
			longPressTimer: null,
			longPressTriggered: false,
			pendingEvent: null
		};

		pointer.pointerId = event.pointerId;
		pointer.type = event.pointerType;
		pointer.target = target;
		pointer.startX = event.clientX;
		pointer.startY = event.clientY;
		pointer.lastX = event.clientX;
		pointer.lastY = event.clientY;
		pointer.startTime = now();
		pointer.lastTime = pointer.startTime;
		pointer.duration = 0;
		pointer.distance = 0;
		pointer.deltaX = 0;
		pointer.deltaY = 0;
		pointer.swipeDirection = null;
		pointer.gesture = null;
		pointer.longPressTriggered = false;

		this.state.pointers.set(pointer.pointerId, pointer);

		if (this.options.longPressContext) {
			pointer.longPressTimer = setTimeout(() => {
				this.triggerLongPress(pointer);
			}, this.state.thresholds.longPress.time);
		}

		return pointer;
	}

	triggerLongPress(pointer) {
		if (!this.state.pointers.has(pointer.pointerId) || pointer.longPressTriggered) {
			return;
		}

		pointer.longPressTriggered = true;
		pointer.gesture = 'longpress';

		this.applyLongPressStyles(pointer.target);

		this.state.analytics.longPressCount += 1;
		this.state.analytics.lastGestureAt = Date.now();

		eventBus.emit('touch:longpress', {
			target: pointer.target,
			pointer
		});
	}

	clearLongPress(pointer) {
		if (pointer.longPressTimer) {
			clearTimeout(pointer.longPressTimer);
			pointer.longPressTimer = null;
		}
	}

	resolveGesture(pointer) {
		let type = pointer.gesture;

		if (pointer.longPressTriggered) {
			type = 'longpress';
		} else if (pointer.gesture === 'swipe') {
			type = 'swipe';
		} else {
			const isTap = pointer.duration <= this.state.thresholds.tap.time &&
				pointer.distance <= this.state.thresholds.tap.distance;

			if (isTap) {
				type = 'tap';
				eventBus.emit('touch:tap', {
					target: pointer.target,
					pointer
				});
			} else {
				type = 'press';
			}
		}

		if (type === 'swipe') {
			this.state.analytics.swipeCount += 1;
			eventBus.emit('touch:swipe', {
				target: pointer.target,
				direction: pointer.swipeDirection,
				pointer
			});
		} else if (type === 'tap') {
			this.state.analytics.tapCount += 1;
		}

		this.state.analytics.lastGestureAt = Date.now();

		return {
			type,
			direction: pointer.swipeDirection,
			duration: pointer.duration,
			distance: pointer.distance,
			target: pointer.target
		};
	}

	recordGesture(result) {
		this.state.history.push({
			...result,
			timestamp: Date.now()
		});

		if (this.state.history.length > HISTORY_LIMIT) {
			this.state.history.shift();
		}

		eventBus.emit('touch:gestureRecorded', result);
	}

	cleanupPointer(pointer) {
		this.removeActiveStyles(pointer.target);

		this.state.pointers.delete(pointer.pointerId);

		if (this.state.pointerPool.length < MAX_POINTER_POOL) {
			this.state.pointerPool.push(pointer);
		}
	}

	resetPointers() {
		this.state.pointers.forEach(pointer => {
			this.clearLongPress(pointer);
			this.removeActiveStyles(pointer.target);
		});
		this.state.pointers.clear();
	}

	applyActiveStyles(target) {
		if (!target) return;
		target.classList.add('touch-feedback--active');
	}

	applyLongPressStyles(target) {
		if (!target) return;
		target.classList.add('touch-feedback--longpress');
	}

	removeActiveStyles(target) {
		if (!target) return;
		target.classList.remove('touch-feedback--active', 'touch-feedback--longpress');
	}

	getThresholds() {
		return { ...this.state.thresholds };
	}

	getHistory() {
		return [...this.state.history];
	}

	getAnalytics() {
		return { ...this.state.analytics };
	}
}

const touchController = new TouchController();

export {
	TouchController,
	touchController
};
