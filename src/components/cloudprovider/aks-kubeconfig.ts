import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import { promises as nativeFs } from 'fs';
import * as yaml from 'js-yaml';
import { fs } from '../../fs';
import { shell } from '../../shell';
import { executeCommand } from '../../process';
import { getActiveKubeconfig, getUseWsl } from '../config/config';
import { getKubeconfigFiles, getKubeconfigPath, mergeToKubeconfigFile } from '../kubectl/kubeconfig';
import { resolveHostPathExecutable } from '../helm/executable';
import { resolveAzureCliExecutable } from '../clusterprovider/azure/azure-cli';

type LoginMode = 'azurecli' | 'interactive' | 'devicecode';
interface LoginChoice extends vscode.QuickPickItem { readonly mode: LoginMode; }
interface Selection { readonly rawPath: string; readonly file: string; readonly source: string; }
interface Destination { readonly file: string; readonly contents: string | null; }
interface DeviceCodeConfig {
    readonly config: Record<string, unknown>;
    readonly context: Record<string, unknown>;
    readonly user: Record<string, unknown>;
    readonly cluster: Record<string, unknown>;
}

class OnboardingError extends Error {}

function object(value: unknown): Record<string, unknown> | undefined {
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function parseConfig(text: string): Record<string, unknown> {
    try {
        const config = object(yaml.load(text));
        if (config) { return config; }
    } catch { /* Do not expose YAML snippets containing credentials. */ }
    throw new OnboardingError('The downloaded AKS kubeconfig is invalid. No configuration was saved.');
}

function loginMode(args: readonly string[]): string {
    let mode = 'devicecode';
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--login' || args[i] === '-l') {
            mode = args[++i] || '';
        } else if (args[i].startsWith('--login=') || args[i].startsWith('-l=')) {
            mode = args[i].slice(args[i].indexOf('=') + 1);
        }
    }
    return mode;
}

function deviceCodeConfig(text: string): DeviceCodeConfig | undefined {
    const config = parseConfig(text);
    const context = object(Array.isArray(config.contexts) ? config.contexts[0] : undefined);
    const user = object(Array.isArray(config.users) ? config.users[0] : undefined);
    const cluster = object(Array.isArray(config.clusters) ? config.clusters[0] : undefined);
    const references = object(context?.context);
    if (!context || typeof context.name !== 'string' || !context.name || !user || !cluster ||
        references?.user !== user.name || references?.cluster !== cluster.name) {
        throw new OnboardingError('The downloaded AKS context does not match its credentials. No configuration was saved.');
    }
    const exec = object(object(user?.user)?.exec);
    if (typeof exec?.command !== 'string' || !/^kubelogin(?:\.exe)?$/i.test(path.win32.basename(exec.command))) {
        return undefined;
    }
    if (!Array.isArray(exec.args) || !exec.args.every((arg): arg is string => typeof arg === 'string') || exec.args[0] !== 'get-token') {
        throw new OnboardingError('The AKS kubelogin configuration is not supported. No configuration was saved.');
    }
    const environmentMode = Array.isArray(exec.env) ? exec.env.map(object).find((entry) => entry?.name === 'AAD_LOGIN_METHOD')?.value : undefined;
    if ((typeof environmentMode === 'string' && environmentMode ? environmentMode : loginMode(exec.args)) !== 'devicecode') { return undefined; }
    return { config, context, user, cluster };
}

function selection(): Selection {
    if (getUseWsl()) {
        throw new OnboardingError('Open VS Code through Remote - WSL to merge AKS credentials into a WSL kubeconfig.');
    }
    const selected = getKubeconfigPath();
    if (selected.pathType !== 'host') { throw new OnboardingError('A local kubeconfig destination is required.'); }
    const file = getKubeconfigFiles(selected)[0];
    if (!file) { throw new OnboardingError('No kubeconfig destination was selected.'); }
    return {
        rawPath: selected.hostPath,
        file: path.resolve(file),
        source: getActiveKubeconfig() ? 'VS Code kubeconfig setting' : process.env.KUBECONFIG ? 'KUBECONFIG environment variable (first file)' : 'default home kubeconfig',
    };
}

function isCurrent(selected: Selection): boolean {
    if (getUseWsl()) { return false; }
    const current = getKubeconfigPath();
    return current.pathType === 'host' && current.hostPath === selected.rawPath &&
        path.resolve(getKubeconfigFiles(current)[0] || '') === selected.file;
}

async function destination(selected: Selection): Promise<Destination | undefined> {
    let file = selected.file;
    let source = selected.source;
    while (true) {
        const contents = await nativeFs.readFile(file, 'utf8').catch((error: NodeJS.ErrnoException) => {
            if (error.code === 'ENOENT') { return null; }
            throw error;
        });
        const choice = await vscode.window.showInformationMessage(`Merge AKS credentials into ${JSON.stringify(file)}?`, {
            modal: true,
            detail: `Selected by: ${source}. Existing entries will be merged, not replaced wholesale.`,
        }, 'Merge', 'Choose Another File');
        if (choice === 'Merge') { return { file, contents }; }
        if (choice !== 'Choose Another File') { return undefined; }
        const chosen = await vscode.window.showSaveDialog({ title: 'Choose kubeconfig destination', defaultUri: vscode.Uri.file(file), saveLabel: 'Choose kubeconfig' });
        if (!chosen) { return undefined; }
        if (chosen.scheme !== 'file') { throw new OnboardingError('The kubeconfig destination must be a local file.'); }
        file = chosen.fsPath;
        source = 'your choice for this import; active kubeconfig settings will not change automatically';
    }
}

function execEnvironment(original: unknown, converted: unknown, mode: LoginMode): unknown {
    if (!Array.isArray(original) && !Array.isArray(converted)) { return converted; }
    const entries = new Map<string, Record<string, unknown>>();
    for (const value of [...(Array.isArray(original) ? original : []), ...(Array.isArray(converted) ? converted : [])]) {
        const entry = object(value);
        if (!entry || typeof entry.name !== 'string' || typeof entry.value !== 'string') {
            throw new OnboardingError('The AKS authentication environment is invalid. No configuration was saved.');
        }
        entries.set(entry.name, entry.name === 'AAD_LOGIN_METHOD' ? { ...entry, value: mode } : entry);
    }
    return [...entries.values()];
}

async function convertConfig(input: DeviceCodeConfig, mode: LoginMode): Promise<string> {
    const environment = { ...process.env };
    const roots = vscode.workspace.workspaceFolders?.map((folder) => folder.uri.fsPath) || [];
    const executable = resolveHostPathExecutable(shell, 'kubelogin', environment, roots);
    if (!executable) { throw new OnboardingError('Install kubelogin on your PATH, then add the cluster again. No configuration was saved.'); }
    if (mode === 'azurecli' && !await resolveAzureCliExecutable({ fs, shell }, vscode.workspace.rootPath, environment)) {
        throw new OnboardingError('Install Azure CLI and run az login for the cluster tenant, or choose Web Browser. No configuration was saved.');
    }
    if (getUseWsl()) { throw new OnboardingError('The Kubernetes execution environment changed. Add the cluster again.'); }
    const directory = await nativeFs.mkdtemp(path.join(os.tmpdir(), 'vscode-aks-login-'));
    try {
        const file = path.join(directory, 'config');
        await nativeFs.writeFile(file, yaml.dump({
            apiVersion: 'v1', kind: 'Config', clusters: [input.cluster], users: [input.user],
            contexts: [input.context], 'current-context': input.context.name,
        }), { mode: 0o600 });
        const result = await executeCommand({
            executable: executable.path, ...(executable.argv0 ? { argv0: executable.argv0 } : {}),
            args: ['convert-kubeconfig', '--kubeconfig', file, '--context', input.context.name as string, '--login', mode, '--disable-environment-override'],
            cwd: directory, env: { ...environment, KUBECONFIG: file },
        });
        if (result.code !== 0) { throw new OnboardingError('kubelogin could not prepare the selected login method. Check your kubelogin version and try again. No configuration was saved.'); }
        const converted = parseConfig(await nativeFs.readFile(file, 'utf8'));
        const convertedUser = object(Array.isArray(converted.users) ? converted.users.find((entry) => object(entry)?.name === input.user.name) : undefined);
        const exec = object(object(convertedUser?.user)?.exec);
        if (!exec || typeof exec.command !== 'string' || !/^kubelogin(?:\.exe)?$/i.test(path.win32.basename(exec.command)) ||
            !Array.isArray(exec.args) || !exec.args.every((arg): arg is string => typeof arg === 'string') || loginMode(exec.args) !== mode) {
            throw new OnboardingError('kubelogin did not prepare the selected login method. No configuration was saved.');
        }
        const user = object(input.user.user)!;
        const originalExec = object(user.exec)!;
        input.user.user = { ...user, exec: { ...originalExec, ...exec, env: execEnvironment(originalExec.env, exec.env, mode) } };
        return yaml.dump(input.config);
    } finally {
        await nativeFs.rm(directory, { recursive: true, force: true });
    }
}

// Returns a path only when the user explicitly requests an active-file change after saving.
export async function importAksKubeconfig(text: string): Promise<string | undefined> {
    try {
        const selected = selection();
        const input = deviceCodeConfig(text);
        let mode: LoginMode | undefined;
        if (input) {
            const choices: LoginChoice[] = [
                { label: 'Azure CLI', description: 'Use an existing az login session for the cluster tenant, not the VS Code sign-in', mode: 'azurecli' },
                { label: 'Web Browser', description: 'Interactive sign-in, subject to your tenant policies', mode: 'interactive' },
                { label: 'Device Code', description: 'Keep device-code login only if your tenant permits it', mode: 'devicecode' },
            ];
            mode = (await vscode.window.showQuickPick(choices, { title: 'Choose AKS authentication', placeHolder: 'Device-code login may be blocked by Conditional Access.', ignoreFocusOut: true }))?.mode;
            if (!mode) { return undefined; }
        }
        const chosen = await destination(selected);
        if (!chosen) { return undefined; }
        const { file, contents } = chosen;
        if (!isCurrent(selected)) { throw new OnboardingError('The kubeconfig selection changed. Add the cluster again to confirm the destination.'); }
        const prepared = input && mode && mode !== 'devicecode' ? await convertConfig(input, mode) : text;
        if (!await mergeToKubeconfigFile(prepared, file, { isCurrent: () => isCurrent(selected), expectedContents: contents, notify: false })) { return undefined; }
        const message = `AKS configuration saved to ${JSON.stringify(file)}${mode ? ` (${mode} login)` : ''}.`;
        if (path.resolve(file) !== selected.file) {
            const activate = await vscode.window.showInformationMessage(`${message} This file is not active.`, 'Set as Active Kubeconfig');
            return activate === 'Set as Active Kubeconfig' ? file : undefined;
        }
        vscode.window.showInformationMessage(message);
    } catch (error) {
        vscode.window.showErrorMessage(error instanceof OnboardingError ? error.message : 'Unable to import the AKS kubeconfig. Check the destination and its .vscode-k8s-tools-backup file.');
    }
    return undefined;
}
