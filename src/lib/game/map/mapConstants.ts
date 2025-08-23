export const GRID_WIDTH = 35;
export const GRID_HEIGHT = 25;

export function randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min)) + min;
}
