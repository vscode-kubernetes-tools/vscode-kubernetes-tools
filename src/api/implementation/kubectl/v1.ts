import * as vscode from 'vscode';

import { KubectlV1 } from "../../contract/kubectl/v1";
import { Kubectl } from "../../../kubectl";
import type { ChildProcess } from '../../../process';
import { PortForwardStatusBarManager } from '../../../components/kubectl/port-forward-ui';
import { ExecResult } from '../../../binutilplusplus';
import { parseCommandLine } from '../../../utils/command-line';
import { isValidKubernetesResourceName, isValidNamespaceName } from '../../../utils/kubernetes-identifiers';

export function impl(kubectl: Kubectl, portForwardStatusBarManager: PortForwardStatusBarManager): KubectlV1 {
    return new KubectlV1Impl(kubectl, portForwardStatusBarManager);
}

export function invokeCommandArgs(kubectl: Kubectl, command: string): Promise<KubectlV1.ShellResult | undefined> {
    return new KubectlV1Impl(kubectl, {} as PortForwardStatusBarManager).invokeCommand(command);
}

class KubectlV1Impl implements KubectlV1 {
    constructor(private readonly kubectl: Kubectl, private readonly portForwardStatusBarManager: PortForwardStatusBarManager) {}

    async invokeCommand(command: string): Promise<KubectlV1.ShellResult | undefined> {
        const parsed = parseCommandLine(command);
        if (!parsed.succeeded) {
            return { code: -1, stdout: '', stderr: parsed.error };
        }
        const result = await this.kubectl.invokeCommand(parsed.args);
        if (result.resultKind === 'exec-bin-not-found' || result.resultKind === 'exec-failed') {
            return undefined;
        }
        if (ExecResult.succeeded(result)) {
            return { code: 0, stdout: result.stdout, stderr: '' };
        }
        return { code: result.code, stdout: '', stderr: result.stderr };
    }

    // TODO: move into core kubectl module
    // And/or convert to invokeBackground API and make portForward a wrapper over that
    async portForward(podName: string, podNamespace: string | undefined, localPort: number, remotePort: number, options: KubectlV1.PortForwardOptions): Promise<vscode.Disposable | undefined> {
        if (!isValidKubernetesResourceName(podName) ||
            (podNamespace !== undefined && !isValidNamespaceName(podNamespace)) ||
            !isValidPort(localPort) ||
            !isValidPort(remotePort)) {
            return undefined;
        }
        const nsarg = podNamespace ? ['--namespace', podNamespace] : [];
        const cmd = ['port-forward', podName, `${localPort}:${remotePort}`, ...nsarg];
        const result = await this.kubectl.spawnCommand(cmd);
        if (result.resultKind !== 'exec-child-process-started') {
            return undefined;
        }
        const pfProcess = result.childProcess;

        const forwarding = await waitForOutput(pfProcess, /Forwarding\s+from\s+127\.0\.0\.1:/);

        if (forwarding === WaitForOutputResult.Success) {
            const onTerminate: (() => (void | boolean))[] = [ () => pfProcess.kill() ];
            const terminator = { dispose: () => { for (const action of onTerminate) { action(); } } };
            if (options && options.showInUI && options.showInUI.location === 'status-bar') {
                const session = {
                    podName,
                    podNamespace,
                    localPort,
                    remotePort,
                    terminator: terminator,
                    description: options.showInUI.description,
                    onCancel: options.showInUI.onCancel
                };
                const cookie = this.portForwardStatusBarManager.registerPortForward(session);
                const removeFromUI = () => this.portForwardStatusBarManager.unregisterPortForward(cookie);
                onTerminate.push(removeFromUI);
            }
            return vscode.Disposable.from(terminator);
        }

        return undefined;
    }
}

function isValidPort(port: number): boolean {
    return Number.isInteger(port) && port >= 1 && port <= 65535;
}

enum WaitForOutputResult {
    Success = 1,
    ProcessExited = 2
}

function waitForOutput(process: ChildProcess, pattern: RegExp): Promise<WaitForOutputResult> {
    return new Promise<WaitForOutputResult>((resolve) => {
        let didOutput = false;

        process.stdout?.on('data', async (data) => {
            const message = `${data}`;
            if (pattern.test(message)) {
                didOutput = true;
                resolve(WaitForOutputResult.Success);
            }
        });

        process.on('close', async (_code) => {
            if (!didOutput) {
                resolve(WaitForOutputResult.ProcessExited);
            }
        });
    });
}
