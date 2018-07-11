import * as path from "path";
import * as vscode from "vscode";

import { IDebugProvider, PortInfo } from "./debugProvider";
import * as debugUtils from "./debugUtils";
import * as extensionUtils from "../extensionUtils";
import { Kubectl } from "../kubectl";
import { IDockerfile } from "../docker/parser";

// Use the java debugger extension provided by microsoft team for java debugging.
const defaultJavaDebuggerExtensionId = "vscjava.vscode-java-debug";
const defaultJavaDebuggerExtension = "Debugger for Java";
const defaultJavaDebuggerConfigType = "java";

const defaultJavaDebugPort = "50005";
const defaultJavaAppPort = "8080";
const defaultJavaDebugOpts = `-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=${defaultJavaDebugPort},quiet=y`;
const javaDebugOptsRegExp = /(-agentlib|-Xrunjdwp):\S*(address=[^\s,]+)/i;
const fullJavaDebugOptsRegExp = /^java\s+.*(-agentlib|-Xrunjdwp):\S*(address=[^\s,]+)\S*/i;

export class JavaDebugProvider implements IDebugProvider {
    public getDebuggerType(): string {
        return defaultJavaDebuggerConfigType;
    }

    public async isDebuggerInstalled(): Promise<boolean> {
        if (vscode.extensions.getExtension(defaultJavaDebuggerExtensionId)) {
            return true;
        }
        const answer = await vscode.window.showInformationMessage(`Java debugging requires the '${defaultJavaDebuggerExtension}' extension. Would you like to install it now?`, "Install Now");
        if (answer === "Install Now") {
            return await extensionUtils.installVscodeExtension(defaultJavaDebuggerExtensionId);
        }
        return false;
    }

    public async startDebugging(workspaceFolder: string, sessionName: string, port: number): Promise<boolean> {
        const debugConfiguration = {
            type: "java",
            request: "attach",
            name: sessionName,
            hostName: "localhost",
            port
        };
        const currentFolder = vscode.workspace.workspaceFolders.find((folder) => folder.name === path.basename(workspaceFolder));
        return await vscode.debug.startDebugging(currentFolder, debugConfiguration);
    }

    public isSupportedImage(baseImage: string): boolean {
        if (!baseImage) {
            return false;
        }
        return baseImage.indexOf("java") >= 0
            || baseImage.indexOf("openjdk") >= 0
            || baseImage.indexOf("oracle") >= 0;
    }

    public async resolvePortsFromFile(dockerfile: IDockerfile, env: {}): Promise<PortInfo | undefined> {
        let rawDebugPortInfo: string;
        let rawAppPortInfo: string;

        // Resolve the debug port.
        const matches = dockerfile.searchLaunchArgs(javaDebugOptsRegExp);
        if (extensionUtils.isNonEmptyArray(matches)) { // Enable debug options in command lines directly.
            const addresses = matches[2].split("=")[1].split(":");
            rawDebugPortInfo = addresses[addresses.length - 1];
        } else if (extensionUtils.isNonEmptyArray(dockerfile.searchLaunchArgs(/\$\{?JAVA_OPTS\}?/))) { // Use $JAVA_OPTS env var in command lines.
            env["JAVA_OPTS"] = defaultJavaDebugOpts;
            rawDebugPortInfo = defaultJavaDebugPort;
        } else { // Enable debug options by the global JVM environment variables.
            // According to the documents https://bugs.openjdk.java.net/browse/JDK-4971166 and
            // https://stackoverflow.com/questions/28327620/difference-between-java-options-java-tool-options-and-java-opts,
            // JAVA_TOOL_OPTIONS and _JAVA_OPTIONS are ways to specify JVM arguments as an environment variable instead of command line parameters.
            // JAVA_TOOL_OPTIONS is included in standard JVMTI specification and is the recommended way.
            // _JAVA_OPTIONS trumps command-line arguments, which in turn trump JAVA_TOOL_OPTIONS.
            env["JAVA_TOOL_OPTIONS"] = defaultJavaDebugOpts;
            rawDebugPortInfo = defaultJavaDebugPort;
        }

        // Resolve the app port.
        const exposedPorts = dockerfile.getExposedPorts();
        const possiblePorts = exposedPorts.length ? exposedPorts.filter((port) => port !== rawDebugPortInfo) : [];
        rawAppPortInfo = await debugUtils.promptForAppPort(possiblePorts, defaultJavaAppPort, env);

        return {
            debugPort: Number(rawDebugPortInfo),
            appPort: Number(rawAppPortInfo)
        };
    }

    public async resolvePortsFromContainer(kubectl: Kubectl, pod: string, podNamespace: string | undefined, container: string): Promise<PortInfo> {
        let rawDebugPortInfo: string;
        const commandLines = await debugUtils.getCommandsOfProcesses(kubectl, pod, podNamespace, container);
        for (const commandLine of commandLines) {
            // java -Djava.security.egd=file:/dev/./urandom -agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=1044,quiet=y -jar target/app.jar
            const matches = commandLine.match(fullJavaDebugOptsRegExp);
            if (extensionUtils.isNonEmptyArray(matches)) {
                const addresses = matches[2].split("=")[1].split(":");
                rawDebugPortInfo = addresses[addresses.length - 1];
                break;
            }
        }

        if (!rawDebugPortInfo) {
            rawDebugPortInfo = await debugUtils.promptForDebugPort(defaultJavaDebugPort);
        }

        return {
            debugPort: Number(rawDebugPortInfo)
        };
    }
}
