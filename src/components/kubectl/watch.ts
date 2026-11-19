import * as kubernetes from '@kubernetes/client-node';
import { loadKubeconfig } from './kubeconfig';

interface InactiveWatch {
    readonly active: false;
}
interface ActiveWatch {
    readonly active: true;
    readonly request: AbortController;
    readonly id: symbol;
}
type Watch = InactiveWatch | ActiveWatch;

export class WatchManager {
    private static mng: WatchManager;
    private readonly watchers: Map<string, Watch> = new Map<string, Watch>();
    private readonly starting = new Map<string, symbol>();

    public static instance() {
        if (!this.mng) {
            this.mng = new WatchManager();
        }

        return this.mng;
    }

    public async addWatch(id: string, apiUri: string, params: any, callback: (phase: string, obj: any) => void, isAllowed: () => boolean): Promise<void> {
        if (!id || !isAllowed() || this.starting.has(id) || this.watchers.get(id)?.active) {
            return;
        }

        const startup = Symbol();
        this.starting.set(id, startup);
        try {
            await this.startWatch(id, apiUri, params ?? {}, callback, startup, isAllowed);
        } finally {
            if (this.starting.get(id) === startup) {
                this.starting.delete(id);
            }
        }
    }

    private async startWatch(id: string, apiUri: string, params: any, callback: (phase: string, obj: any) => void,
        startup: symbol, isAllowed: () => boolean): Promise<void> {
        const canStart = () => isAllowed() && this.starting.get(id) === startup;
        const isCurrent = () => {
            const watch = this.watchers.get(id);
            return isAllowed() && watch?.active && watch.id === startup;
        };
        const kc = await loadKubeconfig();
        if (!canStart()) {
            return;
        }
        const kcWatch = new kubernetes.Watch(kc);
        const restartWatchOnConnectionError = (err: any) => {
                    // Error: read ECONNRESET
                    // at TLSWrap.onStreamRead (internal/stream_base_commons.js:183:27)
                    if (isCurrent() && err &&
                        (err as Error).name === "ECONNRESET") {
                        this.removeWatch(id);
                        this.addWatch(id, apiUri, params, callback, isAllowed);
                    }
                };
        const req: AbortController = await kcWatch.watch(apiUri, params, (phase, obj) => {
            if (canStart() || isCurrent()) {
                callback(phase, obj);
            }
        }, restartWatchOnConnectionError);
        if (!canStart()) {
            req.abort();
            return;
        }
        this.watchers.set(id, { active: true, request: req, id: startup });
    }

    public removeWatch(id: string) {
        this.starting.delete(id);
        if (!id || !this.watchers.has(id)) {
            return;
        }
        if (this.watchers.has(id) && !(this.watchers.get(id) as Watch).active) {
            return;
        }
        const watcher = this.watchers.get(id);
        this.watchers.set(id, { active: false });
        if (watcher && watcher.active) {
            watcher.request.abort();
        }
    }

    public pause(): void {
        this.starting.clear();
        this.watchers.forEach((_value, id) => this.removeWatch(id));
    }

    public clear() {
        this.pause();
        this.watchers.clear();
    }

    public existsWatch(id: string) {
        return id && this.watchers.has(id);
    }
}
