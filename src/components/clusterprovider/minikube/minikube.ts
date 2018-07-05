'use strict';

import * as vscode from 'vscode';
import { shell, ShellResult } from '../../../shell';

export async function startMinikube(): Promise<void> {
    shell.exec('minikube start').then((result: ShellResult) => {
        if (result.code === 0) {
            vscode.window.showInformationMessage('Cluster started.');
        } else {
            vscode.window.showErrorMessage(`Failed to start cluster ${result.stderr}`);
        }
    }).catch((err) => {
        vscode.window.showErrorMessage(`Failed to start cluster: ${err}`);
    });
}

export async function stopMinikube(): Promise<void> {
    shell.exec('minikube stop').then((result: ShellResult) => {
        if (result.code === 0) {
            vscode.window.showInformationMessage('Cluster stopped.');
        } else {
            vscode.window.showErrorMessage(`Error stopping cluster ${result.stderr}`);
        }
    }).catch((err) => {
        vscode.window.showErrorMessage(`Error stopping cluster: ${err}`);
    });
}