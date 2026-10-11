import test from 'node:test';
import assert from 'node:assert/strict';
import { AudioSystem, SOUNDS } from '../js/systems/Audio.js';

// Подмена AudioContext: запоминает созданные осцилляторы и их громкость.
function fakeContext() {
    const param = () => {
        const calls = [];
        return {
            calls,
            setValueAtTime: (value, time) => calls.push(['set', value, time]),
            exponentialRampToValueAtTime: (value, time) => calls.push(['ramp', value, time]),
        };
    };
    const context = {
        currentTime: 10,
        state: 'suspended',
        destination: {},
        resumed: 0,
        oscillators: [],
        gains: [],
        resume() { this.resumed++; this.state = 'running'; },
        createOscillator() {
            const oscillator = { type: '', frequency: param(), started: null, stopped: null,
                connect() {}, start(time) { this.started = time; }, stop(time) { this.stopped = time; } };
            this.oscillators.push(oscillator);
            return oscillator;
        },
        createGain() {
            const gain = { gain: param(), connect() {} };
            this.gains.push(gain);
            return gain;
        },
    };
    return context;
}

function unlocked() {
    const context = fakeContext();
    const audio = new AudioSystem(() => context);
    audio.unlock();
    return { audio, context };
}

test('до первого действия пользователя звука нет', () => {
    let created = 0;
    const audio = new AudioSystem(() => { created++; return fakeContext(); });
    audio.play('jump');
    assert.equal(created, 0, 'контекст не создаётся заранее');
});

test('unlock создаёт контекст один раз и снимает приостановку', () => {
    let created = 0;
    const context = fakeContext();
    const audio = new AudioSystem(() => { created++; return context; });
    audio.unlock();
    audio.unlock();
    assert.equal(created, 1);
    assert.equal(context.resumed, 1);
});

test('звук — осциллятор с затуханием нужной длительности', () => {
    const { audio, context } = unlocked();
    audio.play('jump');
    assert.equal(context.oscillators.length, 1);
    const [oscillator] = context.oscillators;
    assert.equal(oscillator.type, 'square');
    assert.equal(oscillator.started, 10);
    assert.ok(Math.abs(oscillator.stopped - 10.1) < 1e-9);
    assert.deepEqual(oscillator.frequency.calls[0], ['set', 330, 10]);
    const [first, last] = context.gains[0].gain.calls;
    assert.equal(first[1], SOUNDS.jump.gain * 0.5, 'громкость звука × общая громкость');
    assert.equal(last[0], 'ramp');
    assert.ok(last[1] < 0.01, 'затухает почти до нуля');
});

test('мелодия из нескольких нот играется по порядку', () => {
    const { audio, context } = unlocked();
    audio.play('complete');
    assert.equal(context.oscillators.length, 4);
    const starts = context.oscillators.map((oscillator) => oscillator.started);
    assert.deepEqual(starts, [...starts].sort((a, b) => a - b));
    assert.ok(starts[3] > starts[0]);
});

test('громкость 0 выключает звук, значение ограничено от 0 до 1', () => {
    const { audio, context } = unlocked();
    audio.setVolume(0);
    audio.play('jump');
    assert.equal(context.oscillators.length, 0);
    audio.setVolume(7);
    assert.equal(audio.volume, 1);
    audio.setVolume(-3);
    assert.equal(audio.volume, 0);
});

test('неизвестный звук ничего не ломает', () => {
    const { audio, context } = unlocked();
    assert.doesNotThrow(() => audio.play('nope'));
    assert.equal(context.oscillators.length, 0);
});

test('если браузер не даёт звук, игра работает молча', () => {
    const audio = new AudioSystem(() => { throw new Error('no audio'); });
    assert.doesNotThrow(() => audio.unlock());
    assert.doesNotThrow(() => audio.play('jump'));
});

test('все звуки описаны корректно', () => {
    for (const [name, sound] of Object.entries(SOUNDS)) {
        assert.ok(['square', 'sawtooth', 'triangle', 'sine'].includes(sound.wave), name);
        assert.ok(sound.gain > 0 && sound.gain <= 1, name);
        for (const [from, to, start, duration] of sound.notes) {
            assert.ok(from > 0 && to > 0, `${name}: частоты положительны (иначе плавный переход невозможен)`);
            assert.ok(start >= 0 && duration > 0, name);
        }
    }
});
