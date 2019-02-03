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

if (!Array.prototype.choose) {
    Array.prototype.choose = function<T, U>(this: T[], fn: (t: T) => U | undefined): U[] {
        return this.map(fn).filter((u) => u !== undefined).map((u) => u!);
    };
}
