import * as vscode from "vscode";

import { Kubectl } from "../kubectl";
import { Dictionary } from "../utils/dictionary";

async function promptForPort(promptMessage: string, defaultPort: string): Promise<string> {
    const input = await vscode.window.showInputBox({
        prompt: promptMessage,
        placeHolder: defaultPort,
        value: defaultPort
    });

    return input && input.trim();
}

export async function promptForDebugPort(defaultPort: string): Promise<string> {
    return await promptForPort("Please specify debug port exposed for debugging", defaultPort);
}

export async function promptForAppPort(ports: string[], defaultPort: string, env: Dictionary<string>): Promise<string | undefined> {
    let rawAppPortInfo: string;
    if (ports.length === 0) {
        return await promptForPort("What port does your application listen on?", defaultPort);
    } if (ports.length === 1) {
        rawAppPortInfo = ports[0];
    } else if (ports.length > 1) {
        rawAppPortInfo = await vscode.window.showQuickPick(ports, { placeHolder: "Choose the port your app listens on." });
    }

    // If the choosed port is a variable, then need set it in environment variables.
    const portRegExp = /\$\{?(\w+)\}?/;
    if (portRegExp.test(rawAppPortInfo)) {
        const varName = rawAppPortInfo.match(portRegExp)[1];
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
export async function getCommandsOfProcesses(kubectl: Kubectl, pod: string, podNamespace: string | undefined, container: string): Promise<string[]> {
    const commandLines: string[] = [];
    const nsarg = podNamespace ? `--namespace ${podNamespace}` : '';
    const execCmd = `exec ${pod} ${nsarg} ${container ? "-c ${selectedContainer}" : ""} -- ps -ef`;
    const execResult = await kubectl.invokeAsync(execCmd);
    if (execResult.code === 0) {
        /**
         * PID   USER     TIME   COMMAND
         *  1    root     2:09   java -Djava.security.egd=file:/dev/./urandom -agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=1044,quiet=y -jar target/app.jar
         * 44    root     0:00   sh
         * 48    root     0:00   ps -ef
         */
        const rows = execResult.stdout.split("\n");
        const columnCount = rows[0].trim().split(/\s+/).length;
        // The 1st row is the header, loop from the 2nd row.
        for (let i = 1; i < rows.length; i++) {
            const cols = rows[i].trim().split(/\s+/);
            if (cols.length < columnCount) {
                continue;
            }

            commandLines.push(cols.slice(columnCount - 1, cols.length).join(" "));
        }
    }

    return commandLines;
}
