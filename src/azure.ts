'use strict';

import { Shell } from './shell';
import { FS } from './fs';
import { Errorable, ActionResult } from './wizard';
import * as compareVersions from 'compare-versions';
import { sleep } from './sleep';

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

export interface ConfigureResult {
    readonly gotCli: boolean;
    readonly cliInstallFile: string;
    readonly cliOnDefaultPath: boolean;
    readonly cliError: string;
    readonly gotCredentials: boolean;
    readonly credentialsError: string;
}

const MIN_AZ_CLI_VERSION = '2.0.23';

export async function getSubscriptionList(context: Context, forCommand: string) : Promise<ActionResult<string[]>> {
    // check for prerequisites
    const prerequisiteErrors = await verifyPrerequisitesAsync(context, forCommand);
    if (prerequisiteErrors.length > 0) {
        return {
            actionDescription: 'checking prerequisites',
            result: { succeeded: false, result: [], error: prerequisiteErrors }
        };
    }

    // list subs
    const subscriptions = await listSubscriptionsAsync(context);
    return {
        actionDescription: 'listing subscriptions',
        result: subscriptions
    };
}

async function verifyPrerequisitesAsync(context: Context, forCommand: string) : Promise<string[]> {
    const errors = new Array<string>();
    
    const azVersion = await azureCliVersion(context);
    if (azVersion === null) {
        errors.push('Azure CLI 2.0 not found - install Azure CLI 2.0 and log in');
    } else if (compareVersions(azVersion, MIN_AZ_CLI_VERSION) < 0) {
        errors.push(`Azure CLI required version is ${MIN_AZ_CLI_VERSION} (you have ${azVersion}) - you need to upgrade Azure CLI 2.0`);
    }

    if (forCommand == 'acs') {
        prereqCheckSSHKeys(context, errors);
    }

    return errors;
}

async function azureCliVersion(context: Context) : Promise<string> {
    const sr = await context.shell.exec('az --version');
    if (sr.code !== 0 || sr.stderr) {
        return null;
    } else {
        const versionMatches = /azure-cli \(([^)]+)\)/.exec(sr.stdout);
        if (versionMatches === null || versionMatches.length < 2) {
            return null;
        }
        return versionMatches[1];
    }
}

function prereqCheckSSHKeys(context: Context, errors: Array<String>) {
    const sshKeyFile = context.shell.combinePath(context.shell.home(), '.ssh/id_rsa');
    if (!context.fs.existsSync(sshKeyFile)) {
        errors.push('SSH keys not found - expected key file at ' + sshKeyFile);
    }
}

async function listSubscriptionsAsync(context: Context) : Promise<Errorable<string[]>> {
    const sr = await context.shell.exec("az account list --all --query [*].name -ojson");
    
    if (sr.code === 0 && !sr.stderr) {  // az account list returns exit code 0 even if not logged in
        const accountNames : string[] = JSON.parse(sr.stdout);
        return { succeeded: true, result: accountNames, error: [] };
    } else {
        return { succeeded: false, result: [], error: [sr.stderr] };
    }
}

export async function setSubscriptionAsync(context: Context, subscription: string) : Promise<Errorable<void>> {
    const sr = await context.shell.exec(`az account set --subscription "${subscription}"`);

    if (sr.code === 0 && !sr.stderr) {
        return { succeeded: true, result: null, error: [] };
    } else {
        return { succeeded: false, result: null, error: [sr.stderr] };
    }
}

export async function configureCluster(context: Context, clusterType: string, clusterName: string, clusterGroup: string) : Promise<ActionResult<ConfigureResult>> {
    const downloadKubectlCliPromise = downloadKubectlCli(context, clusterType);
    const getCredentialsPromise = getCredentials(context, clusterType, clusterName, clusterGroup, 5);

    const [cliResult, credsResult] = await Promise.all([downloadKubectlCliPromise, getCredentialsPromise]);

    const result = {
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

async function downloadKubectlCli(context: Context, clusterType: string) : Promise<any> {
    const cliInfo = installKubectlCliInfo(context, clusterType);

    const sr = await context.shell.exec(cliInfo.commandLine);
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

async function getCredentials(context: Context, clusterType: string, clusterName: string, clusterGroup: string, maxAttempts: number) : Promise<any> {
    let attempts = 0;
    while (true) {
        attempts++;
        const cmd = `az ${getClusterCommandAndSubcommand(clusterType)} get-credentials -n ${clusterName} -g ${clusterGroup}`;
        const sr = await context.shell.exec(cmd);

        if (sr.code === 0 && !sr.stderr) {
            return {
                succeeded: true
            };
        } else if (attempts < maxAttempts) {
            await sleep(15000);
        } else {
            return {
                succeeded: false,
                error: sr.stderr
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

export function getClusterCommand(clusterType: string) : string {
    if (clusterType == 'Azure Container Service' || clusterType == 'acs') {
        return 'acs';
    }
    return 'aks';
}

export function getClusterCommandAndSubcommand(clusterType: string) : string {
    if (clusterType == 'Azure Container Service' || clusterType == 'acs') {
        return 'acs kubernetes';
    }
    return 'aks';
}
