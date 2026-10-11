// Подмена window для тестов: хранит обработчики и умеет рассылать события.
export function fakeTarget() {
    const listeners = new Map();
    return {
        addEventListener(type, fn) {
            if (!listeners.has(type)) listeners.set(type, new Set());
            listeners.get(type).add(fn);
        },
        removeEventListener(type, fn) {
            listeners.get(type)?.delete(fn);
        },
        dispatch(type, event = {}) {
            const full = { repeat: false, preventDefault() {}, ...event };
            for (const fn of listeners.get(type) ?? []) fn(full);
        },
        count() {
            let total = 0;
            for (const set of listeners.values()) total += set.size;
            return total;
        },
    };
}
