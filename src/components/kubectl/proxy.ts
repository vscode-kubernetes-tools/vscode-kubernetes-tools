import { Errorable } from "../../errorable";
import { Kubectl } from "../../kubectl";
import { ChildProcess } from "child_process";

export async function proxy(kubectl: Kubectl, port: number | 'random'): Promise<Errorable<ProxySession>> {
    const portNumber = (port === 'random') ? 0 : port;
    const args = ['proxy', `--port=${portNumber}`];

    // TODO: option to show a cancellable progress indicator while opening proxy?  We don't really need this for the Swagger scenario though
    const proxyingProcess = await kubectl.spawnCommand(args);
    if (proxyingProcess.resultKind === 'exec-bin-not-found') {
        return { succeeded: false, error: ['Failed to invoke kubectl: program not found'] };
    }

    const forwarding = await waitForOutput(proxyingProcess.childProcess, /Starting to serve on \d+\.\d+\.\d+\.\d+:(\d+)/);

    if (forwarding.waitResult === 'process-exited') {
        return { succeeded: false, error: ['Failed to open proxy to cluster']};  // TODO: get the error moar betters
    }

    if (forwarding.matchedOutput.length < 2) {
        return { succeeded: false, error: [`Failed to open proxy to cluster: unexpected kubectl output ${forwarding.matchedOutput[0]}`]};  // TODO: get the error moar betters
    }

    const actualPort = Number.parseInt(forwarding.matchedOutput[1]);
    const dispose = () => { proxyingProcess.childProcess.kill(); };

    return {
        succeeded: true,
        result: { port: actualPort, dispose: dispose }
    };
}

export interface ProxySession {
    readonly port: number;
    dispose(): void;
}

// TODO: expands on code from API port forward impl: deduplicate

interface WaitForOutputSucceeded {
    readonly waitResult: 'succeeded';
    readonly matchedOutput: RegExpExecArray;
}

interface WaitForOutputProcessExited {
    readonly waitResult: 'process-exited';
}

type WaitForOutputResult = WaitForOutputSucceeded | WaitForOutputProcessExited;

function waitForOutput(process: ChildProcess, pattern: RegExp): Promise<WaitForOutputResult> {
    return new Promise<WaitForOutputResult>((resolve) => {
        let didOutput = false;

        process.stdout?.on('data', async (data) => {
            const message = `${data}`;
            const matchResult = pattern.exec(message);
            if (matchResult && matchResult.length > 0) {
                didOutput = true;
                resolve({ waitResult: 'succeeded', matchedOutput: matchResult });
            }
        });

        process.on('close', async (_code) => {
            if (!didOutput) {
                resolve({ waitResult: 'process-exited'});
            }
        });
    });
}
