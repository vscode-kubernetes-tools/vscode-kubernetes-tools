import * as path from 'path';
import * as vscode from 'vscode';
import * as nativeFs from 'fs';
import { Git } from '../components/git/git';
import { kubeChannel } from '../kubeChannel';
import { shell } from '../shell';
import { ContainerImageBuildTool, getCurrentBuildTool, ImageToolExecutionOptions } from './imageToolRegistry';
import { isValidImageTag, requireTaggedImageReference, sanitiseRepositoryComponent } from './imageReference';

const git = new Git(shell);

export async function buildAndPushImage(options: ImageToolExecutionOptions, imagePrefix?: string): Promise<string> {
    if (!vscode.workspace.isTrusted) {
        throw new Error('Container image builds are disabled in untrusted workspaces.');
    }
    const cwd = options.cwd || shell.execOpts().cwd;
    if (!cwd || !path.isAbsolute(cwd)) {
        throw new Error('Image builds require an absolute working directory.');
    }
    const image = await getDefaultImageName(cwd, imagePrefix);
    const tool = await getCurrentBuildTool(options);
    await buildImage(tool, image);
    if (imagePrefix) {
        await pushImage(tool, image);
    }
    return image;
}

export async function getDefaultImageName(cwd: string, imagePrefix?: string): Promise<string> {
    if (!vscode.workspace.isTrusted) {
        throw new Error('Container image builds are disabled in untrusted workspaces.');
    }
    const name = sanitiseRepositoryComponent(path.basename(cwd));
    const version = await findVersion(cwd);
    const image = imagePrefix ? `${imagePrefix}/${name}:${version}` : `${name}:${version}`;
    return requireTaggedImageReference(image).value;
}

export async function findVersion(cwd: string): Promise<string> {
    const result = await git.describe(cwd);
    const version = result?.code === 0 ? result.stdout.trim() : '';
    if (isValidImageTag(version)) {
        return version;
    }
    if (hasGitDirectory(cwd)) {
        throw new Error(result?.stderr.trim() || 'Unable to determine a valid Git revision for the image tag.');
    }
    return 'latest';
}

function hasGitDirectory(cwd: string): boolean {
    let current = path.resolve(cwd);
    while (true) {
        if (nativeFs.existsSync(path.join(current, '.git'))) {
            return true;
        }
        const parent = path.dirname(current);
        if (parent === current) {
            return false;
        }
        current = parent;
    }
}

export async function buildImage(tool: ContainerImageBuildTool, image: string): Promise<void> {
    const result = await tool.execute(tool.buildArgs(image));
    if (result.code !== 0) {
        throw new Error(`Image build failed: ${result.stderr}`);
    }
    kubeChannel.showOutput(`${image} built.`);
}

export async function pushImage(tool: ContainerImageBuildTool, image: string): Promise<void> {
    const result = await tool.execute(tool.pushArgs(image));
    if (result.code !== 0) {
        throw new Error(`Image push failed: ${result.stderr}`);
    }
    kubeChannel.showOutput(`${image} pushed.`);
}
