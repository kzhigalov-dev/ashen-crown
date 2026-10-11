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

// Предсказуемый «случай»: выдаёт заданные числа по порядку, по кругу.
export function seq(...values) {
    let index = 0;
    return () => values[index++ % values.length];
}

// Повторяемый генератор случайных чисел для проверок на большом числе бросков.
export function lcg(seed = 1) {
    let state = seed;
    return () => {
        state = (state * 1664525 + 1013904223) % 4294967296;
        return state / 4294967296;
    };
}

// Подмена localStorage в памяти.
export function memoryStorage() {
    const data = new Map();
    return {
        data,
        getItem: (key) => (data.has(key) ? data.get(key) : null),
        setItem: (key, value) => { data.set(key, String(value)); },
        removeItem: (key) => { data.delete(key); },
    };
}
