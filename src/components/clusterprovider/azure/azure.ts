'use strict';

import { mkdir } from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';
import { monitorForAuthPrompt, Shell, ShellResult } from '../../../shell';
import { FS } from '../../../fs';
import { ActionResult, fromShellJson, fromShellExitCodeAndStandardError, fromShellExitCodeOnly, Diagnostic } from '../../../wizard';
import { Errorable, failed } from '../../../errorable';
import { compareVersions } from 'compare-versions';
import { sleep } from '../../../sleep';
import { getKubeconfigPath } from '../../kubectl/kubeconfig';
import { Dictionary } from '../../../utils/dictionary';
import { executeCommand } from '../../../process';
import { getUseWsl } from '../../config/config';

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

async function executeAz(context: Context, args: readonly string[]): Promise<ShellResult | undefined> {
    const { cwd, env } = context.shell.execOpts();
    try {
        let invocation = getUseWsl() ? {
            executable: 'wsl.exe',
            args: ['--exec', 'az', ...args],
        } : {
            executable: context.shell.which('az') || 'az',
            args,
        };
        if (context.shell.isWindows() && /\.(?:cmd|bat)$/i.test(invocation.executable)) {
            const python = path.resolve(path.dirname(invocation.executable), '..', 'python.exe');
            if (!context.fs.existsSync(python)) {
                throw new Error('The Azure CLI command wrapper is not supported without its bundled Python executable.');
            }
            invocation = { executable: python, args: ['-Im', 'azure.cli', ...args] };
        }
        return await executeCommand({
            ...invocation,
            cwd,
            env,
        }, undefined, monitorForAuthPrompt);
    } catch (ex) {
        vscode.window.showErrorMessage(String(ex));
        return undefined;
    }
}

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
    const sr = await executeAz(context, ['--version']);
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
    const sr = await executeAz(context, ['account', 'list', '--all', '--query', '[*].name', '-o', 'json']);

    return fromShellJson<string[]>(sr, "Unable to list Azure subscriptions");
}

export async function setSubscriptionAsync(context: Context, subscription: string): Promise<Errorable<Diagnostic>> {
    const sr = await executeAz(context, ['account', 'set', '--subscription', subscription]);

    return fromShellExitCodeAndStandardError(sr, "Unable to set Azure CLI subscription");
}

// removed clusterType since it is NOT required after removing Azure Container Service option
export async function getClusterList(context: Context, subscription: string): Promise<ActionResult<ClusterInfo[]>> {
    // log in
    const login = await setSubscriptionAsync(context, subscription);
    if (failed(login)) {
        return {
            actionDescription: 'logging into subscription',
            result: { succeeded: false, error: login.error }
        };
    }

    // list clusters
    const clusters = await listClustersAsync(context);
    return {
        actionDescription: 'listing clusters',
        result: clusters
    };
}

async function listClustersAsync(context: Context): Promise<Errorable<ClusterInfo[]>> {
    const query = '[].{name:name,resourceGroup:resourceGroup}';
    const sr = await executeAz(context, [getClusterCommand(), 'list', '--query', query, '-o', 'json']);

    return fromShellJson<ClusterInfo[]>(sr, "Unable to list Kubernetes clusters");
}

async function listLocations(context: Context): Promise<Errorable<Locations>> {
    const query = "[].{name:name,displayName:displayName}";
    const sr = await executeAz(context, ['account', 'list-locations', '--query', query, '-o', 'json']);

    return fromShellJson<Locations>(sr, "Unable to list Azure regions", (response) => {
        const locations = Dictionary.of<string>();
        for (const r of response) {
            locations[r.name] = r.displayName;
        }
        return { locations: locations };
    });
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
    let result = locationDisplayNames(production, false, locationInfo);
    result = result.concat(locationDisplayNames(preview, true, locationInfo));
    return result;
}

export async function listVMSizes(context: Context, location: string): Promise<Errorable<string[]>> {
    const sr = await executeAz(context, ['vm', 'list-sizes', '-l', location, '-o', 'json']);

    return fromShellJson<string[]>(sr,
        "Unable to list Azure VM sizes",
        (response: any[]) => response.map((r) => r.name as string)
            .filter((name) => !name.startsWith('Basic_'))
    );
}

async function resourceGroupExists(context: Context, resourceGroupName: string): Promise<boolean> {
    const sr = await executeAz(context, ['group', 'show', '-n', resourceGroupName, '-o', 'json']);

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

    const sr = await executeAz(context, ['group', 'create', '-n', resourceGroupName, '-l', location]);

    return fromShellExitCodeAndStandardError(sr, "Unable to check if resource group exists");
}

async function execCreateClusterCmd(context: Context, options: any): Promise<Errorable<Diagnostic>> {
    const clusterCmd = getClusterCommand();
    const sr = await executeAz(context, [
        clusterCmd,
        'create',
        '-n',
        options.metadata.clusterName,
        '-g',
        options.metadata.resourceGroupName,
        '-l',
        options.metadata.location,
        '--generate-ssh-keys',
        '--no-wait',
        '--node-count',
        String(options.agentSettings.count),
        '--node-vm-size',
        options.agentSettings.vmSize,
    ]);

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

// removed clusterType since it is NOT required after removing Azure Container Service option
export async function waitForCluster(context: Context, clusterName: string, clusterResourceGroup: string): Promise<Errorable<WaitResult>> {
    const clusterCmd = getClusterCommand();
    const sr = await executeAz(context, [
        clusterCmd,
        'wait',
        '--created',
        '--interval',
        '5',
        '--timeout',
        '10',
        '-n',
        clusterName,
        '-g',
        clusterResourceGroup,
        '-o',
        'json',
    ]);

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
    const downloadKubectlCliPromise = downloadKubectlCli(context);
    const getCredentialsPromise = getCredentials(context, clusterName, clusterGroup, 5);

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

async function downloadKubectlCli(context: Context): Promise<any> {
    const cliInfo = installKubectlCliInfo(context);

    try {
        if (!getUseWsl()) {
            await mkdir(cliInfo.installDir, { recursive: true });
        } else {
            const { cwd, env } = context.shell.execOpts();
            const result = await executeCommand({
                executable: 'wsl.exe',
                args: ['--exec', 'mkdir', '-p', '--', cliInfo.installDir],
                cwd,
                env,
            });
            if (result.code !== 0) {
                throw new Error(result.stderr);
            }
        }
    } catch (ex) {
        return {
            succeeded: false,
            error: String(ex)
        };
    }

    const sr = await executeAz(context, [
        getClusterCommandAndSubcommand(),
        'install-cli',
        '--install-location',
        cliInfo.installFile,
    ]);

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

async function getCredentials(context: Context, clusterName: string, clusterGroup: string, maxAttempts: number): Promise<any> {
    const kubeconfigPath = getKubeconfigPath();
    const fullPath = kubeconfigPath.pathType === "host" ? kubeconfigPath.hostPath : kubeconfigPath.wslPath;
    // For multi-path KUBECONFIG, split and use the first path to write new credentials
    const pathDelimiter = kubeconfigPath.pathType === 'wsl' ? ':' : path.delimiter;
    const kubeconfigFilePath = fullPath ? fullPath.split(pathDelimiter)[0] : undefined;
    const args = [getClusterCommandAndSubcommand(), 'get-credentials', '-n', clusterName, '-g', clusterGroup];
    if (kubeconfigFilePath) {
        args.push('-f', kubeconfigFilePath);
    }
    let attempts = 0;
    while (true) {
        attempts++;
        const sr = await executeAz(context, args);

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

function installKubectlCliInfo(context: Context) {
    const isWindows = context.shell.isWindows();
    if (isWindows) {
        // The default Windows install location requires admin permissions; install
        // into a user profile directory instead. We process the path explicitly
        // instead of using %LOCALAPPDATA% in the command, so that we can render the
        // physical path when notifying the user.
        const appDataDir = process.env['LOCALAPPDATA'];
        const installDir = appDataDir + '\\kubectl';
        const installFile = installDir + '\\kubectl.exe';
        return { installDir: installDir, installFile: installFile };
    } else {
        // Bah, the default Linux install location requires admin permissions too!
        // Fortunately, $HOME/bin is on the path albeit not created by default.
        const homeDir = context.shell.home();
        const installDir = homeDir + '/bin';
        const installFile = installDir + '/kubectl';
        return { installDir: installDir, installFile: installFile };
    }
}

function getClusterCommand(): string {
    return 'aks';
}

function getClusterCommandAndSubcommand(): string {
    return 'aks';
}
