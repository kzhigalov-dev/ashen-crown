// Настройки игрока. Хранятся отдельно от прогресса: они относятся
// к устройству, а не к герою, и нужны ещё до начала игры.

export const SETTINGS_KEY = 'ashen-crown-settings';

export function defaultSettings() {
    return {
        volume: 0.5,   // громкость эффектов, 0…1
        music: 0.5,    // громкость музыки, 0…1
        shake: true,   // тряска экрана при ударах
        notes: true,   // записки у костров
        lootPopup: true,  // окно с вопросом «надеть?» при находке предмета
    };
}

const isLevel = (value) => Number.isFinite(value) && value >= 0 && value <= 1;

// storage — объект с интерфейсом localStorage; может быть null или бросать ошибки.
export class Settings {
    constructor(storage) {
        this.storage = storage;
        this.values = defaultSettings();
    }

    // Читает сохранённые настройки; каждое негодное значение заменяется значением по умолчанию.
    load() {
        const values = defaultSettings();
        try {
            const data = JSON.parse(this.storage.getItem(SETTINGS_KEY)) ?? {};
            if (isLevel(data.volume)) values.volume = data.volume;
            if (isLevel(data.music)) values.music = data.music;
            for (const key of ['shake', 'notes', 'lootPopup']) {
                if (typeof data[key] === 'boolean') values[key] = data[key];
            }
        } catch {
            // Хранилища нет или в нём мусор — остаются значения по умолчанию.
        }
        this.values = values;
        return values;
    }

    set(key, value) {
        this.values[key] = value;
        try {
            this.storage.setItem(SETTINGS_KEY, JSON.stringify(this.values));
        } catch {
            // Настройка действует до перезагрузки страницы.
        }
    }
}
