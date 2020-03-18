import { Kubectl } from "../kubectl";
import { ExecResult } from "../binutilplusplus";

async function isBashOnContainer(kubectl: Kubectl, podName: string, podNamespace: string | undefined, containerName: string | undefined): Promise<boolean> {
    const nsarg = podNamespace ? `--namespace ${podNamespace}` : '';
    const containerCommand = containerName ? `-c ${containerName}` : '';
    const result = await kubectl.invokeCommand(`exec ${podName} ${nsarg} ${containerCommand} -- ls -la /bin/bash`);
    return ExecResult.succeeded(result);
}

export async function suggestedShellForContainer(kubectl: Kubectl, podName: string, podNamespace: string | undefined, containerName: string | undefined): Promise<string> {
    if (await isBashOnContainer(kubectl, podName, podNamespace, containerName)) {
        return 'bash';
    }
    return 'sh';
}
