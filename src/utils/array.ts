export function flatten<T>(...arrays: T[][]): T[] {
    return Array.of<T>().concat(...arrays);
}

export function definedOf<T>(...items: (T | undefined)[]): T[] {
    return items.filter((i) => i !== undefined).map((i) => i!);
}

declare global {
    interface Array<T> {
        choose<U>(fn: (t: T) => U | undefined): U[];
    }
}

function choose<T, U>(this: T[], fn: (t: T) => U | undefined): U[] {
    return this.map(fn).filter((u) => u !== undefined).map((u) => u!);
}

if (!Array.prototype.choose) {
    Object.defineProperty(Array.prototype, 'choose', {
        enumerable: false,
        value: choose
    });
}
