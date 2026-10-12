import test from 'node:test';
import assert from 'node:assert/strict';
import { AudioSystem, SOUNDS, MUSIC, noteFrequency } from '../js/systems/Audio.js';

// Подмена AudioContext: запоминает созданные осцилляторы и их громкость.
function fakeContext() {
    const param = () => {
        const calls = [];
        return {
            calls,
            setValueAtTime: (value, time) => calls.push(['set', value, time]),
            exponentialRampToValueAtTime: (value, time) => calls.push(['ramp', value, time]),
            linearRampToValueAtTime: (value, time) => calls.push(['line', value, time]),
        };
    };
    const context = {
        currentTime: 10,
        sampleRate: 1000,
        state: 'suspended',
        destination: {},
        resumed: 0,
        oscillators: [],
        gains: [],
        sources: [],     // источники шума: малый барабан и тарелки
        createBuffer(channels, length) {
            const data = new Float32Array(length);
            return { length, getChannelData: () => data };
        },
        createBufferSource() {
            const source = { buffer: null, started: null, stopped: null,
                connect() {}, start(time) { this.started = time; }, stop(time) { this.stopped = time; } };
            this.sources.push(source);
            return source;
        },
        resume() { this.resumed++; this.state = 'running'; },
        createOscillator() {
            const oscillator = { type: '', frequency: param(), started: null, stopped: null,
                connect() {}, start(time) { this.started = time; }, stop(time) { this.stopped = time; } };
            this.oscillators.push(oscillator);
            return oscillator;
        },
        createGain() {
            const gain = { gain: { ...param(), value: 1 }, connect() {} };
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

// ---------- Музыка ----------

const notes = (context) => context.oscillators.map((o) => o.frequency.calls[0][1]);

test('ноты: 69 — это ля 440 Гц, октава удваивает частоту', () => {
    assert.equal(noteFrequency(69), 440);
    assert.ok(Math.abs(noteFrequency(81) - 880) < 1e-9);
    assert.ok(Math.abs(noteFrequency(60) - 261.63) < 0.01);
});

test('мелодии описаны полностью: четыре такта по восемь долей', () => {
    assert.deepEqual(Object.keys(MUSIC).sort(), ['castle', 'dungeon', 'forest', 'menu']);
    for (const [name, def] of Object.entries(MUSIC)) {
        if (def.action) assert.ok(def.bpm >= 100 && def.bpm <= 140, `${name}: бодрый темп`);
        else assert.ok(def.bpm >= 50 && def.bpm <= 80, `${name}: спокойный темп`);
        assert.equal(def.chords.length, 4, name);
        assert.equal(def.bass.length, 4, name);
        assert.equal(def.melody.length, 4, name);
        for (const bar of def.melody) {
            assert.equal(bar.length, 8, `${name}: восемь долей в такте`);
            assert.ok(bar.some((note) => note !== null), `${name}: в такте есть мелодия`);
            for (const note of bar) assert.ok(note === null || (note >= 60 && note <= 84), `${name}: мелодия в среднем регистре`);
        }
        for (const chord of def.chords) {
            assert.equal(chord.length, 3, `${name}: трезвучия`);
            for (const note of chord) assert.ok(note >= 48 && note <= 72, name);
        }
        for (const note of def.bass) assert.ok(note >= 28 && note <= 55, `${name}: бас ниже аккордов`);
    }
});

test('музыка расписывает ноты только на ближайшие доли секунды', () => {
    const { audio, context } = unlocked();
    audio.startMusic('menu');
    assert.equal(context.oscillators.length, 0, 'ноты ставит update, а не startMusic');
    audio.update();
    const first = context.oscillators.length;
    // Первая доля такта: три ноты аккорда, бас, нота мелодии и её эхо. Вторая доля — пауза.
    assert.equal(first, 6);
    // Сами ноты — в пределах 0,6 с; эхо мелодии отстаёт от своей ноты ещё на полторы доли.
    assert.ok(context.oscillators.every((o) => o.started <= context.currentTime + 1.4));
    audio.update();
    assert.equal(context.oscillators.length, first, 'без хода времени новых нот нет');
    for (let i = 0; i < 4; i++) {
        context.currentTime += 0.25;
        audio.update();
    }
    assert.ok(context.oscillators.length > first, 'время пошло — появились следующие ноты');
});

test('первый такт меню: аккорд ля минор, бас и нота ми', () => {
    const { audio, context } = unlocked();
    audio.startMusic('menu');
    audio.update();
    const played = notes(context).map((frequency) => Math.round(frequency));
    assert.deepEqual(played.slice(0, 3), [220, 262, 330], 'ля, до, ми');
    assert.equal(played[3], 110, 'бас — ля октавой ниже');
    assert.equal(played[4], 659, 'мелодия начинается с ми');
});

test('ноты музыки нарастают и затухают плавно, без щелчков', () => {
    const { audio, context } = unlocked();
    audio.startMusic('menu');
    audio.update();
    const envelope = context.gains[1].gain.calls;   // gains[0] — общий регулятор музыки
    assert.deepEqual(envelope.map((call) => call[0]), ['set', 'line', 'ramp']);
    assert.ok(envelope[0][1] < 0.001, 'начинается с тишины');
    assert.ok(envelope[2][1] < 0.001, 'заканчивается тишиной');
    assert.ok(envelope[1][2] - envelope[0][2] >= 0.5, 'аккорд появляется не мгновенно');
});

test('повторный запуск той же мелодии ничего не меняет, другая — плавно сменяет', () => {
    const { audio, context } = unlocked();
    audio.startMusic('forest');
    const master = context.gains[0];
    audio.startMusic('forest');
    assert.equal(context.gains.length, 1);
    audio.startMusic('castle');
    assert.equal(context.gains.length, 2, 'у новой мелодии свой регулятор');
    const fade = master.gain.calls.at(-1);
    assert.deepEqual([fade[0], fade[1]], ['line', 0], 'прежняя затихает до нуля');
    assert.ok(fade[2] > context.currentTime, 'не мгновенно');
    audio.update();
    assert.equal(Math.round(notes(context)[0]), 196, 'звучит аккорд замка (соль — нижняя нота ми минора)');
});

test('мелодия, заказанная до разблокировки звука, включается после неё', () => {
    const context = fakeContext();
    const audio = new AudioSystem(() => context);
    audio.startMusic('menu');
    audio.update();
    assert.equal(context.oscillators.length, 0);
    audio.unlock();
    audio.update();
    assert.ok(context.oscillators.length > 0);
});

test('громкость музыки меняется на лету; на нуле ноты не создаются', () => {
    const { audio, context } = unlocked();
    audio.startMusic('castle');
    audio.setMusicVolume(1);
    assert.ok(context.gains[0].gain.value <= 0.7, 'музыка остаётся фоном даже на максимуме');
    audio.setMusicVolume(0);
    assert.equal(context.gains[0].gain.value, 0);
    audio.update();
    assert.equal(context.oscillators.length, 0);
    audio.setMusicVolume(0.5);
    for (let i = 0; i < 6; i++) {
        context.currentTime += 0.5;
        audio.update();
    }
    assert.ok(context.oscillators.length > 0, 'после включения музыка продолжается');
});

test('после долгой паузы музыка не «догоняет» пропущенное залпом нот', () => {
    const { audio, context } = unlocked();
    audio.startMusic('dungeon');
    audio.update();
    const before = context.oscillators.length;
    context.currentTime += 120;   // вкладка была скрыта две минуты
    audio.update();
    assert.ok(context.oscillators.length - before < 30, `новых нот ${context.oscillators.length - before}`);
    assert.ok(context.oscillators.at(-1).started >= context.currentTime, 'ноты не ставятся в прошлое');
});

test('остановка музыки заглушает её и сбрасывает заказ', () => {
    const { audio, context } = unlocked();
    audio.startMusic('menu');
    audio.stopMusic();
    audio.update();
    assert.equal(context.oscillators.length, 0);
    assert.equal(audio.wanted, null);
});

test('отказ браузера возобновить звук не роняет игру', async () => {
    const context = fakeContext();
    context.resume = () => Promise.reject(new Error('not allowed'));
    const audio = new AudioSystem(() => context);
    assert.doesNotThrow(() => audio.unlock());
    await new Promise((resolve) => setImmediate(resolve));   // необработанный отказ уронил бы тест
});

// ---------- Боевая музыка уровней ----------

// Проигрывает один такт мелодии при заданном накале и возвращает, что прозвучало.
function playBar(name, intensity) {
    const { audio, context } = unlocked();
    audio.setIntensity(intensity);
    audio.startMusic(name);
    const stepTime = audio.stepTime(MUSIC[name]);
    for (let step = 0; step < 16; step++) {
        audio.scheduleAction(audio.music, 20 + step * stepTime, stepTime);
        audio.music.step++;
    }
    const kicks = context.oscillators.filter((o) => o.frequency.calls[0][1] === 150);
    const snares = context.sources.filter((source) => Math.abs(source.stopped - source.started - 0.12) < 1e-9);
    const hats = context.sources.filter((source) => source.stopped - source.started < 0.05);
    const arpeggio = context.oscillators.filter((o) => o.type === 'square');
    const bass = context.oscillators.filter((o) => o.type === 'triangle' && o.frequency.calls[0][1] < 130 && o.frequency.calls[0][1] !== 150);
    return { context, stepTime, kicks, snares, hats, arpeggio, bass };
}

test('музыка уровней быстрее меню и идёт шестнадцатыми', () => {
    const audio = new AudioSystem(() => fakeContext());
    assert.equal(audio.stepTime(MUSIC.menu), 0.5);
    for (const name of ['forest', 'castle', 'dungeon']) {
        assert.equal(MUSIC[name].action, true);
        assert.ok(audio.stepTime(MUSIC[name]) < 0.15, `${name}: доля короче 0,15 с`);
    }
    assert.equal(MUSIC.menu.action, undefined, 'меню остаётся спокойным');
});

test('накал 0 — путь: без бочки и малого барабана, редкий бас, лёгкие тарелки', () => {
    const bar = playBar('forest', 0);
    assert.equal(bar.kicks.length, 0);
    assert.equal(bar.snares.length, 0);
    assert.equal(bar.hats.length, 4);
    assert.equal(bar.arpeggio.length, 8, 'арпеджио восьмыми');
});

test('накал 1 — бой: бочка, малый барабан на вторую и четвёртую долю, арпеджио шестнадцатыми', () => {
    const calm = playBar('forest', 0);
    const fight = playBar('forest', 1);
    assert.equal(fight.kicks.length, 3);
    assert.equal(fight.snares.length, 2);
    const beat = fight.stepTime * 4;
    assert.deepEqual(fight.snares.map((source) => Math.round((source.started - 20) / beat)), [1, 3]);
    assert.equal(fight.arpeggio.length, 16);
    assert.ok(fight.hats.length > calm.hats.length);
    assert.ok(fight.context.oscillators.length > calm.context.oscillators.length, 'в бою слоёв больше');
});

test('накал 2 — страж: бочка на каждую долю такта, арпеджио уходит выше', () => {
    const fight = playBar('dungeon', 1);
    const boss = playBar('dungeon', 2);
    assert.equal(boss.kicks.length, 4);
    assert.equal(boss.hats.length, 16);
    const top = (bar) => Math.max(...bar.arpeggio.map((o) => o.frequency.calls[0][1]));
    assert.ok(top(boss) > top(fight) * 1.9, 'арпеджио поднялось на октаву');
});

test('накал ограничен 0…2 и меняется на ближайшей доле', () => {
    const { audio, context } = unlocked();
    audio.setIntensity(9);
    assert.equal(audio.intensity, 2);
    audio.setIntensity(-1);
    assert.equal(audio.intensity, 0);

    audio.startMusic('castle');
    audio.update();
    assert.equal(context.oscillators.filter((o) => o.frequency.calls[0][1] === 150).length, 0);
    audio.setIntensity(2);
    for (let i = 0; i < 8; i++) {
        context.currentTime += 0.3;
        audio.update();
    }
    assert.ok(context.oscillators.some((o) => o.frequency.calls[0][1] === 150), 'бочка вступила');
});

test('на музыку меню накал не влияет', () => {
    const count = (intensity) => {
        const { audio, context } = unlocked();
        audio.setIntensity(intensity);
        audio.startMusic('menu');
        audio.update();
        return context.oscillators.length + context.sources.length;
    };
    assert.equal(count(0), count(2));
});

test('шум для ударных создаётся один раз', () => {
    const { audio } = unlocked();
    audio.startMusic('forest');
    audio.setIntensity(2);
    const first = audio.noiseBuffer();
    audio.update();
    assert.equal(audio.noiseBuffer(), first);
    assert.ok(first.getChannelData(0).some((value) => value !== 0), 'буфер заполнен шумом');
});
