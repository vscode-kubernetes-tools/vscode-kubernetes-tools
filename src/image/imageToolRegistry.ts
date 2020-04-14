import * as binutil from '../binutil';
import { getImageBuildTool } from '../components/config/config';
import { host } from '../host';
import { fs } from '../fs';
import { shell } from '../shell';

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

    /** Returns a command line to build the given image. */
    getBuildCommand(image: string): string;

    /** Returns a command line to push the given image. */
    getPushCommand(image: string): string;

    /** Checks whether the binary is present. */
    checkPresent(): Promise<boolean>;
}

class DockerLikeImageBuildTool implements ContainerImageBuildTool {
    protected readonly context: binutil.BinCheckContext;

    constructor(readonly binName: string) {
        this.context = { host : host, fs : fs, shell : shell, binFound : false, binPath : binName };
    }

    getBuildCommand(image: string): string {
        return `${this.binName} build -t ${image} .`;
    }

    getPushCommand(image: string): string {
        return `${this.binName} push ${image}`;
    }

    async checkPresent(): Promise<boolean> {
        if (this.context.binFound) {
            return true;
        }
        return binutil.checkForBinary(this.context, undefined, this.binName, '', '', false);
    }
}

class Buildah extends DockerLikeImageBuildTool {
    getBuildCommand(image: string): string {
        return `${this.binName} bud -t ${image} .`;
    }
}

const supportedTools: { [id: string]: ContainerImageBuildTool } = {
    Docker: new DockerLikeImageBuildTool('docker'),
    Buildah: new Buildah('buildah')
};
