import * as vscode from "vscode";

import { Kubectl } from "../kubectl";
import { Dictionary } from "../utils/dictionary";

async function promptForPort(promptMessage: string, defaultPort: string): Promise<string | undefined> {
    const input = await vscode.window.showInputBox({
        prompt: promptMessage,
        placeHolder: defaultPort,
        value: defaultPort
    });

    return input && input.trim();
}

export async function promptForDebugPort(defaultPort: string): Promise<string | undefined> {
    return await promptForPort("Please specify debug port exposed for debugging", defaultPort);
}

export async function promptForAppPort(ports: string[], defaultPort: string, env: Dictionary<string>): Promise<string | undefined> {
    let rawAppPortInfo: string | undefined;
    if (ports.length === 0) {
        return await promptForPort("What port does your application listen on?", defaultPort);
    } if (ports.length === 1) {
        rawAppPortInfo = ports[0];
    } else if (ports.length > 1) {
        rawAppPortInfo = await vscode.window.showQuickPick(ports, { placeHolder: "Choose the port your app listens on." });
    }

    if (!rawAppPortInfo) {
        return undefined;
    }

    // If the chosen port is a variable, then need set it in environment variables.
    const portRegExp = /\$\{?(\w+)\}?/;
    const portRegExpMatch = rawAppPortInfo.match(portRegExp);
    if (portRegExpMatch && portRegExpMatch.length > 0) {
        const varName = portRegExpMatch[1];
        if (rawAppPortInfo.trim() === `$${varName}` || rawAppPortInfo.trim() === `\${${varName}}`) {
            const defaultAppPort = "50006"; // Configure an unusual port number for the variable.
            env[varName] = defaultAppPort;
            rawAppPortInfo = defaultAppPort;
        } else {
            vscode.window.showErrorMessage(`Invalid port variable ${rawAppPortInfo} in the docker file.`);
            return undefined;
        }
    }

    return rawAppPortInfo;
}

/**
 * Get the command info associated with the processes in the target container.
 *
 * @param kubectl the kubectl client.
 * @param pod the pod name.
 * @param container the container name.
 * @return the commands associated with the processes.
 */
export async function getProcesses(kubectl: Kubectl, pod: string, podNamespace: string | undefined, container: string | undefined): Promise<ProcessInfo[] | undefined> {
    const processes: ProcessInfo[] = [];
    const nsarg = podNamespace ? `--namespace ${podNamespace}` : '';
    const containerCommand = container ? `-c ${container}` : '';

    // second -w in below command tells ps to not limit number of columns by terminal size. Since this is not running in terminal,
    // this may have no affect, but atleast someone debugging can run the command in terminal and will get the same results that this
    // invocation will get.
    const execCmd = `exec ${pod} ${nsarg} ${containerCommand} -- ps -o pid,command -e -w -w`;

    const execResult = await kubectl.invokeAsync(execCmd);
    if (execResult && execResult.code === 0) {
        /**
         * PID   COMMAND
         *  1    java -Djava.security.egd=file:/dev/./urandom -agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=1044,quiet=y -jar target/app.jar
         * 44    sh
         * 48    ps  -o pid,comm -e -w -w
         */

        const outputRegEx = /^\s*(\d+)\s*(.*)$/gm;
        let match = outputRegEx.exec(execResult.stdout);
        while (match) {
            processes.push({
                pid: +match[1],
                command: match[2]
            });
            match = outputRegEx.exec(execResult.stdout);
        }
        return processes;
    }
    return undefined;
}

/**
 * Represents information about a running process.
 */
export interface ProcessInfo {
    /** The process ID */
    readonly pid: number;
    /** The full command that launched the process */
    readonly command: string;
}
