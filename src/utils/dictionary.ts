export type Dictionary<T> = {
    [key: string]: T;
};

export module Dictionary {
    export function of<T>(): Dictionary<T> {
        return {};
    }
}
