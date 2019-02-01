import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import * as url from "url";

import { kubeChannel } from "../kubeChannel";
import { Kubectl } from "../kubectl";
import { getCurrentClusterConfig } from "../kubectlUtils";
import { shell } from "../shell";
import { Dictionary } from "../utils/dictionary";

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
export async function resolveKubernetesDockerEnv(kubectl: Kubectl): Promise<{}> {
    const dockerEnv = Dictionary.of<string | number>();
    dockerEnv["DOCKER_API_VERSION"] = await dockerApiVersion();
    const currentCluster = await getCurrentClusterConfig(kubectl);
    if (!currentCluster || !currentCluster.server || !currentCluster.certificateAuthority) {
        return {};
    }

    if (/^https/.test(currentCluster.server)) {
        dockerEnv["DOCKER_TLS_VERIFY"] = 1;
    }
    const serverUrl = url.parse(currentCluster.server);
    dockerEnv["DOCKER_HOST"] = `tcp://${serverUrl.hostname}:2376`;
    const certDir = path.dirname(currentCluster.certificateAuthority);
    if (fs.existsSync(path.join(certDir, "certs"))) {
        dockerEnv["DOCKER_CERT_PATH"] = path.join(certDir, "certs");
    } else {
        dockerEnv["DOCKER_CERT_PATH"] = certDir;
    }
    return dockerEnv;
}

async function dockerApiVersion(): Promise<string> {
    const defaultDockerVersion = "1.23";
    const versionResult = await shell.exec(`docker version --format "{{.Client.APIVersion}}"`);
    if (versionResult && versionResult.code === 0) {
        return versionResult.stdout.trim();
    }
    return defaultDockerVersion;
}
