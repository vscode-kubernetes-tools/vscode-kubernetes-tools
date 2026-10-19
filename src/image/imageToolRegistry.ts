import * as binutil from '../binutil';
import { getImageBuildTool, getUseWsl } from '../components/config/config';
import { host } from '../host';
import { fs } from '../fs';
import { shell } from '../shell';
import { CommandInvocation } from '../process';

const domainComponent = '[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?';
const domain = `(?:${domainComponent}(?:\\.${domainComponent})*|\\[[A-Fa-f0-9:.]+\\])(?::[0-9]+)?`;
const pathComponent = '[a-z0-9]+(?:(?:[._]|__|[-]+)[a-z0-9]+)*';
const tag = '[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}';
const digestAlgorithm = '[A-Za-z][A-Za-z0-9]*(?:[+._-][A-Za-z][A-Za-z0-9]*)*';
const digest = `${digestAlgorithm}:[A-Za-z0-9=_-]+`;
const CONTAINER_IMAGE_REFERENCE = new RegExp(
    `^(?:${domain}/)?${pathComponent}(?:/${pathComponent})*(?::${tag})?(?:@${digest})?$`
);
const INVALID_IMAGE_REFERENCE_CHARACTERS = /[\s\x00-\x1f\x7f"'`$;&|<>(){}\\]/;

export function assertValidContainerImageReference(image: string): void {
    if (INVALID_IMAGE_REFERENCE_CHARACTERS.test(image) || !CONTAINER_IMAGE_REFERENCE.test(image)) {
        throw new Error('Invalid container image reference.');
    }
}

export async function getCurrentBuildTool(): Promise<ContainerImageBuildTool> {
    const buildTool = supportedTools[getImageBuildTool()];
    if (!buildTool) {
        throw new Error(`Unknown image build tool: ${getImageBuildTool()}. Choose the correct value in 'vs-kubernetes.imageBuildTool' setting.`);
    }
    if (!await buildTool.checkPresent()) {
        throw new Error(`Could not find ${buildTool.binName} binary. Install it or choose another one in 'vs-kubernetes.imageBuildTool' setting.`);
    }
    return buildTool;
}

export interface ContainerImageBuildTool {
    /** Binary name (e.g. docker, buildah, img). */
    binName: string;

    /** Returns an invocation to build the given image. */
    getBuildCommand(image: string): CommandInvocation;

    /** Returns an invocation to push the given image. */
    getPushCommand(image: string): CommandInvocation;

    /** Checks whether the binary is present. */
    checkPresent(): Promise<boolean>;
}

class DockerLikeImageBuildTool implements ContainerImageBuildTool {
    protected readonly context: binutil.BinCheckContext;

    constructor(readonly binName: string) {
        this.context = { host : host, fs : fs, shell : shell, binFound : false, binPath : binName };
    }

    getBuildCommand(image: string): CommandInvocation {
        assertValidContainerImageReference(image);
        return this.getCommand(['build', '-t', image, '.']);
    }

    getPushCommand(image: string): CommandInvocation {
        assertValidContainerImageReference(image);
        return this.getCommand(['push', image]);
    }

    async checkPresent(): Promise<boolean> {
        if (this.context.binFound) {
            return true;
        }
        return binutil.checkForBinary(this.context, undefined, this.binName, '', '', false);
    }

    protected getCommand(args: readonly string[]): CommandInvocation {
        if (getUseWsl()) {
            return {
                executable: 'wsl.exe',
                args: ['--exec', this.context.binPath, ...args],
            };
        }
        return {
            executable: this.context.binPath,
            args,
        };
    }
}

class Buildah extends DockerLikeImageBuildTool {
    getBuildCommand(image: string): CommandInvocation {
        assertValidContainerImageReference(image);
        return this.getCommand(['bud', '-t', image, '.']);
    }
}

const supportedTools: { [id: string]: ContainerImageBuildTool } = {
    Docker: new DockerLikeImageBuildTool('docker'),
    Buildah: new Buildah('buildah')
};
