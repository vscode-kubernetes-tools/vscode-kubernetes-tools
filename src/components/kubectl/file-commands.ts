import { ExecResult } from '../../binutilplusplus';
import { Kubectl } from '../../kubectl';
import { LongRunningUIOptions } from '../../host';
import { executeCommand } from '../../process';

type FileCommand = 'create' | 'apply' | 'delete';

export function fileCommandArgs(command: FileCommand, filePath: string, namespace?: string): string[] {
    return [command, ...(namespace ? ['--namespace', namespace] : []), '-f', filePath];
}

export function replaceFromStdinArgs(namespace: string): string[] {
    return ['replace', '-f', '-', '--namespace', namespace];
}

export type CommandExecutor = typeof executeCommand;

export async function hostPathToWsl(filePath: string, execute: CommandExecutor = executeCommand): Promise<string> {
    if (!/^(?:[A-Za-z]:[\\/]|\\\\)/.test(filePath)) {
        return filePath;
    }
    const result = await execute({
        executable: 'wsl.exe',
        args: wslPathArgs(filePath),
    });
    if (result.code !== 0 || !result.stdout.trim()) {
        throw new Error('Unable to convert the Windows path for WSL.');
    }
    return result.stdout.trim();
}

export function wslPathArgs(filePath: string): string[] {
    return ['--exec', 'wslpath', '-a', '-u', filePath];
}

export function getResourceFileDataArgs(resourceType: string, resourceName: string, namespace: string): string[] {
    return ['get', resourceType, resourceName, '--namespace', namespace, '-o', 'json'];
}

export async function invokeFileCommandWithFeedback(
    kubectl: Kubectl,
    command: FileCommand,
    filePath: string,
    namespace: string | undefined,
    uiOptions: string | LongRunningUIOptions
): Promise<ExecResult> {
    return kubectl.invokeCommandArgsWithFeedback(fileCommandArgs(command, filePath, namespace), uiOptions);
}

export async function replaceFromStdin(kubectl: Kubectl, namespace: string, content: string): Promise<ExecResult> {
    return kubectl.invokeCommandArgs(replaceFromStdinArgs(namespace), content);
}

export async function getResourceFileData(kubectl: Kubectl, resourceType: string, resourceName: string, namespace: string): Promise<ExecResult> {
    return kubectl.invokeCommandArgs(getResourceFileDataArgs(resourceType, resourceName, namespace));
}
