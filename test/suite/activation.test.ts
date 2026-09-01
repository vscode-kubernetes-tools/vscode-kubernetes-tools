import * as assert from 'assert';
import * as os from 'os';
import * as path from 'path';
import * as sinon from 'sinon';
import * as vscode from 'vscode';

const EXTENSION_ID = 'ms-kubernetes-tools.vscode-kubernetes-tools';
const REFRESH_EXPLORER_COMMAND = 'extension.vsKubernetesRefreshExplorer';

// Regression test for https://github.com/vscode-kubernetes-tools/vscode-kubernetes-tools/issues/1999
//
// activate() used to `await validateKubeconfigPath()` before registering any commands. That
// function shows a "Kubeconfig not found... Add a new one?" notification, and a VS Code
// notification with buttons only resolves once the user answers or dismisses it. If the user
// ignored the notification, activate() stayed pending forever and none of the extension's
// commands were ever registered, so every invocation failed with
// "command 'extension.vsKubernetesRefreshExplorer' not found".
suite("Extension activation", () => {
    let sandbox: sinon.SinonSandbox;
    let originalKubeconfig: string | undefined;

    setup(() => {
        sandbox = sinon.createSandbox();
        originalKubeconfig = process.env['KUBECONFIG'];

        // Simulate a user who never answers the notification.
        sandbox.stub(vscode.window, 'showWarningMessage').returns(new Promise(() => { /* never settles */ }) as any);

        // Point at a kubeconfig that cannot exist, so the notification is triggered.
        process.env['KUBECONFIG'] = path.join(os.tmpdir(), 'vscode-kubernetes-tools-no-such-dir', 'config');
    });

    teardown(() => {
        sandbox.restore();
        if (originalKubeconfig === undefined) {
            delete process.env['KUBECONFIG'];
        } else {
            process.env['KUBECONFIG'] = originalKubeconfig;
        }
    });

    test("completes and registers commands even if the kubeconfig prompt is never answered", async function () {
        this.timeout(60000);

        const extension = vscode.extensions.getExtension(EXTENSION_ID);
        assert.ok(extension, `extension ${EXTENSION_ID} not found`);

        const TIMED_OUT = Symbol('timed out');
        let timer: NodeJS.Timeout | undefined;
        const timeout = new Promise<symbol>((resolve) => {
            timer = setTimeout(() => resolve(TIMED_OUT), 30000);
        });

        try {
            const outcome = await Promise.race([extension.activate(), timeout]);
            assert.notStrictEqual(outcome, TIMED_OUT, 'activate() did not complete - it is blocked on a user prompt');
        } finally {
            if (timer) {
                clearTimeout(timer);
            }
        }

        const commands = await vscode.commands.getCommands(true);
        assert.ok(commands.includes(REFRESH_EXPLORER_COMMAND), `${REFRESH_EXPLORER_COMMAND} was not registered`);
    });
});
