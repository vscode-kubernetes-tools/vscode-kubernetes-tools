import * as vscode from 'vscode';

import { KubectlV1 } from "../../contract/kubectl/v1";
import { Kubectl } from "../../../kubectl";
import { ChildProcess } from 'child_process';
import { PortForwardStatusBarManager } from '../../../components/kubectl/port-forward-ui';

export function impl(kubectl: Kubectl, portForwardStatusBarManager: PortForwardStatusBarManager): KubectlV1 {
    return new KubectlV1Impl(kubectl, portForwardStatusBarManager);
}

class KubectlV1Impl implements KubectlV1 {
    constructor(private readonly kubectl: Kubectl, private readonly portForwardStatusBarManager: PortForwardStatusBarManager) {}

    invokeCommand(command: string): Promise<KubectlV1.ShellResult | undefined> {
        return this.kubectl.legacyInvokeAsync(command);
    }

    // TODO: move into core kubectl module
    // And/or convert to invokeBackground API and make portForward a wrapper over that
    async portForward(podName: string, podNamespace: string | undefined, localPort: number, remotePort: number, options: KubectlV1.PortForwardOptions): Promise<vscode.Disposable | undefined> {
        const nsarg = podNamespace ? ['--namespace', podNamespace] : [];
        const cmd = ['port-forward', podName, `${localPort}:${remotePort}`, ...nsarg];
        const pfProcess = await this.kubectl.legacySpawnAsChild(cmd, { title: `Kubectl: start port forwarding for ${podName} ... ` });
        if (!pfProcess) {
            return undefined;
        }

        const forwarding = await waitForOutput(pfProcess, /Forwarding\s+from\s+127\.0\.0\.1:/);

        if (forwarding === WaitForOutputResult.Success) {
            const onTerminate = [ () => pfProcess.kill() ];
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

enum WaitForOutputResult {
    Success = 1,
    ProcessExited = 2
}

function waitForOutput(process: ChildProcess, pattern: RegExp): Promise<WaitForOutputResult> {
    return new Promise<WaitForOutputResult>((resolve) => {
        let didOutput = false;

        process.stdout.on('data', async (data) => {
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
