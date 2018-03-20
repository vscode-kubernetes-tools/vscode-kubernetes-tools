'use strict';

import { host } from './host';
import { shell } from './shell';
import { fs } from './fs';
import * as yaml from 'js-yaml';

export function readKubectlConfig() : Promise<KubeConfig> {
    return new Promise((resolve, reject) => {
        const kubeConfig = shell.combinePath(shell.home(), ".kube/config");
        fs.readFile(kubeConfig, 'utf8', (err, data) => {
            if (err) {
                reject(err);
                return;
            }
            const kcconfigf = data;
            const kcconfig = yaml.safeLoad(kcconfigf);
            const apiVersion = kcconfig['apiVersion'];
            const currentContextName = kcconfig['current-context'];
            const currentContextDef = kcconfig['contexts'].find((c) => c['name'] === currentContextName);
            if (!currentContextDef) {
                reject({ kubectlError: 'noCurrentContext', message: 'No current context in .kube/config' });
                return;
            }
            const currentContext = currentContextDef['context'];
            const currentClusterDef = kcconfig['clusters'].find((c) => c['name'] === currentContext['cluster']);
            if (!currentClusterDef) {
                reject({ kubectlError: 'noCluster', message: 'Invalid cluster in current context in .kube/config' });
                return;
            }
            const currentCluster = currentClusterDef['cluster'];
            const endpoint = currentCluster['server'];
            const cadata = currentCluster['certificate-authority-data'];
            const cadataFile = currentCluster['certificate-authority'];
            const currentUserDef = kcconfig['users'].find((u) => u['name'] === currentContext['user']);
            if (!currentUserDef) {
                reject({ kubectlError: 'noUser', message: 'Invalid user in current context in .kube/config' });
                return;
            }
            const currentUser = currentUserDef['user'];
            const clientCertData = currentUser['client-certificate-data'];
            const clientKeyData = currentUser['client-key-data'];
            const clientCertDataFile = currentUser['client-certificate'];
            const clientKeyFile = currentUser['client-key'];
            resolve({
                endpoint: endpoint,
                clientCertificateData: clientCertDataFile ? <Buffer>fs.readFileSync(clientCertDataFile): Buffer.from(clientCertData, 'base64'),
                clientKeyData: clientKeyFile ? <Buffer>fs.readFileSync(clientKeyFile): Buffer.from(clientKeyData, 'base64'),
                certificateAuthorityData: cadataFile ? <Buffer>fs.readFileSync(cadataFile): Buffer.from(cadata, 'base64')
            });
        });
    });
}

export interface KubeConfig {
    readonly endpoint : string;
    readonly clientCertificateData : Buffer;
    readonly clientKeyData : Buffer;
    readonly certificateAuthorityData : Buffer;
}
