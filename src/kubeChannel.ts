import * as vscode from "vscode";

export interface IKubeChannel {
    showOutput(message: any, title?: string);
}

class KubeChannel implements IKubeChannel {
    private readonly channel: vscode.OutputChannel = vscode.window.createOutputChannel("Kubernetes");

    showOutput(message: any, title?: string) {
        if (title) {
            const HIGHLIGHTING_TITLE = `[${title} ${(new Date()).toISOString().replace(/z|t/gi, ' ').trim()}]`;
            this.channel.appendLine(HIGHLIGHTING_TITLE);
        }
        this.channel.appendLine(message);
        this.channel.show();
    }
}

export const kubeChannel: IKubeChannel = new KubeChannel();
