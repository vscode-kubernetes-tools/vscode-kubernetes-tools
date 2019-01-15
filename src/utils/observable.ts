export interface Observable<T> {
    subscribe(observer: Observer<T>): void;
}

export interface Observer<T> {
    onNext(value: T): Promise<boolean>;
}

export type Sequence<T> = T | Thenable<T> | Observable<T>;

export function isObservable<T>(s: Sequence<T>): s is Observable<T> {
    return !!((s as Observable<T>).subscribe);
}

export function isThenable<T>(s: Sequence<T>): s is Thenable<T> {
    return !!((s as Thenable<T>).then);
}
