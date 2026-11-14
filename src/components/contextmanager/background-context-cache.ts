import { ActiveValueTracker } from "./active-value-tracker";

// The use case here is when we have to work with an API that requires
// information to be available synchronously, but for us to know the
// current value is time-consuming and best performed asynchronously.
export class BackgroundContextCache<T> {
    private readonly cache = new Map<string, T>();
    private readonly activeUpdates = new Map<string, boolean>();

    constructor(private readonly activeContextTracker: ActiveValueTracker<string | null>,
        private readonly getActiveContextValue: () => Promise<T>,
        private readonly fallbackValue: T,
        // Fetches only when this returns true.
        private readonly isUpdateAllowed: () => boolean = () => true)
    {
        this.activeContextTracker.activeChanged(this.invalidateActive, this);
        this.invalidateActive();
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

    // Refetches the value for the active context in the background. The cached value is served until the new one arrives.
    public invalidateActive(): void {
        const activeContext = this.activeContextTracker.active();
        if (activeContext) {
            this.updateCache(activeContext);
        }
    }

    private async updateCache(activeContextName: string): Promise<void> {
        if (this.activeUpdates.get(activeContextName) || !this.isUpdateAllowed()) {
            return;
        }
        try {
            this.activeUpdates.set(activeContextName, true);
            const value = await this.getActiveContextValue();
            // Heuristic check that the active context didn't change while getActiveContextValue
            // was doing it thing (because it it did then the retrieved value might not be for the
            // context we thought it was!).
            if (this.activeContextTracker.active() === activeContextName) {
                this.cache.set(activeContextName, value);
            }
        } finally {
            this.activeUpdates.delete(activeContextName);
        }
    }
}
