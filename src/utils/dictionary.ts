export type Dictionary<T> = {
    [key: string]: T;
};

export namespace Dictionary {
    export function of<T>(): Dictionary<T> {
        return {};
    }
}
