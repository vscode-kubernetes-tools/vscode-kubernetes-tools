import * as path from "path";
import * as vscode from "vscode";

import { kubeChannel } from "../kubeChannel";
import { shell } from "../shell";
import { getBuildCommand, getPushCommand } from './buildToolsRegistry';

/**
 * Build the container image first. If imagePrefix is not empty, push the image to remote image registry, too.
 *
 * @param shellOpts any option available to Node.js's child_process.exec().
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
    const shellOpts = Object.assign({ }, shell.execOpts(), { cwd });
    const shellResult = await shell.execCore('git describe --always --dirty', shellOpts);
    return shellResult.code === 0 ? shellResult.stdout.trim() : "latest";
}

async function buildImage(image: string, shellOpts: any): Promise<void> {
    const result = await shell.execCore(getBuildCommand(image), shellOpts);
    if (result.code !== 0) {
        throw new Error(`Image build failed: ${result.stderr}`);
    }
    kubeChannel.showOutput(image + ' built.');
}

async function pushImage(image: string, shellOpts: any): Promise<void> {
    const result = await shell.execCore(getPushCommand(image), shellOpts);
    if (result.code !== 0) {
        throw new Error(`Image push failed: ${result.stderr}`);
    }
    kubeChannel.showOutput(image + ' pushed.');
}
