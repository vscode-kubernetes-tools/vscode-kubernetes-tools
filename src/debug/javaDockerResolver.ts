import * as vscode from 'vscode';

import { IDockerParser, IDockerResolver, PortInfo } from './debugInterfaces';
import { Kubectl } from '../kubectl';
import { shell } from '../shell';

const defaultJavaDebugPort = "5005";
const defaultJavaAppPort = "9000";
const defaultJavaDebugOpts = `-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=${defaultJavaDebugPort},quiet=y`;
const javaDebugOptsRegExp = /(-agentlib|-Xrunjdwp):\S*(address=[^\s,]+)/i;
const fullJavaDebugOptsRegExp = /^java\s+.*(-agentlib|-Xrunjdwp):\S*(address=[^\s,]+)\S*/i;

export class JavaDockerResolver implements IDockerResolver {
    public isSupportedImage(baseImage: string): boolean {
        return baseImage.indexOf("java") >= 0
            || baseImage.indexOf("openjdk") >= 0
            || baseImage.indexOf("oracle") >= 0;
    }

    public async resolvePortsFromFile(dockerParser: IDockerParser, env: {}): Promise<PortInfo> {
        const portInfo: PortInfo = {
            debug: null,
            app: null
        };

        // Resolve the debug port.
        const matches = dockerParser.searchLaunchArgs(javaDebugOptsRegExp);
        if (matches) {
            const addresses = matches[2].split("=")[1].split(":");
            portInfo.debug = addresses[addresses.length - 1];
        } else if (dockerParser.searchLaunchArgs(/\$\{?JAVA_OPTS\}?/)) {
            env["JAVA_OPTS"] = defaultJavaDebugOpts;
            portInfo.debug = defaultJavaDebugPort;
        }
        
        // Resolve the app port.
        const dockerExpose = dockerParser.getExposedPorts();
        if (portInfo.debug && dockerExpose.length) {
            const possiblePorts = dockerExpose.filter((port) => port !== portInfo.debug);
            if (possiblePorts.length === 1) {
                portInfo.app = possiblePorts[0];
            } else if (possiblePorts.length > 1) {
                const appPort = await vscode.window.showQuickPick(possiblePorts, { placeHolder: "Please select the app port exposed at Dockerfile" });
                if (/\$\{?(\w+)\}?/.test(appPort)) {
                    const varName = appPort.match(/\$\{?(\w+)\}?/)[1];
                    env[varName] = defaultJavaAppPort;
                    portInfo.app = defaultJavaAppPort;
                }
            }
        }

        return portInfo;
    }

    public async resolvePortsFromContainer(kubectl: Kubectl, pod: string, container: string): Promise<PortInfo> {
        //TODO
        return null;
    }
}
