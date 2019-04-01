import * as vscode from 'vscode';

import { KubectlV1 } from "../../contract/kubectl/v1";
import { Kubectl } from "../../../kubectl";
import { ChildProcess } from 'child_process';

export function impl(kubectl: Kubectl): KubectlV1 {
    return new KubectlV1Impl(kubectl);
}

class KubectlV1Impl implements KubectlV1 {
    constructor(private readonly kubectl: Kubectl) {}

    invokeCommand(command: string): Promise<KubectlV1.ShellResult | undefined> {
        return this.kubectl.invokeAsync(command);
    }

    // TODO: move into core kubectl module
    // And/or convert to invokeBackground API and make portForward a wrapper over that
    async portForward(podName: string, podNamespace: string | undefined, localPort: number, remotePort: number): Promise<vscode.Disposable | undefined> {
        const nsarg = podNamespace ? ['--namespace', podNamespace] : [];
        const cmd = ['port-forward', podName, `${localPort}:${remotePort}`, ...nsarg];
        const pfProcess = await this.kubectl.spawnAsChild(cmd);
        if (!pfProcess) {
            return undefined;
        }

        const forwarding = await waitForOutput(pfProcess, /Forwarding\s+from\s+127\.0\.0\.1:/);

        if (forwarding === WaitForOutputResult.Success) {
            const onDispose = () => { pfProcess.kill(); };
            return vscode.Disposable.from({ dispose: onDispose });
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
