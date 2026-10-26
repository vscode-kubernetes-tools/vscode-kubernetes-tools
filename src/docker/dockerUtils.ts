import * as fs from "fs";
import * as path from "path";
import * as url from "url";

import { Kubectl } from "../kubectl";
import { getCurrentClusterConfig } from "../kubectlUtils";
import { Dictionary } from "../utils/dictionary";
import { ImageToolExecutionOptions, resolveImageTool } from '../image/imageToolRegistry';

/**
 * When using the command "minikube docker-env" to get the local kubernetes docker env, it needs run with the admin privilege.
 * To workaround this, this function will try to resolve the equivalent docker env from kubeconfig instead.
 */
export async function resolveKubernetesDockerEnv(kubectl: Kubectl, options: ImageToolExecutionOptions = {}): Promise<{}> {
    const dockerEnv = Dictionary.of<string>();
    dockerEnv["DOCKER_CONTEXT"] = "";
    const currentCluster = await getCurrentClusterConfig(kubectl, { silent: true });
    if (!currentCluster || !currentCluster.server || !currentCluster.certificateAuthority) {
        return {};
    }

    if (/^https/.test(currentCluster.server)) {
        dockerEnv["DOCKER_TLS_VERIFY"] = "1";
    } else {
        dockerEnv["DOCKER_TLS_VERIFY"] = "";
    }
    const serverUrl = url.parse(currentCluster.server);
    dockerEnv["DOCKER_HOST"] = `tcp://${serverUrl.hostname}:2376`;
    const certDir = path.dirname(currentCluster.certificateAuthority);
    if (fs.existsSync(path.join(certDir, "certs"))) {
        dockerEnv["DOCKER_CERT_PATH"] = path.join(certDir, "certs");
    } else {
        dockerEnv["DOCKER_CERT_PATH"] = certDir;
    }
    const apiVersion = await dockerApiVersion({ ...options, env: dockerEnv });
    if (apiVersion) {
        dockerEnv["DOCKER_API_VERSION"] = apiVersion;
    }
    return dockerEnv;
}

export async function dockerApiVersion(options: ImageToolExecutionOptions = {}): Promise<string | undefined> {
    try {
        const env = { ...(options.env || {}) };
        for (const key of Object.keys(env)) {
            if (key.toLowerCase() === 'docker_api_version') {
                delete env[key];
            }
        }
        const docker = await resolveImageTool('Docker', { ...options, env });
        const versionResult = docker && await docker.execute(['version', '--format', '{{.Client.APIVersion}}']);
        const version = versionResult?.code === 0 ? versionResult.stdout.trim() : '';
        if (/^\d+\.\d+$/.test(version)) {
            return version;
        }
    } catch (_err) {
        // The build command reports the actionable Docker launch failure.
    }
    return undefined;
}
