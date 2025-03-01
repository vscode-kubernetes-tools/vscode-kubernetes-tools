import { reporter } from './telemetry';
import { Kubectl } from './kubectl';
import { ExecResult } from './binutilplusplus';

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
    GetClusterInfoFailedNoKubectl,
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
        case NonDeterminationReason.GetClusterInfoFailedNoKubectl:
            return 'error_calling_kubectl_cluster_info_no_kubectl';
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
        const ctxer = await kubectl.invokeCommand('config current-context');
        if (ctxer.resultKind === 'exec-succeeded') {
            latestContextName = ctxer.stdout.trim();
        } else {
            return [ClusterType.Other, NonDeterminationReason.GetCurrentContextError];  // something is terribly wrong; we don't want to retry
        }
    }

    if (latestContextName === 'minikube') {
        return [ClusterType.Minikube, NonDeterminationReason.None];
    }

    const cier = await kubectl.invokeCommand('cluster-info');
    if (cier.resultKind !== 'exec-succeeded') {
        return [inferClusterTypeFromError(cier), diagnoseKubectlClusterInfoError(cier)];
    }

    // Cleaner way to remove the ANSI code and avoid dependency on a library
    const removeANSI = (str: string): string => str.replace(/\x1B\[[0-9;]*[mK]/g, '');

    const masterInfos = removeANSI(cier.stdout).split('\n')
                                   .filter((s) => s.indexOf('control plane is running at') >= 0);

    if (masterInfos.length === 0) {
        return [ClusterType.Other, NonDeterminationReason.NoMasterInClusterInfo];  // something is terribly wrong; we don't want to retry
    }

    const masterInfo = masterInfos[0];
    if (masterInfo.indexOf('azmk8s.io') >= 0 || masterInfo.indexOf('azure.com') >= 0) {
        return [ClusterType.Azure, NonDeterminationReason.None];
    }

    if (latestContextName) {
        const gcer = await kubectl.invokeCommand(`config get-contexts ${latestContextName}`);
        if (gcer.resultKind === 'exec-succeeded') {
            if (gcer.stdout.indexOf('minikube') >= 0) {
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

function inferClusterTypeFromError(er: ExecResult): ClusterType {
    if (er.resultKind === 'exec-errored') {
        if (!er.stderr) {
            return ClusterType.Indeterminate;
        }

        const errorText = er.stderr.toLowerCase();
        if (errorText.includes('dial tcp localhost') || errorText.includes('dial tcp 127.0.0.1')) {
            return ClusterType.FailedLocal;
        }
    }

    return ClusterType.Indeterminate;
}

function diagnoseKubectlClusterInfoError(er: ExecResult): NonDeterminationReason {
    if (er.resultKind === 'exec-bin-not-found') {
        return NonDeterminationReason.GetClusterInfoFailedNoKubectl;
    }
    if (er.resultKind === 'exec-failed') {
        return NonDeterminationReason.GetClusterInfoFailed;
    }

    if (er.resultKind === 'exec-succeeded') {
        return NonDeterminationReason.None;
    }

    if (!er.stderr || er.stderr.length === 0) {
        return NonDeterminationReason.GetClusterInfoOtherError;
    }

    const error = er.stderr.toLowerCase();

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
