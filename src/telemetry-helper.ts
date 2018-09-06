import { reporter } from './telemetry';
import { Kubectl } from './kubectl';

export function telemetrise(command: string, kubectl: Kubectl, callback: (...args: any[]) => any): (...args: any[]) => any {
    return async (a) => {
        reporter.sendTelemetryEvent("command", { command: command, clusterType: await clusterType(kubectl) });
        return callback(a);
    };
}

export enum ClusterType {
    Azure,
    Minikube,
    Other
}

let latestContextName: string | null;
let cachedClusterType: ClusterType | null = null;
const knownClusters: any = {};

export function invalidateClusterType(newContext: string): void {
    latestContextName = newContext || null;
    cachedClusterType = null;
}

async function clusterType(kubectl: Kubectl): Promise<string> {
    if (latestContextName && knownClusters[latestContextName]) {
        cachedClusterType = knownClusters[latestContextName];
    }
    if (!cachedClusterType) {
        cachedClusterType = await inferCurrentClusterType(kubectl, latestContextName);
        if (latestContextName) {
            knownClusters[latestContextName] = cachedClusterType;
        }
    }
    switch (cachedClusterType) {
        case ClusterType.Azure:
            return 'azure';
        case ClusterType.Minikube:
            return 'minikube';
        case ClusterType.Other:
            return 'other';
    }
}

async function inferCurrentClusterType(kubectl: Kubectl, contextNameHint: string | null): Promise<ClusterType | null> {
    if (!latestContextName) {
        const ctxsr = await kubectl.invokeAsync('config current-context');
        if (ctxsr.code === 0) {
            latestContextName = ctxsr.stdout.trim();
        } else {
            return ClusterType.Other;  // something is terribly wrong; we don't want to retry
        }
    }

    if (latestContextName === 'minikube') {
        return ClusterType.Minikube;
    }

    const cisr = await kubectl.invokeAsync('cluster-info');
    if (cisr.code !== 0) {
        return null;
    }
    const masterInfos = cisr.stdout.split('\n')
                                   .filter((s) => s.indexOf('master is running at') >= 0);

    if (masterInfos.length === 0) {
        return ClusterType.Other;  // something is terribly wrong; we don't want to retry
    }

    const masterInfo = masterInfos[0];
    if (masterInfo.indexOf('azure.com') >= 0) {
        return ClusterType.Azure;
    }

    if (latestContextName) {
        const gcsr = await kubectl.invokeAsync(`config get-contexts ${latestContextName}`);
        if (gcsr.code === 0) {
            if (gcsr.stdout.indexOf('minikube') >= 0) {
                return ClusterType.Minikube;  // It's pretty heuristic, so don't spend time parsing the table
            }
        }
    }

    return ClusterType.Other;
}
