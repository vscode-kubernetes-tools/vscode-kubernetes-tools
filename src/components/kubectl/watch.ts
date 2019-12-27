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
        const kc = await loadKubeconfig();
        const kcWatch = new kubernetes.Watch(kc);
        const watcher = kcWatch.watch(apiUri,
                                      params,
                                      callback,
                                      // done callback is called if the watch terminates normally
                                      (err) => {
                                          // tslint:disable-next-line:no-console
                                          //err.code === "ECONNRESET";
                                          console.log(err);
                                      });
        this.watchers.set(name, watcher);
    }

    public removeWatch(name: string) {
        const watcher = this.watchers.get(name);
        if (watcher) {
            watcher.abort();
        }
        this.watchers.delete(name);
    }
}