import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

import { kubeChannel } from "../kubeChannel";
import { Kubectl } from "../kubectl";
import { getKubeconfig } from "../kubectlUtils";
import { shell, ShellResult } from "../shell";
import { DockerfileParser } from "./dockerfileParser";

export enum DockerClient {
    docker = "docker",
    dockerCompose = "docker-compose"
}

/**
 * Build the docker image first. If imagePrefix is not empty, push the image to remote docker hub, too.
 * 
 * @param dockerClient the possible dockerClient： docker or docker-compose.
 * @param shellOpts any option available to Node.js's child_process.exec().
 * @param imagePrefix the image prefix for docker images (e.g. 'docker.io/brendanburns').
 * @return the image name.
 */
export async function buildAndPushDockerImage(dockerClient: DockerClient, shellOpts: any, imagePrefix?: string): Promise<string> {
    const cwd = shellOpts.cwd || vscode.workspace.rootPath;
    const image = await getDefaultImageName(cwd, imagePrefix);
    await buildDockerImage(dockerClient, image, shellOpts);
    if (imagePrefix) {
        await pushDockerImage(dockerClient, image, shellOpts);
    }
    return image;
}

function sanitiseTag(name : string) {
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
        image = imagePrefix + "/" + image;
    }
    return image;
}

async function findVersion(cwd: string): Promise<string> {
    const shellOpts = Object.assign({ }, shell.execOpts(), { cwd });
    const shellResult = await shell.execCore('git describe --always --dirty', shellOpts);
    return shellResult.code !== 0 ? "latest" : shellResult.stdout.trim();
}

async function buildDockerImage(dockerClient: DockerClient, image: string, shellOpts: any): Promise<void> {
    // Build docker image.
    const buildResult = await shell.execCore(`${dockerClient} build -t ${image} .`, shellOpts);
    if (buildResult.code !== 0) {
        throw new Error(`Image build failed: ${buildResult.stderr}`);
    }
    kubeChannel.showOutput(image + ' built.');
}

async function pushDockerImage(dockerClient: string, image: string, shellOpts: any): Promise<void> {
    // Push docker image.
    const pushResult = await shell.execCore(`${dockerClient} push ${image}`, shellOpts);
    if (pushResult.code !== 0) {
        throw new Error(`Image push failed: ${pushResult.stderr}`);
    }
    kubeChannel.showOutput(image + ' pushed.');
}

/**
 * When using the command "minikube docker-env" to get the local kubernetes docker env, it needs run with the admin privilege.
 * To workaround this, this function will try to resolve the equivalent docker env from kubeconfig instead.
 */
export async function resolveDockerEnv(kubectl: Kubectl): Promise<{}> {
    const dockerEnv = {};
    const versionResult = await shell.exec(`docker version --format "{{.Client.APIVersion}}"`);
    dockerEnv["DOCKER_API_VERSION"] = "1.23";
    if (versionResult.code === 0) {
        dockerEnv["DOCKER_API_VERSION"] = versionResult.stdout.trim();
    }
    const kubeConfig = await getKubeconfig(kubectl);
    if (!kubeConfig) {
        return {};
    }
    const contextConfig = kubeConfig.contexts.find((context) => context.name === kubeConfig["current-context"]);
    const clusterConfig = kubeConfig.clusters.find((cluster) => cluster.name === contextConfig.context.cluster);
    const server = clusterConfig.cluster.server;
    const certificate = clusterConfig.cluster["certificate-authority"];
    if (!certificate) {
        return {};
    }
    if (/^https/.test(server)) {
        dockerEnv["DOCKER_TLS_VERIFY"] = 1;
    }
    dockerEnv["DOCKER_HOST"] = server.replace(/^https?:/, "tcp:").replace(/:\d+$/, ":2376");
    const certDir = path.dirname(certificate);
    if (fs.existsSync(path.join(certDir, "certs"))) {
        dockerEnv["DOCKER_CERT_PATH"] = path.join(certDir, "certs");
    } else {
        dockerEnv["DOCKER_CERT_PATH"] = certDir;
    }
    return dockerEnv;
}
