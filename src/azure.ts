'use strict';

import { Shell } from './shell';
import { FS } from './fs';
import { Errorable, StageData } from './wizard';
import * as compareVersions from 'compare-versions';

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

const MIN_AZ_CLI_VERSION = '2.0.23';

export async function getSubscriptionList(context: Context, forCommand: string) : Promise<StageData> {
    // check for prerequisites
    const prerequisiteErrors = await verifyPrerequisitesAsync(context, forCommand);
    if (prerequisiteErrors.length > 0) {
        return {
            actionDescription: 'checking prerequisites',
            result: { succeeded: false, result: false, error: prerequisiteErrors }
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
