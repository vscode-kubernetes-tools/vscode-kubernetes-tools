import * as vscode from 'vscode';

import { getPreferBuildah } from '../components/config/config';
import { shell } from '../shell';

interface ContainerImageBuildTool {

    /** Returns a command line to build the specified image. */
    getBuildCommand(image: string): string;

    /** Returns a command line to push the specified image. */
    getPushCommand(image: string): string;

    /** Tests whether this tool is installed and properly configured. */
    available(): Promise<boolean>;
}

class Docker implements ContainerImageBuildTool {
    private binName = 'docker';

    getBuildCommand(image: string): string {
        return `${this.binName} build -t ${image} .`;
    }

    getPushCommand(image: string): string {
        return `${this.binName} push ${image}`;
    }

    async available(): Promise<boolean> {
        const result = await shell.exec(`${this.binName} version --format "{{.Server.APIVersion}}"`);
        return result !== undefined && result.code === 0;
    }
}

class Buildah implements ContainerImageBuildTool {
    private binName = 'buildah';

    getBuildCommand(image: string): string {
        return `${this.binName} bud -t ${image} .`;
    }

    getPushCommand(image: string): string {
        return `${this.binName} push ${image}`;
    }

    async available(): Promise<boolean> {
        const result = await shell.exec(`${this.binName} version`);
        return result !== undefined && result.code === 0;
    }
}

const supportedTools: { [id: string]: ContainerImageBuildTool } = {
    Docker: new Docker(),
    Buildah: new Buildah()
};

/** Returns a command line for building the given image. */
export function getBuildCommand(image: string): string {
    const buildTool = supportedTools[currentBuildTool];
    return buildTool.getBuildCommand(image);
}

/** Returns a command line for pushing the given image. */
export function getPushCommand(image: string): string {
    const buildTool = supportedTools[currentBuildTool];
    return buildTool.getPushCommand(image);
}

/** Currently used image build tool. */
export let currentBuildTool: string;

/** Starts listening changing the preferred build tool. */
export function start(): vscode.Disposable {
    detectCurrentBuildTool();
    const disposable = vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('vs-kubernetes.preferBuildah')) {
            detectCurrentBuildTool();
        }
    });
    return disposable;
}

/**
 * Detects a tool for basic image operations.
 * Tool name can be retrieved through the `currentBuildTool` variable.
 */
async function detectCurrentBuildTool(): Promise<void> {
    const buildah = supportedTools['Buildah'];
    if (getPreferBuildah() && await buildah.available()) {
        currentBuildTool = 'Buildah';
    } else {
        currentBuildTool = 'Docker';
    }
}
