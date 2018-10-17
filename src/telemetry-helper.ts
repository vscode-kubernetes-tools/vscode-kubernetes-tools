import { reporter } from './telemetry';
import { Kubectl } from './kubectl';

export function telemetrise(command: string, kubectl: Kubectl, callback: (...args: any[]) => any): (...args: any[]) => any {
    return async (a) => {
        reporter.sendTelemetryEvent("command", { command: command, clusterType: await clusterType(kubectl) });
        return callback(a);
    };
}

export enum ClusterType {
    Unknown = 0,
    Azure,
    Minikube,
    Other
}

let latestContextName: string | null;
let cachedClusterType: ClusterType = ClusterType.Unknown;
const knownClusters: any = {};

export function invalidateClusterType(newContext: string, kubectl?: Kubectl): void {
    latestContextName = newContext || null;
    cachedClusterType = ClusterType.Unknown;
    if (kubectl) {
        setImmediate(() => {
            try {
                loadCachedClusterType(kubectl);
            } catch {
                // swallow it
            }
        });
    }
}

async function clusterType(kubectl: Kubectl): Promise<string> {
    if (cachedClusterType === ClusterType.Unknown) {
        await loadCachedClusterType(kubectl);
    }

    switch (cachedClusterType) {
        case ClusterType.Azure:
            return 'azure';
        case ClusterType.Minikube:
            return 'minikube';
        case ClusterType.Other:
            return 'other';
        default:
            return 'indeterminate';
    }
}

async function loadCachedClusterType(kubectl: Kubectl) {
    if (latestContextName && knownClusters[latestContextName]) {
        cachedClusterType = knownClusters[latestContextName];
    }
    else {
        cachedClusterType = await inferCurrentClusterType(kubectl, latestContextName);
        if (latestContextName) {
            knownClusters[latestContextName] = cachedClusterType;
        }
    }
}

async function inferCurrentClusterType(kubectl: Kubectl, contextNameHint: string | null): Promise<ClusterType> {
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
        return ClusterType.Unknown;
    }
    const masterInfos = cisr.stdout.split('\n')
                                   .filter((s) => s.indexOf('master is running at') >= 0);

    if (masterInfos.length === 0) {
        return ClusterType.Other;  // something is terribly wrong; we don't want to retry
    }

    const masterInfo = masterInfos[0];
    if (masterInfo.indexOf('azmk8s.io') >= 0 || masterInfo.indexOf('azure.com') >= 0) {
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
