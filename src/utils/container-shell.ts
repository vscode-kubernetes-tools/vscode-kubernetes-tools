import { Kubectl } from "../kubectl";
import { ExecResult } from "../binutilplusplus";

async function isBashOnContainer(kubectl: Kubectl, podName: string, podNamespace: string | undefined, containerName: string | undefined): Promise<boolean> {
    const args = ['exec', podName];
    if (podNamespace) {
        args.push('--namespace', podNamespace);
    }
    if (containerName) {
        args.push('-c', containerName);
    }
    args.push('--', 'ls', '-la', '/bin/bash');
    const result = await kubectl.invokeCommand(args);
    return ExecResult.succeeded(result);
}

export async function suggestedShellForContainer(kubectl: Kubectl, podName: string, podNamespace: string | undefined, containerName: string | undefined): Promise<string> {
    if (await isBashOnContainer(kubectl, podName, podNamespace, containerName)) {
        return 'bash';
    }
    return 'sh';
}
