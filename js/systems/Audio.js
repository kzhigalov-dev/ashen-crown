// Звуки игры. Каждый звук — одна или несколько нот:
//   [частота начала, частота конца, начало (с), длительность (с)].
// wave — форма волны осциллятора, gain — громкость звука относительно общей.
export const SOUNDS = {
    jump: { wave: 'square', gain: 0.25, notes: [[330, 560, 0, 0.1]] },
    dash: { wave: 'sawtooth', gain: 0.25, notes: [[520, 140, 0, 0.16]] },
    attack: { wave: 'sawtooth', gain: 0.22, notes: [[420, 160, 0, 0.08]] },
    shot: { wave: 'triangle', gain: 0.3, notes: [[900, 420, 0, 0.09]] },
    blast: { wave: 'sawtooth', gain: 0.4, notes: [[240, 50, 0, 0.3]] },
    chain: { wave: 'sawtooth', gain: 0.3, notes: [[1200, 300, 0, 0.12]] },
    hit: { wave: 'square', gain: 0.25, notes: [[200, 90, 0, 0.07]] },
    kill: { wave: 'square', gain: 0.3, notes: [[260, 60, 0, 0.18]] },
    hurt: { wave: 'sawtooth', gain: 0.35, notes: [[180, 70, 0, 0.2]] },
    land: { wave: 'triangle', gain: 0.2, notes: [[140, 60, 0, 0.07]] },
    death: { wave: 'sawtooth', gain: 0.4, notes: [[220, 40, 0, 0.5]] },
    bossWake: { wave: 'sawtooth', gain: 0.4, notes: [[70, 110, 0, 0.35], [110, 45, 0.35, 0.6]] },
    ui: { wave: 'square', gain: 0.12, notes: [[620, 620, 0, 0.03]] },
    confirm: { wave: 'square', gain: 0.16, notes: [[520, 520, 0, 0.04], [780, 780, 0.04, 0.06]] },
    coin: { wave: 'square', gain: 0.2, notes: [[990, 990, 0, 0.05], [1320, 1320, 0.05, 0.09]] },
    item: { wave: 'triangle', gain: 0.35, notes: [[660, 660, 0, 0.08], [880, 880, 0.08, 0.08], [1320, 1320, 0.16, 0.16]] },
    heal: { wave: 'triangle', gain: 0.3, notes: [[440, 660, 0, 0.25]] },
    bossDown: { wave: 'sawtooth', gain: 0.4, notes: [[300, 40, 0, 0.6]] },
    complete: {
        wave: 'square', gain: 0.3,
        notes: [[523, 523, 0, 0.12], [659, 659, 0.12, 0.12], [784, 784, 0.24, 0.12], [1047, 1047, 0.36, 0.3]],
    },
    defeat: {
        wave: 'triangle', gain: 0.35,
        notes: [[392, 392, 0, 0.18], [330, 330, 0.18, 0.18], [262, 262, 0.36, 0.18], [196, 150, 0.54, 0.4]],
    },
};

// Фоновая музыка: спокойные мелодии, по одной на меню и на каждый мир.
// Ноты записаны номерами MIDI (60 — «до» первой октавы, 69 — «ля» 440 Гц).
//   bpm    — темп, ударов в минуту;
//   chords — четыре аккорда по кругу, каждый звучит один такт (4 удара);
//   bass   — басовая нота под каждый аккорд;
//   melody — мелодия на каждый аккорд: восемь восьмых долей, null — пауза.
export const MUSIC = {
    // Меню — ля минор: Am, F, C, G.
    menu: {
        bpm: 60,
        chords: [[57, 60, 64], [53, 57, 60], [55, 60, 64], [55, 59, 62]],
        bass: [45, 41, 48, 43],
        melody: [
            [76, null, 72, null, 69, null, 72, null],
            [77, null, 72, null, 69, null, 65, null],
            [76, null, 72, null, 67, null, 72, null],
            [74, null, 71, null, 67, null, 71, 74],
        ],
    },
    // Лес — ре минор: Dm, B♭, F, C.
    forest: {
        bpm: 66,
        chords: [[57, 62, 65], [58, 62, 65], [57, 60, 65], [55, 60, 64]],
        bass: [50, 46, 41, 48],
        melody: [
            [74, null, 77, 74, 69, null, 72, null],
            [70, null, 74, null, 77, null, 74, null],
            [72, null, 69, null, 65, null, 69, 72],
            [67, null, 72, null, 76, null, 72, null],
        ],
    },
    // Замок — ми минор, медленно и торжественно: Em, C, Am, B.
    castle: {
        bpm: 56,
        chords: [[55, 59, 64], [55, 60, 64], [57, 60, 64], [54, 59, 63]],
        bass: [52, 48, 45, 47],
        melody: [
            [71, null, null, 76, null, null, 79, null],
            [76, null, null, 72, null, null, 67, null],
            [69, null, null, 72, null, null, 76, null],
            [75, null, null, 71, null, null, 66, null],
        ],
    },
    // Подземелье — до минор, чуть быстрее и тревожнее: Cm, A♭, Fm, G.
    dungeon: {
        bpm: 72,
        chords: [[55, 60, 63], [56, 60, 63], [53, 56, 60], [55, 59, 62]],
        bass: [48, 44, 41, 43],
        melody: [
            [72, 75, null, 79, null, 75, 72, null],
            [72, 75, null, 80, null, 75, 72, null],
            [68, 72, null, 77, null, 72, 68, null],
            [67, 71, null, 74, null, 71, 67, 62],
        ],
    },
};

const STEPS_PER_CHORD = 8;   // восьмые доли в такте
const LOOKAHEAD = 0.6;       // на сколько секунд вперёд расписываются ноты
const FADE = 0.8;            // за сколько секунд затихает прежняя мелодия

// Частота ноты по номеру MIDI.
export const noteFrequency = (midi) => 440 * 2 ** ((midi - 69) / 12);

// Синтез звуков и музыки через Web Audio. Звуковых файлов нет.
// createContext — функция, создающая AudioContext; в тестах подставляется подмена.
export class AudioSystem {
    constructor(createContext) {
        this.createContext = createContext;
        this.context = null;
        this.volume = 0.5;
        this.musicVolume = 0.5;
        this.music = null;         // играющая мелодия: { name, def, step, time, gain }
        this.wanted = null;        // какая мелодия должна звучать (ждёт разблокировки звука)
    }

    // Браузеры разрешают звук только после действия пользователя,
    // поэтому контекст создаётся при первом нажатии.
    unlock() {
        try {
            this.context ??= this.createContext();
            // resume() возвращает обещание; отказ браузера не должен ронять игру.
            if (this.context.state === 'suspended') this.context.resume()?.catch?.(() => {});
        } catch {
            this.context = null;  // звук недоступен — игра работает молча
        }
        if (this.wanted) this.startMusic(this.wanted);
    }

    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
    }

    setMusicVolume(volume) {
        this.musicVolume = Math.max(0, Math.min(1, volume));
        if (this.music) this.music.gain.gain.value = this.musicLevel();
    }

    // Музыка — фон: даже на максимуме она не громче звуков игры.
    musicLevel() {
        return this.musicVolume * 0.7;
    }

    // ---------- Звуки ----------

    play(name) {
        const sound = SOUNDS[name];
        if (!sound || !this.context || this.volume === 0) return;
        const { context } = this;
        const peak = sound.gain * this.volume;
        for (const [from, to, start, duration] of sound.notes) {
            const begin = context.currentTime + start;
            const end = begin + duration;
            const oscillator = context.createOscillator();
            const gain = context.createGain();
            oscillator.type = sound.wave;
            oscillator.frequency.setValueAtTime(from, begin);
            oscillator.frequency.exponentialRampToValueAtTime(to, end);
            // Огибающая: звук начинается громко и затухает — без щелчка в конце.
            gain.gain.setValueAtTime(peak, begin);
            gain.gain.exponentialRampToValueAtTime(0.001, end);
            oscillator.connect(gain);
            gain.connect(context.destination);
            oscillator.start(begin);
            oscillator.stop(end);
        }
    }

    // ---------- Музыка ----------

    // Включает мелодию. Повторный вызов с тем же именем ничего не меняет;
    // прежняя мелодия плавно затихает.
    startMusic(name) {
        this.wanted = name;
        if (!this.context || !MUSIC[name] || this.music?.name === name) return;
        this.fadeOut();
        const { context } = this;
        const gain = context.createGain();
        gain.gain.value = this.musicLevel();
        gain.connect(context.destination);
        this.music = { name, def: MUSIC[name], step: 0, time: context.currentTime + 0.1, gain };
    }

    stopMusic() {
        this.wanted = null;
        this.fadeOut();
    }

    fadeOut() {
        if (!this.music) return;
        const { gain } = this.music;
        const now = this.context.currentTime;
        gain.gain.setValueAtTime(gain.gain.value, now);
        gain.gain.linearRampToValueAtTime(0, now + FADE);
        this.music = null;
    }

    // Вызывается каждый кадр: расписывает ноты на ближайшие доли секунды.
    // Ноты ставятся заранее по часам звуковой системы, поэтому ритм ровный,
    // даже если кадры идут неравномерно.
    update() {
        const { context, music } = this;
        if (!context || !music) return;
        const stepTime = 60 / music.def.bpm / 2;
        // После долгой паузы (вкладка была скрыта) не «догоняем» пропущенное.
        if (music.time < context.currentTime) music.time = context.currentTime + 0.05;
        while (music.time < context.currentTime + LOOKAHEAD) {
            if (this.musicVolume > 0) this.scheduleStep(music, music.time, stepTime);
            music.step++;
            music.time += stepTime;
        }
    }

    // Одна восьмая доля: в начале такта — аккорд и бас, в свои доли — ноты мелодии.
    scheduleStep(music, time, stepTime) {
        const { chords, bass, melody } = music.def;
        const chord = Math.floor(music.step / STEPS_PER_CHORD) % chords.length;
        const slot = music.step % STEPS_PER_CHORD;
        const bar = stepTime * STEPS_PER_CHORD;

        if (slot === 0) {
            // Аккорд звучит весь такт, мягко появляясь и исчезая.
            for (const note of chords[chord]) this.tone(music, note, time, bar + 0.5, 'sine', 0.11, 0.9);
            this.tone(music, bass[chord], time, bar, 'triangle', 0.16, 0.3);
        }
        const note = melody[chord][slot];
        if (note !== null) {
            // Нота мелодии — как щипок струны; тихое эхо делает звук объёмнее.
            this.tone(music, note, time, 1.4, 'triangle', 0.2, 0.02);
            this.tone(music, note, time + stepTime * 1.5, 1.2, 'sine', 0.07, 0.02);
        }
    }

    // Одна нота музыки: громкость нарастает за attack секунд и плавно спадает к концу.
    tone(music, midi, start, duration, wave, peak, attack) {
        const { context } = this;
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = wave;
        oscillator.frequency.setValueAtTime(noteFrequency(midi), start);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.linearRampToValueAtTime(peak, start + attack);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        oscillator.connect(gain);
        gain.connect(music.gain);
        oscillator.start(start);
        oscillator.stop(start + duration);
    }
}
