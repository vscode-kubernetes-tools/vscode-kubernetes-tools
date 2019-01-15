import { Observer, Observable } from "../../utils/observable";
import { sleep } from "../../sleep";

export function trackReadiness<T>(interval: number, f: (refreshCount: number) => Promise<[T, boolean]>): Observable<T> {

    let refreshCount = 0;
    const observers: Observer<T>[] = [];

    const observable = {
        subscribe(observer: Observer<T>): void {
            observers.push(observer);
        },
        async notify(value: T): Promise<void> {
            for (const o of observers) {
                await o.onNext(value);
            }
        },
        async run(): Promise<void> {
            while (true) {
                await sleep(interval);
                const [value, retry] = await f(refreshCount);
                await this.notify(value);
                if (!retry) {
                    while (observers.length > 0) {
                        observers.unshift();
                    }
                    return;
                }
                ++refreshCount;
            }
        }
    };

    observable.run();
    return observable;
}
