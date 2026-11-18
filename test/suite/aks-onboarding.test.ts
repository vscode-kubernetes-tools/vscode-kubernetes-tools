import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as yaml from 'js-yaml';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as config from '../../src/components/config/config';
import * as processes from '../../src/process';
import * as executables from '../../src/components/helm/executable';
import * as azureCli from '../../src/components/clusterprovider/azure/azure-cli';
import * as explorer from '../../src/components/clusterprovider/common/explorer';
import { importAksKubeconfig } from '../../src/components/cloudprovider/aks-kubeconfig';

interface FixtureConfig {
    apiVersion: string;
    kind: string;
    clusters: { name: string; cluster: { server: string } }[];
    users: { name: string; user: { exec: { command: string; args: string[]; apiVersion: string; env?: { name: string; value: string }[] | null } } }[];
    contexts: { name: string; context: { cluster: string; user: string } }[];
    'current-context': string;
}

function fixture(mode: string | undefined = 'devicecode'): FixtureConfig {
    return {
        apiVersion: 'v1', kind: 'Config',
        clusters: [{ name: 'aks', cluster: { server: 'https://example.invalid' } }],
        users: [{ name: 'aks-user', user: { exec: {
            command: 'kubelogin', apiVersion: 'client.authentication.k8s.io/v1beta1',
            args: ['get-token', ...(mode ? ['--login', mode] : []), '--tenant-id', 'tenant', '--server-id', 'server'],
        } } }],
        contexts: [{ name: 'aks context $(literal)', context: { cluster: 'aks', user: 'aks-user' } }],
        'current-context': 'aks context $(literal)',
    };
}

suite('AKS onboarding', () => {
    let sandbox: sinon.SinonSandbox;
    let directory: string;
    let target: string;
    let originalEnv: string | undefined;
    let selectedLogin: string | undefined;
    let confirmations: (string | undefined)[];
    let activation: string | undefined;
    let activeSetting: string | undefined;
    let execute: sinon.SinonStub<Parameters<typeof processes.executeCommand>, ReturnType<typeof processes.executeCommand>>;
    let info: sinon.SinonStub;
    let error: sinon.SinonStub;
    let pick: sinon.SinonStub;
    let resolve: sinon.SinonStub;
    let resolveAzure: sinon.SinonStub;
    let temporaryFile: string | undefined;

    setup(() => {
        sandbox = sinon.createSandbox();
        directory = fs.mkdtempSync(path.join(os.tmpdir(), 'aks-onboarding-'));
        target = path.join(directory, 'selected config');
        originalEnv = process.env.KUBECONFIG;
        process.env.KUBECONFIG = target;
        selectedLogin = 'Azure CLI'; confirmations = ['Merge']; activation = undefined; activeSetting = undefined; temporaryFile = undefined;
        sandbox.stub(config, 'getUseWsl').returns(false);
        sandbox.stub(config, 'getActiveKubeconfig').callsFake(() => activeSetting);
        sandbox.stub(explorer, 'refreshExplorer').resolves();
        resolve = sandbox.stub(executables, 'resolveHostPathExecutable').returns({ path: process.execPath });
        resolveAzure = sandbox.stub(azureCli, 'resolveAzureCliExecutable').resolves({ executable: process.execPath, argsPrefix: [] });
        pick = sandbox.stub(vscode.window, 'showQuickPick').callsFake((async (items: readonly vscode.QuickPickItem[]) => items.find((item) => item.label === selectedLogin)) as unknown as typeof vscode.window.showQuickPick);
        info = sandbox.stub(vscode.window, 'showInformationMessage').callsFake((async (_message: string, options?: unknown) =>
            options && typeof options === 'object' && 'modal' in options ? confirmations.shift() : activation) as unknown as typeof vscode.window.showInformationMessage);
        error = sandbox.stub(vscode.window, 'showErrorMessage').resolves(undefined);
        execute = sandbox.stub(processes, 'executeCommand').callsFake(async (invocation) => {
            const args = [...invocation.args];
            temporaryFile = args[args.indexOf('--kubeconfig') + 1];
            assert.notStrictEqual(temporaryFile, target);
            assert.strictEqual(invocation.env?.KUBECONFIG, temporaryFile);
            assert.strictEqual(invocation.cwd, path.dirname(temporaryFile));
            assert.strictEqual(args[args.indexOf('--context') + 1], fixture().contexts[0].name);
            if (process.platform !== 'win32') { assert.strictEqual(fs.statSync(temporaryFile).mode & 0o777, 0o600); }
            const converted = yaml.load(fs.readFileSync(temporaryFile, 'utf8')) as FixtureConfig;
            const exec = converted.users[0].user.exec;
            exec.env = null;
            const mode = args[args.indexOf('--login') + 1];
            const loginIndex = exec.args.indexOf('--login');
            if (loginIndex >= 0) { exec.args[loginIndex + 1] = mode; }
            else { exec.args.push('--login', mode); }
            fs.writeFileSync(temporaryFile, yaml.dump(converted));
            return { code: 0, stdout: '', stderr: '' };
        });
    });

    teardown(() => {
        sandbox.restore();
        if (originalEnv === undefined) { delete process.env.KUBECONFIG; }
        else { process.env.KUBECONFIG = originalEnv; }
        fs.rmSync(directory, { recursive: true, force: true });
    });

    function saved(file = target): FixtureConfig {
        return yaml.load(fs.readFileSync(file, 'utf8')) as FixtureConfig;
    }

    test('converts only the downloaded context using literal arguments and cleans up', async () => {
        const existing = fixture('azurecli');
        existing.clusters[0].name = 'other'; existing.users[0].name = 'other-user';
        existing.contexts[0] = { name: 'other', context: { cluster: 'other', user: 'other-user' } };
        existing['current-context'] = 'other';
        fs.writeFileSync(target, yaml.dump(existing));
        await importAksKubeconfig(yaml.dump(fixture()));
        sinon.assert.calledOnce(execute);
        assert.strictEqual(saved().users.length, 2);
        assert.deepStrictEqual(saved().users[0], existing.users[0]);
        assert.ok(saved().users[1].user.exec.args.includes('azurecli'));
        assert.ok(saved().users[1].user.exec.args.includes('tenant'));
        assert.strictEqual(fs.existsSync(temporaryFile!), false);
        assert.strictEqual(fs.existsSync(target + '.vscode-k8s-tools-backup'), true);
        assert.match(String(info.firstCall.args[1].detail), /KUBECONFIG environment/);
    });

    test('offers browser login without requiring Azure CLI', async () => {
        selectedLogin = 'Web Browser'; resolveAzure.resolves(undefined);
        await importAksKubeconfig(yaml.dump(fixture()));
        assert.ok(saved().users[0].user.exec.args.includes('interactive'));
        sinon.assert.notCalled(resolveAzure);
    });

    test('preserves plugin environment values removed by the official converter', async () => {
        const input = fixture();
        input.users[0].user.exec.env = [{ name: 'CUSTOM_KEEP', value: 'retained' }, { name: 'AAD_LOGIN_METHOD', value: 'devicecode' }];
        await importAksKubeconfig(yaml.dump(input));
        assert.deepStrictEqual(saved().users[0].user.exec.env, [{ name: 'CUSTOM_KEEP', value: 'retained' }, { name: 'AAD_LOGIN_METHOD', value: 'azurecli' }]);
    });

    test('handles the implicit device-code default', async () => {
        const input = fixture(); input.users[0].user.exec.args.splice(1, 2);
        await importAksKubeconfig(yaml.dump(input));
        assert.ok(saved().users[0].user.exec.args.includes('azurecli'));
    });

    test('preserves an existing non-device-code login without running a converter', async () => {
        const input = fixture('workloadidentity');
        await importAksKubeconfig(yaml.dump(input));
        assert.deepStrictEqual(saved().users[0], input.users[0]);
        sinon.assert.notCalled(pick); sinon.assert.notCalled(execute);
    });

    test('preserves a non-device-code plugin environment override', async () => {
        const input = fixture();
        input.users[0].user.exec.env = [{ name: 'AAD_LOGIN_METHOD', value: 'interactive' }];
        await importAksKubeconfig(yaml.dump(input));
        assert.deepStrictEqual(saved().users[0], input.users[0]);
        sinon.assert.notCalled(pick); sinon.assert.notCalled(execute);
    });

    test('invalid downloaded credentials do not expose YAML or write a file', async () => {
        await importAksKubeconfig('secret-credential: [');
        await importAksKubeconfig('{}');
        assert.strictEqual(error.callCount, 2);
        assert.doesNotMatch(String(error.firstCall.args[0]), /secret-credential/);
        assert.strictEqual(fs.existsSync(target), false); sinon.assert.notCalled(pick); sinon.assert.notCalled(execute);
    });

    test('keeps device code only when explicitly selected', async () => {
        selectedLogin = 'Device Code';
        await importAksKubeconfig(yaml.dump(fixture()));
        assert.ok(saved().users[0].user.exec.args.includes('devicecode'));
        sinon.assert.notCalled(execute);
    });

    test('cancelling login or destination selection leaves files untouched', async () => {
        selectedLogin = undefined;
        await importAksKubeconfig(yaml.dump(fixture()));
        selectedLogin = 'Azure CLI'; confirmations = [undefined];
        await importAksKubeconfig(yaml.dump(fixture()));
        assert.strictEqual(fs.existsSync(target), false); sinon.assert.notCalled(execute);
    });

    test('reports missing kubelogin or Azure CLI before saving', async () => {
        resolve.returns(undefined);
        await importAksKubeconfig(yaml.dump(fixture()));
        confirmations = ['Merge'];
        resolve.returns({ path: process.execPath }); resolveAzure.resolves(undefined);
        await importAksKubeconfig(yaml.dump(fixture()));
        assert.strictEqual(error.callCount, 2); assert.strictEqual(fs.existsSync(target), false);
        sinon.assert.notCalled(execute);
    });

    test('conversion failure is redacted, cleaned up and never falls back to device code', async () => {
        execute.callsFake(async (invocation) => {
            temporaryFile = invocation.args[invocation.args.indexOf('--kubeconfig') + 1];
            return { code: 1, stdout: 'sensitive kubeconfig', stderr: 'secret token' };
        });
        await importAksKubeconfig(yaml.dump(fixture()));
        assert.strictEqual(fs.existsSync(target), false); assert.strictEqual(fs.existsSync(temporaryFile!), false);
        assert.doesNotMatch(String(error.firstCall.args[0]), /sensitive|secret token/);
        sinon.assert.calledOnce(execute);
    });

    test('rejects a converter result that still uses device code', async () => {
        execute.resolves({ code: 0, stdout: '', stderr: '' });
        await importAksKubeconfig(yaml.dump(fixture()));
        assert.strictEqual(fs.existsSync(target), false); sinon.assert.calledOnce(error);
    });

    test('a selection change during confirmation cancels before conversion', async () => {
        info.callsFake((async () => { process.env.KUBECONFIG = path.join(directory, 'changed'); return 'Merge'; }) as unknown as typeof vscode.window.showInformationMessage);
        await importAksKubeconfig(yaml.dump(fixture()));
        assert.strictEqual(fs.existsSync(target), false); sinon.assert.notCalled(execute);
    });

    test('preserves the existing WSL merge restriction', async () => {
        (config.getUseWsl as sinon.SinonStub).returns(true);
        await importAksKubeconfig(yaml.dump(fixture()));
        sinon.assert.notCalled(pick); sinon.assert.notCalled(execute); sinon.assert.calledOnce(error);
        assert.strictEqual(fs.existsSync(target), false);
    });

    test('uses the setting ahead of a multi-file environment and explains the origin', async () => {
        const ignored = target;
        process.env.KUBECONFIG = ignored + path.delimiter + path.join(directory, 'second');
        activeSetting = path.join(directory, 'setting config');
        await importAksKubeconfig(yaml.dump(fixture('azurecli')));
        assert.ok(fs.existsSync(activeSetting)); assert.strictEqual(fs.existsSync(ignored), false);
        assert.match(String(info.firstCall.args[1].detail), /VS Code kubeconfig setting/);
    });

    test('a chosen file is merged without silently making it active', async () => {
        const chosen = path.join(directory, 'chosen');
        confirmations = ['Choose Another File', 'Merge'];
        sandbox.stub(vscode.window, 'showSaveDialog').resolves(vscode.Uri.file(chosen));
        const result = await importAksKubeconfig(yaml.dump(fixture('azurecli')));
        assert.strictEqual(result, undefined); assert.strictEqual(fs.existsSync(target), false); assert.ok(fs.existsSync(chosen));
        assert.strictEqual(activeSetting, undefined);
    });

    test('returns a chosen file only after explicit post-save activation consent', async () => {
        const chosen = path.join(directory, 'chosen');
        confirmations = ['Choose Another File', 'Merge']; activation = 'Set as Active Kubeconfig';
        sandbox.stub(vscode.window, 'showSaveDialog').resolves(vscode.Uri.file(chosen));
        assert.strictEqual(await importAksKubeconfig(yaml.dump(fixture('azurecli'))), chosen);
        assert.ok(fs.existsSync(chosen));
    });

    test('a selection change during conversion cancels before any destination write', async () => {
        resolveAzure.callsFake(async () => {
            activeSetting = path.join(directory, 'changed');
            return { executable: process.execPath, argsPrefix: [] };
        });
        await importAksKubeconfig(yaml.dump(fixture()));
        assert.strictEqual(fs.existsSync(target), false); assert.strictEqual(fs.existsSync(activeSetting!), false);
        sinon.assert.calledOnce(execute);
    });
});
