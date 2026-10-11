// Звуки игры. Каждый звук — одна или несколько нот:
//   [частота начала, частота конца, начало (с), длительность (с)].
// wave — форма волны осциллятора, gain — громкость звука относительно общей.
export const SOUNDS = {
    jump: { wave: 'square', gain: 0.25, notes: [[330, 560, 0, 0.1]] },
    dash: { wave: 'sawtooth', gain: 0.25, notes: [[520, 140, 0, 0.16]] },
    attack: { wave: 'sawtooth', gain: 0.22, notes: [[420, 160, 0, 0.08]] },
    shot: { wave: 'triangle', gain: 0.3, notes: [[900, 420, 0, 0.09]] },
    blast: { wave: 'sawtooth', gain: 0.4, notes: [[240, 50, 0, 0.3]] },
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

// Фоновый гул локаций: две низкие ноты (Гц), которые медленно «дышат».
export const AMBIENCE = {
    menu: [55, 82.4],
    forest: [65.4, 98],
    castle: [58.3, 87.3],
    dungeon: [49, 73.4],
};

// Синтез звуков через Web Audio. Звуковых файлов нет.
// createContext — функция, создающая AudioContext; в тестах подставляется подмена.
export class AudioSystem {
    constructor(createContext) {
        this.createContext = createContext;
        this.context = null;
        this.volume = 0.5;
        this.musicVolume = 0.3;
        this.ambience = null;      // { name, nodes, gain } — звучащий сейчас фон
        this.wanted = null;        // какой фон должен звучать (ждёт разблокировки звука)
    }

    // Браузеры разрешают звук только после действия пользователя,
    // поэтому контекст создаётся при первом нажатии.
    unlock() {
        try {
            this.context ??= this.createContext();
            if (this.context.state === 'suspended') this.context.resume();
        } catch {
            this.context = null;  // звук недоступен — игра работает молча
        }
        if (this.wanted) this.startAmbience(this.wanted);
    }

    setMusicVolume(volume) {
        this.musicVolume = Math.max(0, Math.min(1, volume));
        if (this.ambience) this.ambience.gain.gain.value = this.musicLevel();
    }

    // Фон намеренно тихий: это атмосфера, а не мелодия.
    musicLevel() {
        return this.musicVolume * 0.12;
    }

    // Включает фоновый гул локации. Повторный вызов с тем же именем ничего не меняет.
    startAmbience(name) {
        this.wanted = name;
        if (!this.context || !AMBIENCE[name] || this.ambience?.name === name) return;
        this.stopAmbience();
        this.wanted = name;
        const { context } = this;
        const gain = context.createGain();
        gain.gain.value = this.musicLevel();
        gain.connect(context.destination);
        const nodes = AMBIENCE[name].map((frequency, index) => {
            const oscillator = context.createOscillator();
            oscillator.type = index === 0 ? 'sine' : 'triangle';
            oscillator.frequency.setValueAtTime(frequency, context.currentTime);
            oscillator.connect(gain);
            oscillator.start(context.currentTime);
            return oscillator;
        });
        this.ambience = { name, nodes, gain };
    }

    stopAmbience() {
        this.wanted = null;
        if (!this.ambience) return;
        for (const node of this.ambience.nodes) node.stop(this.context.currentTime);
        this.ambience = null;
    }

    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
    }

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
}
