import { loadKubeconfig } from '../../explainer';
import * as kubernetes from '@kubernetes/client-node';
import { Request } from 'request';

export class WatchManager {
    private static instance: WatchManager;
    private watchers: Map<string, Request>;

    private constructor() {
        this.watchers = new Map<string, Request>();
    }

    public static getInstance() {
        if (!this.instance) {
            this.instance = new WatchManager();
        }

        return this.instance;
    }

    public async addWatch(id: string, apiUri: string, params: any, callback: (phase: string, obj: any) => void): Promise<void> {
        if (this.watchers.has(id)) {
            return;
        }
        const kc = await loadKubeconfig();
        const kcWatch = new kubernetes.Watch(kc);
        const doneCallback = (err: any) => {
                                            // Error: read ECONNRESET
                                            // at TLSWrap.onStreamRead (internal/stream_base_commons.js:183:27)
                                            if (err &&
                                                (err as Error).name === "ECONNRESET") {
                                                    this.removeWatch(id);
                                                    this.addWatch(id, apiUri, params, callback);
                                            }
                                            console.log(err);
                                            };
        const watcher: Request = kcWatch.watch(apiUri,
                                               params,
                                               callback,
                                               doneCallback
                                               );
        this.watchers.set(id, watcher);
    }

    public removeWatch(id: string) {
        if (!this.watchers.has(id)) {
            return;
        }
        const watcher = this.watchers.get(id);
        if (watcher) {
            watcher.abort();
        }
        this.watchers.delete(id);
    }

    public clear() {
        if (this.watchers && this.watchers.size > 0) {
            this.watchers.forEach((_value, key, _map) => {
                this.removeWatch(key);
            });
        }
    }
}