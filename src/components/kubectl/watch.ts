import * as kubernetes from '@kubernetes/client-node';
import { Request } from 'request';
import { loadKubeconfig } from './kubeconfig';

interface InactiveWatch {
    readonly active: false;
}
interface ActiveWatch {
    readonly active: true;
    readonly request: Request;
}
type Watch = InactiveWatch | ActiveWatch;

export class WatchManager {
    private static mng: WatchManager;
    private readonly watchers: Map<string, Watch> = new Map<string, Watch>();

    public static instance() {
        if (!this.mng) {
            this.mng = new WatchManager();
        }

        return this.mng;
    }

    public async addWatch(id: string, apiUri: string, params: any, callback: (phase: string, obj: any) => void): Promise<void> {
        if (!id) {
            return;
        }
        if (this.watchers.has(id) && (this.watchers.get(id) as Watch).active) {
            return;
        }

        const kc = await loadKubeconfig();
        const kcWatch = new kubernetes.Watch(kc);
        const restartWatchOnConnectionError = (err: any) => {
                    // Error: read ECONNRESET
                    // at TLSWrap.onStreamRead (internal/stream_base_commons.js:183:27)
                    if (err &&
                        (err as Error).name === "ECONNRESET") {
                        this.removeWatch(id);
                        this.addWatch(id, apiUri, params, callback);
                    }
                };
        if (!params) {
            params = {};
        }
        const req: Request = kcWatch.watch(apiUri, params, callback, restartWatchOnConnectionError);
        this.watchers.set(id, { active: true, request: req } );
    }

    public removeWatch(id: string) {
        if (!id || !this.watchers.has(id)) {
            return;
        }
        if (this.watchers.has(id) && !(this.watchers.get(id) as Watch).active) {
            return;
        }
        const watcher = this.watchers.get(id);
        if (watcher && watcher.active) {
            watcher.request.abort();
        }
        this.watchers.set(id, { active: false });
    }

    public clear() {
        if (this.watchers && this.watchers.size > 0) {
            this.watchers.forEach((_value, key, _map) => {
                this.removeWatch(key);
            });
            this.watchers.clear();
        }
    }

    public existsWatch(id: string) {
        return id && this.watchers.has(id);
    }
}