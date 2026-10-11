import { TILE } from './data/constants.js';

export const EMPTY = 0;
export const SOLID = 1;
export const ONEWAY = 2;
export const HAZARD = 3;

const TILE_CHARS = { '.': EMPTY, '#': SOLID, '=': ONEWAY, '^': HAZARD, '~': HAZARD };
// Символы врагов на карте. Параметры врагов — в data/enemies.js.
const ENEMY_CHARS = { s: 'slime', w: 'wolf' };

// Склеивает сегменты уровня слева направо в одну карту.
export function joinSegments(segments) {
    const rows = segments[0].length;
    segments.forEach((segment, index) => {
        if (segment.length !== rows) {
            throw new Error(`Segment ${index}: ${segment.length} rows, expected ${rows}`);
        }
        segment.forEach((line, row) => {
            if (line.length !== segment[0].length) {
                throw new Error(
                    `Segment ${index}, row ${row}: length ${line.length}, expected ${segment[0].length}`
                );
            }
        });
    });
    return Array.from({ length: rows }, (_, row) => segments.map((segment) => segment[row]).join(''));
}

export class Level {
    constructor(def) {
        this.id = def.id;
        this.name = def.name;
        this.chars = joinSegments(def.segments);
        this.rows = this.chars.length;
        this.cols = this.chars[0].length;
        this.tiles = [];
        this.spawn = null;
        this.exit = null;
        this.checkpoints = [];
        this.coins = [];
        this.enemies = [];

        this.chars.forEach((line, row) => {
            const tileRow = [];
            for (let col = 0; col < line.length; col++) {
                const char = line[col];
                const point = { x: col * TILE, y: row * TILE, w: TILE, h: TILE };
                if (char in TILE_CHARS) {
                    tileRow.push(TILE_CHARS[char]);
                    continue;
                }
                tileRow.push(EMPTY);
                if (char === 'P') this.spawn = point;
                else if (char === 'E') this.exit = point;
                else if (char === 'C') this.checkpoints.push(point);
                else if (char === 'o') this.coins.push(point);
                else if (char in ENEMY_CHARS) this.enemies.push({ type: ENEMY_CHARS[char], ...point });
                else throw new Error(`Level "${def.id}": unknown char "${char}" at ${col},${row}`);
            }
            this.tiles.push(tileRow);
        });

        if (!this.spawn) throw new Error(`Level "${def.id}": no spawn point (P)`);
        if (!this.exit) throw new Error(`Level "${def.id}": no exit point (E)`);
    }

    get width() {
        return this.cols * TILE;
    }

    get height() {
        return this.rows * TILE;
    }

    // За боковыми краями — стена, выше и ниже уровня — пусто (в яму можно упасть).
    tileAt(col, row) {
        if (col < 0 || col >= this.cols) return SOLID;
        if (row < 0 || row >= this.rows) return EMPTY;
        return this.tiles[row][col];
    }

    charAt(col, row) {
        if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return '.';
        return this.chars[row][col];
    }
}
