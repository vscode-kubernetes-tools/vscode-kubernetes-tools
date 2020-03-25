import * as helmexec from '../../helm.exec';
import { kubeChannel } from '../../kubeChannel';
import { create as kubectlCreate } from '../../kubectl';
import { create as draftCreate, CheckPresentMode as DraftCheckPresentMode } from '../../draft/draft';
import { create as minikubeCreate, CheckPresentMode as MinikubeCheckPresentMode } from '../clusterprovider/minikube/minikube';
import { fs } from '../../fs';
import { host } from '../../host';
import { shell, Shell } from '../../shell';
import * as config from '../config/config';
import { installHelm, installDraft, installKubectl, installMinikube } from './installer';
import { failed, Errorable } from '../../errorable';

const kubectl = kubectlCreate(config.getKubectlVersioning(), host, fs, shell);
const draft = draftCreate(host, fs, shell);
const minikube = minikubeCreate(host, fs, shell);

export async function installDependencies() {
    // TODO: gosh our binchecking is untidy
    const gotKubectl = await kubectl.ensurePresent({ silent: true });
    const gotHelm = helmexec.ensureHelm(helmexec.EnsureMode.Silent);
    const gotDraft = await draft.checkPresent(DraftCheckPresentMode.Silent);
    const gotMinikube = await minikube.checkPresent(MinikubeCheckPresentMode.Silent);

    const warn = (m: string) => kubeChannel.showOutput(m);

    const installPromises = [
        installDependency("kubectl", gotKubectl, installKubectl),
        installDependency("Helm", gotHelm, (sh) => installHelm(sh, warn)),
        installDependency("Draft", gotDraft, installDraft),
    ];

    if (!config.getUseWsl()) {
        // TODO: Install Win32 Minikube
        installPromises.push(
            installDependency("Minikube", gotMinikube, (shell: Shell) => {
                return installMinikube(shell, null);
            }));
    }
    await Promise.all(installPromises);

    kubeChannel.showOutput("Done");
}

async function installDependency(name: string, alreadyGot: boolean, installFunc: (shell: Shell) => Promise<Errorable<null>>): Promise<void> {
    if (alreadyGot) {
        kubeChannel.showOutput(`Already got ${name}...`);
    } else {
        kubeChannel.showOutput(`Installing ${name}...`);
        const result = await installFunc(shell);
        if (failed(result)) {
            kubeChannel.showOutput(`Unable to install ${name}: ${result.error[0]}`);
        }
    }
}
