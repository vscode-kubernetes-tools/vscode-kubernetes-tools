import { Kubectl } from "../kubectl";
import { ExecResult } from "../binutilplusplus";
import { containerExecArgs } from '../components/kubectl/pod-commands';

async function isBashOnContainer(kubectl: Kubectl, podName: string, podNamespace: string | undefined, containerName: string | undefined): Promise<boolean> {
    const result = await kubectl.invokeCommandArgs(containerExecArgs(podName, podNamespace, containerName, ['ls', '-la', '/bin/bash']));
    return ExecResult.succeeded(result);
}

export async function suggestedShellForContainer(kubectl: Kubectl, podName: string, podNamespace: string | undefined, containerName: string | undefined): Promise<string> {
    if (await isBashOnContainer(kubectl, podName, podNamespace, containerName)) {
        return 'bash';
    }
    return 'sh';
}
