'use strict';

import { Shell } from '../../../shell';
import { FS } from '../../../fs';
import { ActionResult, fromShellJson, fromShellExitCodeAndStandardError, fromShellExitCodeOnly, Diagnostic } from '../../../wizard';
import { Errorable, failed } from '../../../errorable';
import * as compareVersions from 'compare-versions';
import { sleep } from '../../../sleep';
import { getKubeconfigPath } from '../../kubectl/kubeconfig';
import { Dictionary } from '../../../utils/dictionary';

export interface Context {
    readonly fs: FS;
    readonly shell: Shell;
}

export interface ServiceLocation {
    readonly displayName: string;
    readonly isPreview: boolean;
}

export interface Locations {
    readonly locations: any;
}

export interface LocationRenderInfo {
    readonly location: string;
    readonly displayText: string;
}

export interface ClusterInfo {
    readonly name: string;
    readonly resourceGroup: string;
}

export interface ConfigureResult {
    readonly clusterType: string;
    readonly gotCli: boolean;
    readonly cliInstallFile: string;
    readonly cliOnDefaultPath: boolean;
    readonly cliError: string;
    readonly gotCredentials: boolean;
    readonly credentialsError: string;
}

export interface WaitResult {
    readonly stillWaiting?: boolean;
}

const MIN_AZ_CLI_VERSION = '2.0.23';

export async function getSubscriptionList(context: Context): Promise<ActionResult<string[]>> {
    // check for prerequisites
    const prerequisiteErrors = await verifyPrerequisitesAsync(context);
    if (prerequisiteErrors.length > 0) {
        return {
            actionDescription: 'checking prerequisites',
            result: { succeeded: false, error: prerequisiteErrors }
        };
    }

    // list subs
    const subscriptions = await listSubscriptionsAsync(context);
    return {
        actionDescription: 'listing subscriptions',
        result: subscriptions
    };
}

async function verifyPrerequisitesAsync(context: Context): Promise<string[]> {
    const errors = new Array<string>();

    const azVersion = await azureCliVersion(context);
    if (azVersion === null) {
        errors.push('Azure CLI 2.0 not found - install Azure CLI 2.0 and log in');
    } else if (compareVersions(azVersion, MIN_AZ_CLI_VERSION) < 0) {
        errors.push(`Azure CLI required version is ${MIN_AZ_CLI_VERSION} (you have ${azVersion}) - you need to upgrade Azure CLI 2.0`);
    }

    return errors;
}

async function azureCliVersion(context: Context): Promise<string | null> {
    const sr = await context.shell.exec('az --version');
    if (!sr || sr.code !== 0) {
        return null;
    } else {
        const versionMatches = /azure-cli\s+\(?([0-9.]+)\)?/.exec(sr.stdout);
        if (versionMatches === null || versionMatches.length < 2) {
            return null;
        }
        return versionMatches[1];
    }
}

async function listSubscriptionsAsync(context: Context): Promise<Errorable<string[]>> {
    const sr = await context.shell.exec("az account list --all --query [*].name -ojson");

    return fromShellJson<string[]>(sr, "Unable to list Azure subscriptions");
}

export async function setSubscriptionAsync(context: Context, subscription: string): Promise<Errorable<Diagnostic>> {
    const sr = await context.shell.exec(`az account set --subscription "${subscription}"`);

    return fromShellExitCodeAndStandardError(sr, "Unable to set Azure CLI subscription");
}

export async function getClusterList(context: Context, subscription: string, clusterType: string): Promise<ActionResult<ClusterInfo[]>> {
    // log in
    const login = await setSubscriptionAsync(context, subscription);
    if (failed(login)) {
        return {
            actionDescription: 'logging into subscription',
            result: { succeeded: false, error: login.error }
        };
    }

    // list clusters
    const clusters = await listClustersAsync(context, clusterType);
    return {
        actionDescription: 'listing clusters',
        result: clusters
    };
}

async function listClustersAsync(context: Context, clusterType: string): Promise<Errorable<ClusterInfo[]>> {
    const cmd = getListClustersCommand(context, clusterType);
    const sr = await context.shell.exec(cmd);

    return fromShellJson<ClusterInfo[]>(sr, "Unable to list Kubernetes clusters");
}

function listClustersFilter(clusterType: string): string {
    if (clusterType === 'acs') {
        return '?orchestratorProfile.orchestratorType==`Kubernetes`';
    }
    return '';
}

function getListClustersCommand(context: Context, clusterType: string): string {
    const filter = listClustersFilter(clusterType);
    let query = `[${filter}].{name:name,resourceGroup:resourceGroup}`;
    if (context.shell.isUnix()) {
        query = `'${query}'`;
    }
    return `az ${getClusterCommand(clusterType)} list --query ${query} -ojson`;
}

async function listLocations(context: Context): Promise<Errorable<Locations>> {
    let query = "[].{name:name,displayName:displayName}";
    if (context.shell.isUnix()) {
        query = `'${query}'`;
    }

    const sr = await context.shell.exec(`az account list-locations --query ${query} -ojson`);

    return fromShellJson<Locations>(sr, "Unable to list Azure regions", (response) => {
        /* tslint:disable-next-line:prefer-const */
        let locations = Dictionary.of<string>();
        for (const r of response) {
            locations[r.name] = r.displayName;
        }
        return { locations: locations };
    });
}

export async function listAcsLocations(context: Context): Promise<Errorable<ServiceLocation[]>> {
    const locationInfo = await listLocations(context);
    if (failed(locationInfo)) {
        return { succeeded: false, error: locationInfo.error };
    }
    const locations = locationInfo.result;

    const sr = await context.shell.exec(`az acs list-locations -ojson`);

    return fromShellJson<ServiceLocation[]>(sr, "Unable to list ACS locations", (response) =>
        locationDisplayNamesEx(response.productionRegions, response.previewRegions, locations));
}

export async function listAksLocations(context: Context): Promise<Errorable<ServiceLocation[]>> {
    const locationInfo = await listLocations(context);
    if (failed(locationInfo)) {
        return { succeeded: false, error: locationInfo.error };
    }
    const locations = locationInfo.result;

    // There's no CLI for this, so we have to hardwire it for now
    const productionRegions = [
        "australiaeast",
        "australiasoutheast",
        "canadacentral",
        "canadaeast",
        "centralindia",
        "centralus",
        "eastasia",
        "eastus",
        "eastus2",
        "francecentral",
        "japaneast",
        "northeurope",
        "southeastasia",
        "southindia",
        "uksouth",
        "ukwest",
        "westeurope",
        "westus",
        "westus2",
    ];
    const result = locationDisplayNamesEx(productionRegions, [], locations);
    return { succeeded: true, result: result };
}

function locationDisplayNames(names: string[], preview: boolean, locationInfo: Locations): ServiceLocation[] {
    return names.map((n) => { return { displayName: locationInfo.locations[n], isPreview: preview }; });
}

function locationDisplayNamesEx(production: string[], preview: string[], locationInfo: Locations): ServiceLocation[] {
    let result = locationDisplayNames(production, false, locationInfo) ;
    result = result.concat(locationDisplayNames(preview, true, locationInfo));
    return result;
}

export async function listVMSizes(context: Context, location: string): Promise<Errorable<string[]>> {
    const sr = await context.shell.exec(`az vm list-sizes -l "${location}" -ojson`);

    return fromShellJson<string[]>(sr,
        "Unable to list Azure VM sizes",
        (response: any[]) => response.map((r) => r.name as string)
                                      .filter((name) => !name.startsWith('Basic_'))
    );
}

async function resourceGroupExists(context: Context, resourceGroupName: string): Promise<boolean> {
    const sr = await context.shell.exec(`az group show -n "${resourceGroupName}" -ojson`);

    if (sr && sr.code === 0 && !sr.stderr) {
        return sr.stdout !== null && sr.stdout.length > 0;
    } else {
        return false;
    }
}

async function ensureResourceGroupAsync(context: Context, resourceGroupName: string, location: string): Promise<Errorable<Diagnostic | null>> {
    if (await resourceGroupExists(context, resourceGroupName)) {
        return { succeeded: true, result: null };
    }

    const sr = await context.shell.exec(`az group create -n "${resourceGroupName}" -l "${location}"`);

    return fromShellExitCodeAndStandardError(sr, "Unable to check if resource group exists");
}

async function execCreateClusterCmd(context: Context, options: any): Promise<Errorable<Diagnostic>> {
    const clusterCmd = getClusterCommand(options.clusterType);
    let createCmd = `az ${clusterCmd} create -n "${options.metadata.clusterName}" -g "${options.metadata.resourceGroupName}" -l "${options.metadata.location}" --generate-ssh-keys --no-wait `;
    if (clusterCmd === 'acs') {
        createCmd = createCmd + `--agent-count ${options.agentSettings.count} --agent-vm-size "${options.agentSettings.vmSize}" -t Kubernetes`;
    } else {
        createCmd = createCmd + `--node-count ${options.agentSettings.count} --node-vm-size "${options.agentSettings.vmSize}"`;
    }

    const sr = await context.shell.exec(createCmd);

    return fromShellExitCodeOnly(sr, "Unable to call Azure CLI to create cluster");
}

export async function createCluster(context: Context, options: any): Promise<ActionResult<Diagnostic>> {
    const login = await setSubscriptionAsync(context, options.subscription);
    if (!login.succeeded) {
        return {
            actionDescription: 'logging into subscription',
            result: login
        };
    }

    const ensureResourceGroup = await ensureResourceGroupAsync(context, options.metadata.resourceGroupName, options.metadata.location);
    if (!ensureResourceGroup || !ensureResourceGroup.succeeded) {
        return {
            actionDescription: 'ensuring resource group exists',
            result: ensureResourceGroup
        };
    }

    const createCluster = await execCreateClusterCmd(context, options);

    return {
        actionDescription: 'creating cluster',
        result: createCluster
    };
}

export async function waitForCluster(context: Context, clusterType: string, clusterName: string, clusterResourceGroup: string): Promise<Errorable<WaitResult>> {
    const clusterCmd = getClusterCommand(clusterType);
    const waitCmd = `az ${clusterCmd} wait --created --interval 5 --timeout 10 -n ${clusterName} -g ${clusterResourceGroup} -o json`;
    const sr = await context.shell.exec(waitCmd);

    if (!sr) {
        return { succeeded: false, error: ["Unable to invoke Azure CLI"] };
    }

    if (sr.code === 0) {
        return { succeeded: true, result: { stillWaiting: sr.stdout !== "" } };
    } else {
        return { succeeded: false, error: [sr.stderr] };
    }
}

export async function configureCluster(context: Context, clusterType: string, clusterName: string, clusterGroup: string): Promise<ActionResult<ConfigureResult>> {
    const downloadKubectlCliPromise = downloadKubectlCli(context, clusterType);
    const getCredentialsPromise = getCredentials(context, clusterType, clusterName, clusterGroup, 5);

    const [cliResult, credsResult] = await Promise.all([downloadKubectlCliPromise, getCredentialsPromise]);

    const result = {
        clusterType: clusterType,
        gotCli: cliResult.succeeded,
        cliInstallFile: cliResult.installFile,
        cliOnDefaultPath: cliResult.onDefaultPath,
        cliError: cliResult.error,
        gotCredentials: credsResult.succeeded,
        credentialsError: credsResult.error
    };

    return {
        actionDescription: 'configuring Kubernetes',
        result: { succeeded: cliResult.succeeded && credsResult.succeeded, result: result, error: [] }  // TODO: this ends up not fitting our structure very well - fix?
    };
}

async function downloadKubectlCli(context: Context, clusterType: string): Promise<any> {
    const cliInfo = installKubectlCliInfo(context, clusterType);

    const sr = await context.shell.exec(cliInfo.commandLine);

    if (!sr) {
        return { succeeded: false, error: ["Unable to invoke Azure CLI"] };
    }

    if (sr.code === 0) {
        return {
            succeeded: true,
            installFile: cliInfo.installFile,
            onDefaultPath: !context.shell.isWindows()
        };
    } else {
        return {
            succeeded: false,
            error: sr.stderr
        };
    }
}

async function getCredentials(context: Context, clusterType: string, clusterName: string, clusterGroup: string, maxAttempts: number): Promise<any> {
    const config = getKubeconfigPath();
    const kubeconfigPath = config.isHostPath ? config.path : config.guestPath;
    const kubeconfigFileOption = kubeconfigPath ? `-f "${kubeconfigPath}"` : '';
    let attempts = 0;
    while (true) {
        attempts++;
        const cmd = `az ${getClusterCommandAndSubcommand(clusterType)} get-credentials -n ${clusterName} -g ${clusterGroup} ${kubeconfigFileOption}`;
        const sr = await context.shell.exec(cmd);

        if (sr && sr.code === 0 && !sr.stderr) {
            return {
                succeeded: true
            };
        } else if (attempts < maxAttempts) {
            await sleep(15000);
        } else {
            return {
                succeeded: false,
                error: sr ? sr.stderr : "Unable to invoke Azure CLI"
            };
        }
    }
}

function installKubectlCliInfo(context: Context, clusterType: string) {
    const cmdCore = `az ${getClusterCommandAndSubcommand(clusterType)} install-cli`;
    const isWindows = context.shell.isWindows();
    if (isWindows) {
        // The default Windows install location requires admin permissions; install
        // into a user profile directory instead. We process the path explicitly
        // instead of using %LOCALAPPDATA% in the command, so that we can render the
        // physical path when notifying the user.
        const appDataDir = process.env['LOCALAPPDATA'];
        const installDir = appDataDir + '\\kubectl';
        const installFile = installDir + '\\kubectl.exe';
        const cmd = `(if not exist "${installDir}" md "${installDir}") & ${cmdCore} --install-location="${installFile}"`;
        return { installFile: installFile, commandLine: cmd };
    } else {
        // Bah, the default Linux install location requires admin permissions too!
        // Fortunately, $HOME/bin is on the path albeit not created by default.
        const homeDir = process.env['HOME'];
        const installDir = homeDir + '/bin';
        const installFile = installDir + '/kubectl';
        const cmd = `mkdir -p "${installDir}" ; ${cmdCore} --install-location="${installFile}"`;
        return { installFile: installFile, commandLine: cmd };
    }
}

function getClusterCommand(clusterType: string): string {
    if (clusterType === 'Azure Container Service' || clusterType === 'acs') {
        return 'acs';
    }
    return 'aks';
}

function getClusterCommandAndSubcommand(clusterType: string): string {
    if (clusterType === 'Azure Container Service' || clusterType === 'acs') {
        return 'acs kubernetes';
    }
    return 'aks';
}
