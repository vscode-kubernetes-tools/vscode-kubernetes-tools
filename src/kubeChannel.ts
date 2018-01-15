import * as vscode from "vscode";

export const kubeChannel = {
    channel: vscode.window.createOutputChannel("Kubernetes"),

    showOutput(message: any, title?: string) {
        if (title) {
            this.channel.appendLine(`[${title} ${(new Date()).toISOString().replace(/z|t/gi, ' ').trim()}]`);
        }
        this.channel.appendLine(message);
        this.channel.show();
    }
};
