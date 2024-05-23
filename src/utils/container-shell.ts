import { Kubectl } from "../kubectl";
import { ExecResult } from "../binutilplusplus";

async function isFileOnContainer(kubectl: Kubectl, podName: string, podNamespace: string | undefined, containerName: string | undefined, checkCommand: string): Promise<boolean> {
    const nsarg = podNamespace ? `--namespace ${podNamespace}` : '';
    const containerCommand = containerName ? `-c ${containerName}` : '';
    const result = await kubectl.invokeCommand(`exec ${podName} ${nsarg} ${containerCommand} -- ${checkCommand}`);
    return ExecResult.succeeded(result);
}

async function isBashOnContainer(kubectl: Kubectl, podName: string, podNamespace: string | undefined, containerName: string | undefined): Promise<boolean> {
    const checkCommand = 'ls -la /bin/bash';
    return isFileOnContainer(kubectl, podName, podNamespace, containerName, checkCommand);
}

async function isPowerShellOnContainer(kubectl: Kubectl, podName: string, podNamespace: string | undefined, containerName: string | undefined): Promise<boolean> {
    const checkCommand = 'cmd /C where powershell.exe';
    return isFileOnContainer(kubectl, podName, podNamespace, containerName, checkCommand);
}

export async function suggestedShellForContainer(kubectl: Kubectl, podName: string, podNamespace: string | undefined, containerName: string | undefined): Promise<string> {
    if (await isBashOnContainer(kubectl, podName, podNamespace, containerName)) {
        return 'bash';
    }
    if (await isPowerShellOnContainer(kubectl, podName, podNamespace, containerName)) {
        return 'powershell.exe';
    }
    return 'sh';
}
