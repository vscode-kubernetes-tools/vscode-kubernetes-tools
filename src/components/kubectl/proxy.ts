'use strict';

import * as vscode from 'vscode';
import * as opn from 'opn';

import {createReadStream} from 'fs';
import {resolve} from 'path';
import {fs} from '../../fs';

const KUBE_DASHBOARD_URL = "http://localhost:8001/ui/";
const TERMINAL_NAME = "Kubernetes Proxy";
const PROXY_OUTPUT_FILE = resolve(__dirname, 'proxy.out');

// The instance of the terminal running Kubectl Proxy.
let terminal:vscode.Terminal;

/**
 * Runs `kubectl proxy` in a terminal process spawned by the extension, and opens the Kubernetes
 * dashboard in the user's preferred browser.
 */
export async function dashboardKubernetes ():Promise<void> {
    // If we've already got a terminal instance, just open the dashboard.
    if (terminal) {
        opn(KUBE_DASHBOARD_URL);
        return;
    }

    let outputExists;

    try {
        outputExists = await fs.existsAsync(PROXY_OUTPUT_FILE);
        if (!outputExists) {
            await fs.openAsync(PROXY_OUTPUT_FILE, 'w+');
        }
    } catch (e) {
        vscode.window.showErrorMessage("Something went wrong when ensuring the Kubernetes API Proxy output stream existed");
        return;
    }

    // Read kubectl proxy's stdout as a stream.
    const proxyStream = createReadStream(
        PROXY_OUTPUT_FILE,
        {encoding: 'utf8'}
    ).on('data', onStreamData);

    terminal = vscode.window.createTerminal(TERMINAL_NAME);
    vscode.window.onDidCloseTerminal(onClosedTerminal);

    // stdout is also written to a file via `tee`. We read this file as a stream
    // to listen for when the server is ready.
    terminal.sendText(`kubectl proxy | tee ${PROXY_OUTPUT_FILE}`);
    terminal.show(true);
}

/**
 * Called when the terminal window is closed by the user.
 * @param proxyTerminal
 */
const onClosedTerminal = async (proxyTerminal:vscode.Terminal) => {
    // Make sure we only dispose when it's *our* terminal we want gone.
    if (proxyTerminal.name !== TERMINAL_NAME) {
        return;
    }

    terminal = null;
    console.log("Closing Kubernetes API Proxy");

    try {
        await fs.unlinkAsync(PROXY_OUTPUT_FILE);
        console.log('Kubernetes API Proxy stream removed');
    } catch (e) {
        console.log('Could not remove Kubernetes API Proxy stream');
    }
};

/**
 * Callback to read data written to the Kubernetes API Proxy output stream.
 * @param data
 */
const onStreamData = (data:String) => {
    // Everything's alright…
    if (data.startsWith("Starting to serve")) {
        // Let the proxy warm up a bit… otherwise we might hit a browser's error page.
        setTimeout(() => {
            opn(KUBE_DASHBOARD_URL);
        }, 2500);

        vscode.window.showInformationMessage(`Kubernetes Dashboard running at ${KUBE_DASHBOARD_URL}`);
        return;
    }

    // Maybe we've bound to the port already outside of the extension?
    vscode.window.showErrorMessage("Could not start the Kubernetes Dashboard. Is it already running?");
    terminal.dispose();
};