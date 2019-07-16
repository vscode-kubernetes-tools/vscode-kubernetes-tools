import { ActiveValueTracker } from "./active-value-tracker";

// The use case here is when we have to work with an API that requires
// information to be available synchronously, but for us to know the
// current value is time-consuming and best performed asynchronously.
export class BackgroundContextCache<T> {
    private readonly cache = new Map<string, T>();

    constructor(private readonly activeContextTracker: ActiveValueTracker<string | null>,
        private readonly getActiveContextValue: () => Promise<T>,
        private readonly fallbackValue: T)
    {
        this.activeContextTracker.activeChanged(this.onActiveContextChanged, this);

        const activeContext = this.activeContextTracker.active();
        if (activeContext) {
            this.updateCache(activeContext);
        }
    }

    private onActiveContextChanged(newContext: string | null): void {
        if (newContext) {
            this.updateCache(newContext);
        }
    }

    public async activeAsync(): Promise<T> {
        const contextName = await this.activeContextTracker.activeAsync();
        if (!contextName) {
            return this.fallbackValue;
        }
        const result = this.cache.get(contextName);
        if (result) {
            return result;
        }
        const value = await this.getActiveContextValue();
        this.cache.set(contextName, value);
        return value;
    }

    public changedActiveContextValue(): void {
        const activeContext = this.activeContextTracker.active();
        if (activeContext) {
            this.updateCache(activeContext);
        }
    }

    public active(): T {
        const activeContext = this.activeContextTracker.active();
        if (!activeContext) {
            return this.fallbackValue;
        }
        const result = this.cache.get(activeContext);
        if (result) {
            return result;
        }
        this.updateCache(activeContext);
        return this.fallbackValue;
    }

    private async updateCache(activeContextName: string): Promise<void> {
        const value = await this.getActiveContextValue();
        // Heuristic check that the active context didn't change while getActiveContextValue
        // was doing it thing (because it it did then the retrieved value might not be for the
        // context we thought it was!).
        if (this.activeContextTracker.active() === activeContextName) {
            this.cache.set(activeContextName, value);
        }
    }
}
