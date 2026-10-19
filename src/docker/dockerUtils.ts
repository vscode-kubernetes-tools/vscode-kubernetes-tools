import * as fs from "fs";
import * as path from "path";
import * as url from "url";
import * as vscode from 'vscode';

import { Kubectl } from "../kubectl";
import { getCurrentClusterConfig } from "../kubectlUtils";
import { monitorForAuthPrompt, shell } from "../shell";
import { Dictionary } from "../utils/dictionary";
import { executeCommand } from '../process';
import { getUseWsl } from '../components/config/config';

/**
 * When using the command "minikube docker-env" to get the local kubernetes docker env, it needs run with the admin privilege.
 * To workaround this, this function will try to resolve the equivalent docker env from kubeconfig instead.
 */
export async function resolveKubernetesDockerEnv(kubectl: Kubectl): Promise<{}> {
    const dockerEnv = Dictionary.of<string | number>();
    dockerEnv["DOCKER_API_VERSION"] = await dockerApiVersion();
    const currentCluster = await getCurrentClusterConfig(kubectl, { silent: true });
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
    const { cwd, env } = shell.execOpts();
    const args = ['version', '--format', '{{.Client.APIVersion}}'];
    try {
        const versionResult = await executeCommand(getUseWsl() ? {
            executable: 'wsl.exe',
            args: ['--exec', 'docker', ...args],
            cwd,
            env,
        } : {
            executable: 'docker',
            args,
            cwd,
            env,
        }, undefined, monitorForAuthPrompt);
        if (versionResult.code === 0) {
            return versionResult.stdout.trim();
        }
    } catch (err) {
        vscode.window.showErrorMessage(String(err));
    }
    return defaultDockerVersion;
}
