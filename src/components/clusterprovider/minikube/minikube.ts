'use strict';

import * as vscode from 'vscode';
import { shell } from '../../../shell';

export async function startKubernetes() {
    shell.exec('minikube start').then(() => {
        vscode.window.showInformationMessage('Cluster started.');
    }).catch((err) => {
        vscode.window.showErrorMessage(`Failed to start cluster: ${err}`);
    });
}

export async function stopKubernetes() {
    shell.exec('minikube stop').then(() => {
        vscode.window.showInformationMessage('Cluster stopped.');
    }).catch((err) => {
        vscode.window.showErrorMessage(`Failed to stop cluster: ${err}`);
    });
}