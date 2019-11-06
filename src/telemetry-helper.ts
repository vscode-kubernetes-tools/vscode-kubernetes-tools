import { reporter } from './telemetry';
import { Kubectl } from './kubectl';
import { ShellResult } from './shell';

export function telemetrise(command: string, kubectl: Kubectl, callback: (...args: any[]) => any): (...args: any[]) => any {
    return (a) => {
        clusterType(kubectl).then(([ct, ndr]) => {
            if (reporter) {
                reporter.sendTelemetryEvent("command", { command: command, clusterType: ct, nonDeterminationReason: ndr });
            }
        });
        return callback(a);
    };
}

export enum ClusterType {
    Unassigned = 0,  // This *should* be impossible to see, but tracking it for the case where something has been incorrectly 0-initialised
    Indeterminate,
    Azure,
    Minikube,
    Local,
    FailedLocal,
    Other
}

export enum NonDeterminationReason {
    Unassigned = 0,  // This *should* be impossible to see, but tracking it for the case where something has been incorrectly 0-initialised
    None,
    GetCurrentContextError,
    GetClusterInfoFailed,
    ConnectionRefused,
    ConnectionTimeout,
    ConnectionOtherError,
    CredentialsExecError,
    CredentialsOtherError,
    GetClusterInfoOtherError,
    NoMasterInClusterInfo,
    NonAzureMasterURL
}

let latestContextName: string | null;
let cachedClusterType: ClusterType = ClusterType.Indeterminate;
let cachedReason = NonDeterminationReason.None;
const knownClusters: { [key: string]: [ClusterType, NonDeterminationReason] } = {};

export function invalidateClusterType(newContext: string | undefined, kubectl?: Kubectl): void {
    latestContextName = newContext || null;
    cachedClusterType = ClusterType.Indeterminate;
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

async function clusterType(kubectl: Kubectl): Promise<[string, string]> {
    if (cachedClusterType === ClusterType.Indeterminate || cachedClusterType === ClusterType.Unassigned) {
        await loadCachedClusterType(kubectl);
    }

    return [telemetryNameOf(cachedClusterType), telemetryReasonOf(cachedReason)];
}

function telemetryNameOf(clusterType: ClusterType): string {
    switch (clusterType) {
        case ClusterType.Azure:
            return 'azure';
        case ClusterType.Minikube:
            return 'minikube';
        case ClusterType.Local:
            return 'local_non_minikube';
        case ClusterType.FailedLocal:
            return 'local_unreachable';
        case ClusterType.Other:
            return 'other';
        case ClusterType.Indeterminate:
            return 'indeterminate';
        case ClusterType.Unassigned:
            return 'internal_k8s_extension_error';
    }
}

function telemetryReasonOf(reason: NonDeterminationReason): string {
    switch (reason) {
        case NonDeterminationReason.None:
            return '';
        case NonDeterminationReason.GetCurrentContextError:
            return 'error_getting_current_context';
        case NonDeterminationReason.GetClusterInfoFailed:
            return 'error_calling_kubectl_cluster_info';
        case NonDeterminationReason.ConnectionRefused:
            return 'cluster_connection_refused';
        case NonDeterminationReason.ConnectionTimeout:
            return 'cluster_connection_timeout';
        case NonDeterminationReason.ConnectionOtherError:
            return 'cluster_connection_misc_error';
        case NonDeterminationReason.CredentialsExecError:
            return 'cluster_credentials_exec_error';
        case NonDeterminationReason.CredentialsOtherError:
            return 'cluster_credentials_misc_error';
        case NonDeterminationReason.GetClusterInfoOtherError:
            return 'kubectl_cluster_info_misc_error';
        case NonDeterminationReason.NoMasterInClusterInfo:
            return 'no_master_in_cluster_info';
        case NonDeterminationReason.NonAzureMasterURL:
            return 'master_url_not_recognised';
        case NonDeterminationReason.Unassigned:
            return 'internal_k8s_extension_error';
    }
}

async function loadCachedClusterType(kubectl: Kubectl) {
    if (latestContextName && knownClusters[latestContextName]) {
        [cachedClusterType, cachedReason] = knownClusters[latestContextName];
    }
    else {
        [cachedClusterType, cachedReason] = await inferCurrentClusterType(kubectl);
        if (latestContextName) {
            knownClusters[latestContextName] = [cachedClusterType, cachedReason];
        }
    }
}

async function inferCurrentClusterType(kubectl: Kubectl): Promise<[ClusterType, NonDeterminationReason]> {
    if (!latestContextName) {
        const ctxsr = await kubectl.invokeAsync('config current-context');
        if (ctxsr && ctxsr.code === 0) {
            latestContextName = ctxsr.stdout.trim();
        } else {
            return [ClusterType.Other, NonDeterminationReason.GetCurrentContextError];  // something is terribly wrong; we don't want to retry
        }
    }

    if (latestContextName === 'minikube') {
        return [ClusterType.Minikube, NonDeterminationReason.None];
    }

    const cisr = await kubectl.invokeAsync('cluster-info');
    if (!cisr || cisr.code !== 0) {
        return [inferClusterTypeFromError(cisr), diagnoseKubectlClusterInfoError(cisr)];
    }
    const masterInfos = cisr.stdout.split('\n')
                                   .filter((s) => s.indexOf('master is running at') >= 0);

    if (masterInfos.length === 0) {
        return [ClusterType.Other, NonDeterminationReason.NoMasterInClusterInfo];  // something is terribly wrong; we don't want to retry
    }

    const masterInfo = masterInfos[0];
    if (masterInfo.indexOf('azmk8s.io') >= 0 || masterInfo.indexOf('azure.com') >= 0) {
        return [ClusterType.Azure, NonDeterminationReason.None];
    }

    if (latestContextName) {
        const gcsr = await kubectl.invokeAsync(`config get-contexts ${latestContextName}`);
        if (gcsr && gcsr.code === 0) {
            if (gcsr.stdout.indexOf('minikube') >= 0) {
                return [ClusterType.Minikube, NonDeterminationReason.None];  // It's pretty heuristic, so don't spend time parsing the table
            }
        }
    }

    // TODO: validate this
    if (masterInfo.indexOf('localhost') >= 0 || masterInfo.indexOf('127.0.0.1') >= 0) {
        return [ClusterType.Local, NonDeterminationReason.None];
    }

    return [ClusterType.Other, NonDeterminationReason.NonAzureMasterURL];
}

function inferClusterTypeFromError(sr: ShellResult | undefined): ClusterType {
    if (!sr || sr.code === 0 || !sr.stderr) {
        return ClusterType.Indeterminate;  // shouldn't be calling us in this case!
    }

    const errorText = sr.stderr.toLowerCase();
    if (errorText.includes('dial tcp localhost') || errorText.includes('dial tcp 127.0.0.1')) {
        return ClusterType.FailedLocal;
    }

    return ClusterType.Indeterminate;
}

function diagnoseKubectlClusterInfoError(sr: ShellResult | undefined): NonDeterminationReason {
    if (!sr) {
        return NonDeterminationReason.GetClusterInfoFailed;
    }

    if (sr.code === 0) {
        return NonDeterminationReason.None;
    }

    if (!sr.stderr || sr.stderr.length === 0) {
        return NonDeterminationReason.GetClusterInfoOtherError;
    }

    const error = sr.stderr.toLowerCase();

    if (error.includes('connectex:')) {
        if (error.includes('actively refused')) {
            return NonDeterminationReason.ConnectionRefused;
        }
        if (error.includes('did not properly response after a period of time')) {
            return NonDeterminationReason.ConnectionTimeout;
        }
        return NonDeterminationReason.ConnectionOtherError;
    }

    if (error.includes('getting credentials')) {
        if (error.includes('exec')) {
            return NonDeterminationReason.CredentialsExecError;
        }
        return NonDeterminationReason.CredentialsOtherError;
    }

    return NonDeterminationReason.GetClusterInfoOtherError;
}
