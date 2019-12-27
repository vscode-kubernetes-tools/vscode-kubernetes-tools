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

    public async addWatch(name: string, apiUri: string, params: any, callback: (phase: string, obj: any) => void): Promise<void> {
        if (this.watchers.has(name)) {
            return;
        }
        const kc = await loadKubeconfig();
        const kcWatch = new kubernetes.Watch(kc);
        const doneCallback = (err: any) => {
                                            // tslint:disable-next-line:no-console
                                            // Error: read ECONNRESET
                                            // at TLSWrap.onStreamRead (internal/stream_base_commons.js:183:27)
                                            if (err &&
                                                (err as Error).name === "ECONNRESET") {
                                                    this.removeWatch(name);
                                                    this.addWatch(name, apiUri, params, callback);
                                            }
                                            console.log(err);
                                            };
        const watcher: Request = kcWatch.watch(apiUri,
                                               params,
                                               callback,
                                               doneCallback
                                               );
        this.watchers.set(name, watcher);
    }

    public removeWatch(name: string) {
        if (!this.watchers.has(name)) {
            return;
        }
        const watcher = this.watchers.get(name);
        if (watcher) {
            watcher.abort();
        }
        this.watchers.delete(name);
    }
}