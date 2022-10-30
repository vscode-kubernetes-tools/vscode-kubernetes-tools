import * as vscode from "vscode";
const Cache = require('vscode-cache');

export enum ShowInformationOptions {
    Install = "Install",
    InstallFortNightly = "Install Fortnightly",
    InstallHalfYearly = "Install Half Yearly",
}

/*
    This work is done specifically from the feedback from community for minikube or helm.

    The idea is that for those 2 we will have custom dialog boxes with options to be reminder dialog box,
    in every x-days.

    Now for example: Now when "Minikube upgrade available to x.xx, currently on x.xy" informationMessage
    we display user with 3 buttons to choose from:

    Option 1: Install (which is normal behaviour)
    Option 2: Install fortnightly - which we will cache as expiration date.
    Option 3: Install Half Yearly - which we will cache as expiration date.

    At the extension.ts level we check if there is a cached value for the minikubereminder, if so and its
    currently valid, then no message will be displayed otherwise show informaionmessage will popup for the end user.
*/

export class CacheInfo {
    private extensionContext: vscode.ExtensionContext;
    private static instance: CacheInfo;
    private cacheName: string;

    private constructor(private context: vscode.ExtensionContext) {
        this.extensionContext = context;
        this.cacheName = 'minikubereminder';
    }

    public static getInstance(context: vscode.ExtensionContext) {
        if (!CacheInfo.instance) {
            CacheInfo.instance = new CacheInfo(context);
        }

        return CacheInfo.instance;
    }

    public async clear() {
        await this.context.globalState.update(this.cacheName, {});
    }

    public cacheInformation(expiration: string) {
        // Instantiate the cache by passing your `ExtensionContext` object into it
        const myCache = new Cache(this.extensionContext);
        const expirationDate = this.getCacheExpirationDate(expiration);

        if (expirationDate) {
            // Save an item to the cache by specifying a key and value
            myCache.put(this.cacheName, expirationDate);
        }
    }

    public isCached() {
        // Instantiate the cache by passing your `ExtensionContext` object into it
        const myCache = new Cache(this.extensionContext);

        // Does the cache have cacheName?
        const cachedExpirationValue = myCache.get(this.cacheName);

        if (this.isCacheExpired(cachedExpirationValue)) {
            return false;
        }

        return myCache.has(this.cacheName);
    }

    private isCacheExpired(expiration: string): boolean {
        return new Date(expiration) <= new Date();
    }

    private getCacheExpirationDate(expiration: string | void) {
        let expirationDate = new Date();
        switch (expiration) {
            case ShowInformationOptions.InstallFortNightly:
                expirationDate.setTime(expirationDate.getTime() + 15 * 24 * 3600000);
                return expirationDate;
            case ShowInformationOptions.InstallHalfYearly:
                expirationDate = new Date();
                expirationDate.setTime(expirationDate.getTime() + 180 * 24 * 3600000);
                return expirationDate;
            default:
                console.log("No cache expiration exists!");
                return;
        }
    }
}
