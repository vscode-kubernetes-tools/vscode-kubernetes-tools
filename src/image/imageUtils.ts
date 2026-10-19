import * as path from "path";
import * as vscode from "vscode";

import { assertValidContainerImageReference, getCurrentBuildTool } from './imageToolRegistry';
import { kubeChannel } from "../kubeChannel";
import { monitorForAuthPrompt, shell } from "../shell";
import { CommandInvocation, executeCommand } from '../process';
import { getUseWsl } from '../components/config/config';

/**
 * Build the container image first. If imagePrefix is not empty, push the image to remote image registry, too.
 *
 * @param shellOpts process options such as cwd and env.
 * @param imagePrefix the image prefix for container images (e.g. 'docker.io/brendanburns').
 * @return the image name.
 */
export async function buildAndPushImage(shellOpts: any, imagePrefix?: string): Promise<string> {
    const cwd = shellOpts.cwd || vscode.workspace.rootPath;
    const image = await getDefaultImageName(cwd, imagePrefix);
    await buildImage(image, shellOpts);
    if (imagePrefix) {
        await pushImage(image, shellOpts);
    }
    return image;
}

/**
 * Returns a promise that resolves to an invocation for building the given image.
 * Rejects if it couldn't get an invocation.
 */
export async function getBuildCommand(image: string): Promise<CommandInvocation> {
    assertValidContainerImageReference(image);
    const tool = await getCurrentBuildTool();
    return tool.getBuildCommand(image);
}

/**
 * Returns a promise that resolves to an invocation for pushing the given image.
 * Rejects if it couldn't get an invocation.
 */
export async function getPushCommand(image: string): Promise<CommandInvocation> {
    assertValidContainerImageReference(image);
    const tool = await getCurrentBuildTool();
    return tool.getPushCommand(image);
}

function sanitiseTag(name: string) {
    // Name components may contain lowercase letters, digits and separators.
    // A separator is defined as a period, one or two underscores, or one or
    // more dashes. A name component may not start or end with a separator.
    // https://docs.docker.com/engine/reference/commandline/tag/#extended-description

    return name.toLowerCase().replace(/[^a-z0-9._-]/g, '-');
}

async function getDefaultImageName(cwd: string, imagePrefix?: string): Promise<string> {
    const name = sanitiseTag(path.basename(cwd));
    const version = await findVersion(cwd);
    let image = `${name}:${version}`;
    if (imagePrefix) {
        image = `${imagePrefix}/${image}`;
    }
    return image;
}

async function findVersion(cwd: string): Promise<string> {
    const { env } = shell.execOpts();
    const args = ['describe', '--always', '--dirty'];
    const invocation: CommandInvocation = getUseWsl() ?
        { executable: 'wsl.exe', args: ['--exec', 'git', ...args], cwd, env } :
        { executable: 'git', args, cwd, env };
    try {
        const result = await executeCommand(invocation, undefined, monitorForAuthPrompt);
        return result.code === 0 ? result.stdout.trim() : "latest";
    } catch (_err) {
        return "latest";
    }
}

async function buildImage(image: string, shellOpts: any): Promise<void> {
    const buildCommand = await getBuildCommand(image);
    const result = await executeCommand({
        ...buildCommand,
        cwd: shellOpts.cwd,
        env: shellOpts.env,
    }, undefined, monitorForAuthPrompt);
    if (result.code !== 0) {
        throw new Error(`Image build failed: ${result.stderr}`);
    }
    kubeChannel.showOutput(image + ' built.');
}

async function pushImage(image: string, shellOpts: any): Promise<void> {
    const pushCommand = await getPushCommand(image);
    const result = await executeCommand({
        ...pushCommand,
        cwd: shellOpts.cwd,
        env: shellOpts.env,
    }, undefined, monitorForAuthPrompt);
    if (result.code !== 0) {
        throw new Error(`Image push failed: ${result.stderr}`);
    }
    kubeChannel.showOutput(image + ' pushed.');
}
