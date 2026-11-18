import * as assert from 'assert';
import * as sinon from 'sinon';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { workspace } from 'vscode';
import { createServer, IncomingMessage, Server, ServerResponse } from 'http';
import { createServer as createHttpsServer } from 'https';
import { KubeConfig } from '@kubernetes/client-node';
import type { Kubectl } from '../../src/kubectl';
import * as kubeconfig from '../../src/components/kubectl/kubeconfig';
import * as wsl from '../../src/wsl';
import * as config from '../../src/components/config/config';
import { createKubernetesConnection } from '../../src/components/kubernetes/client';
import { listNamespaces, MAX_NAMESPACE_RESPONSE_BYTES } from '../../src/components/kubernetes/namespaces';

const PROXY_VARIABLES = ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy'];

function connection(server: string, user: Record<string, unknown> = { token: 'synthetic-token' }): string {
    return JSON.stringify({
        apiVersion: 'v1', kind: 'Config',
        clusters: [{ name: 'cluster', cluster: { server, 'insecure-skip-tls-verify': true } }],
        users: [{ name: 'shared-user', user }],
        contexts: [{ name: 'selected', context: { cluster: 'cluster', user: 'shared-user', namespace: 'team-a' } }],
        'current-context': 'selected',
    });
}

function respond(response: ServerResponse, names: string[], next?: string): void {
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify({ apiVersion: 'v1', kind: 'NamespaceList', metadata: { continue: next },
        items: names.map((name) => ({ metadata: { name, labels: { owner: 'team' } } })) }));
}

suite('Kubernetes client namespace reads', () => {
    let sandbox: sinon.SinonSandbox;
    let directory: string;
    let selectedPath: kubeconfig.KubeconfigPath;
    let servers: Server[];
    let execute: sinon.SinonStub;
    let kubectl: Kubectl;
    let proxyEnvironment: Map<string, string | undefined>;

    setup(() => {
        sandbox = sinon.createSandbox();
        directory = fs.mkdtempSync(path.join(os.tmpdir(), 'k8s-client-'));
        selectedPath = { pathType: 'host', hostPath: path.join(directory, 'config') };
        servers = [];
        proxyEnvironment = new Map(PROXY_VARIABLES.map((key) => [key, process.env[key]]));
        PROXY_VARIABLES.forEach((key) => delete process.env[key]);
        sandbox.stub(kubeconfig, 'getKubeconfigPath').callsFake(() => selectedPath);
        sandbox.stub(KubeConfig.prototype, 'loadFromDefault').throws(new Error('Global defaults must not be loaded'));
        execute = sandbox.stub().rejects(new Error('Unexpected kubectl lookup'));
        kubectl = { executeCommandArgs: execute } as unknown as Kubectl;
    });

    teardown(async () => {
        for (const server of servers) {
            server.closeAllConnections();
            await new Promise<void>((resolve) => server.close(() => resolve()));
        }
        sandbox.restore();
        for (const [key, value] of proxyEnvironment) {
            if (value === undefined) { delete process.env[key]; } else { process.env[key] = value; }
        }
        fs.rmSync(directory, { recursive: true, force: true });
    });

    async function listen(handler: (request: IncomingMessage, response: ServerResponse) => void): Promise<string> {
        const server = createServer((request, response) => {
            assert.strictEqual(request.method, 'GET');
            assert.strictEqual(new URL(request.url!, 'http://127.0.0.1').pathname, '/api/v1/namespaces');
            handler(request, response);
        });
        servers.push(server);
        await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
        const address = server.address();
        assert.ok(address && typeof address !== 'string');
        return `http://127.0.0.1:${address.port}`;
    }

    function writeConfig(contents: string, filename = 'config'): string {
        const file = path.join(directory, filename);
        fs.writeFileSync(file, contents);
        return file;
    }

    test('keeps paginated reads on the captured connection after selection changes', async () => {
        const cursor = 'next&=page value';
        const requests: URL[] = [];
        const other = writeConfig(connection('http://127.0.0.1:1'), 'other');
        const endpoint = await listen((request, response) => {
            assert.strictEqual(request.headers.authorization, 'Bearer synthetic-token');
            const url = new URL(request.url!, 'http://127.0.0.1');
            requests.push(url);
            selectedPath = { pathType: 'host', hostPath: other };
            respond(response, requests.length === 1 ? ['default'] : ['team-a'], requests.length === 1 ? cursor : undefined);
        });
        writeConfig(connection(endpoint));

        const result = await listNamespaces(kubectl);

        assert.ok(result.succeeded, JSON.stringify(result));
        assert.deepStrictEqual(result.result.items.map((item) => item.metadata.name), ['default', 'team-a']);
        assert.strictEqual(result.result.currentNamespace, 'team-a');
        assert.strictEqual(requests[0].searchParams.get('limit'), '500');
        assert.strictEqual(requests[1].searchParams.get('continue'), cursor);
        sinon.assert.notCalled(execute);
    });

    test('preserves first-file precedence and relative certificate paths', async () => {
        const first = JSON.parse(connection('https://first.invalid'));
        first.clusters[0].cluster['certificate-authority'] = 'ca.pem';
        first.users = [];
        const credentials = path.join(directory, 'credentials');
        fs.mkdirSync(credentials);
        const userFile = path.join(credentials, 'config');
        fs.writeFileSync(userFile, JSON.stringify({ users: [{ name: 'shared-user', user: { 'client-certificate': 'client.pem', 'client-key': 'key.pem' } }] }));
        const file = writeConfig(JSON.stringify(first));
        const empty = writeConfig('# An intentionally empty source.\n', 'empty');
        const duplicate = writeConfig(connection('https://second.invalid'), 'second');
        selectedPath = { pathType: 'host', hostPath: [path.join(directory, 'missing'), empty, file, userFile, duplicate].join(path.delimiter) };

        const result = await createKubernetesConnection();

        assert.strictEqual(result.transport, 'client');
        if (result.transport === 'client') {
            assert.strictEqual(result.config.getCurrentCluster()!.server, 'https://first.invalid');
            assert.strictEqual(result.config.getCurrentCluster()!.caFile, path.join(directory, 'ca.pem'));
            assert.strictEqual(result.config.getCurrentUser()!.certFile, path.join(credentials, 'client.pem'));
            assert.strictEqual(result.config.getCurrentUser()!.keyFile, path.join(credentials, 'key.pem'));
        }
    });

    test('uses the configured CA for anonymous HTTPS connections without weakening certificate verification', async () => {
        const fixtures = path.resolve(__dirname, '../../../test/fixtures/kubernetes-client');
        const ca = fs.readFileSync(path.join(fixtures, 'ca.crt'));
        const server = createHttpsServer({
            cert: fs.readFileSync(path.join(fixtures, 'server.crt')),
            key: fs.readFileSync(path.join(fixtures, 'server.key')),
        }, (request, response) => {
            assert.strictEqual(request.headers.authorization, undefined);
            respond(response, ['team-a']);
        });
        servers.push(server);
        await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
        const address = server.address();
        assert.ok(address && typeof address !== 'string');
        const contents = JSON.parse(connection(`https://127.0.0.1:${address.port}`));
        contents.clusters[0].cluster = { server: `https://127.0.0.1:${address.port}`, 'certificate-authority-data': ca.toString('base64') };
        delete contents.contexts[0].context.user;
        contents.users = [];
        const file = path.join(directory, 'config');

        fs.writeFileSync(path.join(directory, 'ca.pem'), ca);
        for (const authority of [{ 'certificate-authority-data': ca.toString('base64') }, { 'certificate-authority': 'ca.pem' }]) {
            contents.clusters[0].cluster = { server: `https://127.0.0.1:${address.port}`, ...authority };
            const captured = JSON.stringify(contents);
            writeConfig(captured);
            const result = await listNamespaces(kubectl);
            assert.ok(result.succeeded, JSON.stringify(result));
            assert.deepStrictEqual(result.result.items.map((item) => item.metadata.name), ['team-a']);
            assert.strictEqual(fs.readFileSync(file, 'utf8'), captured);
        }

        contents.clusters[0].cluster = { server: `https://127.0.0.1:${address.port}` };
        writeConfig(JSON.stringify(contents));
        assert.ok(!(await listNamespaces(kubectl)).succeeded);
        sinon.assert.notCalled(execute);
    });

    test('rejects an incomplete context when it is selected before loading SDK credentials or dispatching', async () => {
        const load = sandbox.spy(KubeConfig.prototype, 'loadFromString');
        const contents = JSON.parse(connection('https://example.invalid'));
        contents.contexts.push({ name: 'scratch', context: { namespace: 'other' } });
        contents['current-context'] = 'scratch';
        writeConfig(JSON.stringify(contents));

        await assert.rejects(createKubernetesConnection(), /current Kubernetes context is incomplete/);

        sinon.assert.notCalled(load);
        sinon.assert.notCalled(execute);
    });

    test('resolves relative kubeconfig paths using the same workspace directory as CLI execution', async () => {
        const file = writeConfig(connection('https://example.invalid', { exec: { command: 'helper' } }));
        selectedPath = { pathType: 'host', hostPath: path.relative(workspace.rootPath ?? process.cwd(), file) };
        execute.resolves({ code: 0, stdout: JSON.stringify({ items: [] }), stderr: '' });
        assert.ok((await listNamespaces(kubectl)).succeeded);
        assert.strictEqual(execute.firstCall.args[2].kubeconfig, file);
        assert.strictEqual(execute.firstCall.args[2].context, 'selected');
    });

    test('isolates same-named users in concurrent cluster connections', async () => {
        const files: string[] = [];
        for (const name of ['a', 'b']) {
            const endpoint = await listen((request, response) => {
                assert.strictEqual(request.headers.authorization, `Bearer synthetic-${name}`);
                respond(response, [`namespace-${name}`]);
            });
            files.push(writeConfig(connection(endpoint, { token: `synthetic-${name}` }), name));
        }
        selectedPath = { pathType: 'host', hostPath: files[0] };
        const first = listNamespaces(kubectl);
        selectedPath = { pathType: 'host', hostPath: files[1] };
        const results = await Promise.all([first, listNamespaces(kubectl)]);
        assert.deepStrictEqual(results.map((result) => result.succeeded && result.result.items[0].metadata.name), ['namespace-a', 'namespace-b']);
    });

    test('selects the safe CLI before dispatch for credential plugins and unsupported auth fields', async () => {
        const load = sandbox.spy(KubeConfig.prototype, 'loadFromString');
        execute.resolves({ code: 0, stdout: JSON.stringify({ items: [{ metadata: { name: 'team-a' } }] }), stderr: '' });
        for (const user of [
            { exec: { command: 'unapproved-helper' } },
            { 'auth-provider': { name: 'azure', config: {} } },
            { as: 'another-user', 'as-groups': ['team'] },
            { 'token-file': '/not-a-host-token-file' },
        ]) {
            writeConfig(connection('https://example.invalid', user));
            const result = await listNamespaces(kubectl);
            assert.ok(result.succeeded, JSON.stringify(result));
            assert.deepStrictEqual(execute.lastCall.args[0], ['get', 'namespaces', '-o', 'json']);
            assert.deepStrictEqual(execute.lastCall.args[2], { kubeconfig: path.join(directory, 'config'), context: 'selected', signal: undefined });
        }
        sinon.assert.notCalled(load);
    });

    test('keeps WSL configuration and authentication on the guest CLI', async () => {
        sandbox.stub(config, 'getUseWsl').returns(true);
        selectedPath = { pathType: 'wsl', wslPath: '/guest/config a:/guest/config b' };
        const read = sandbox.stub(wsl, 'execWslSync').returns({ code: 0, stdout: connection('https://guest.invalid'), stderr: '' });
        execute.resolves({ code: 0, stdout: JSON.stringify({ items: [] }), stderr: '' });

        assert.ok((await listNamespaces(kubectl)).succeeded);

        assert.deepStrictEqual(read.firstCall.args[0], ['env', 'LC_ALL=C', 'cat', '--', '/guest/config a']);
        assert.strictEqual(execute.firstCall.args[2].kubeconfig, '/guest/config a:/guest/config b');
        assert.strictEqual(execute.firstCall.args[2].context, 'selected');
    });

    test('does not move a compatibility read to another host when WSL mode changes', async () => {
        const useWsl = sandbox.stub(config, 'getUseWsl').returns(false);
        writeConfig(connection('https://example.invalid', { exec: { command: 'helper' } }));
        execute.resolves({ code: 0, stdout: JSON.stringify({ items: [] }), stderr: '' });
        const pending = listNamespaces(kubectl);
        useWsl.returns(true);
        const result = await pending;
        assert.ok(!result.succeeded && result.error[0].includes('cancelled'));
        sinon.assert.notCalled(execute);
    });

    test('does not coerce invalid context fields into a default namespace or anonymous user', async () => {
        const endpoint = await listen((_request, response) => respond(response, []));
        for (const field of ['namespace', 'user']) {
            const value = JSON.parse(connection(endpoint));
            value.contexts[0].context[field] = 0;
            writeConfig(JSON.stringify(value));
            assert.ok(!(await listNamespaces(kubectl)).succeeded);
        }
        sinon.assert.notCalled(execute);
    });

    test('retains the CLI for ambient proxy configurations before attempting HTTP', async () => {
        process.env.HTTPS_PROXY = 'http://proxy.invalid';
        writeConfig(connection('https://example.invalid'));
        execute.resolves({ code: 0, stdout: JSON.stringify({ items: [] }), stderr: '' });
        assert.ok((await listNamespaces(kubectl)).succeeded);
        sinon.assert.calledOnce(execute);
    });

    test('returns an empty result without a kubectl lookup', async () => {
        const endpoint = await listen((_request, response) => respond(response, []));
        writeConfig(connection(endpoint));
        const result = await listNamespaces(kubectl);
        assert.ok(result.succeeded);
        assert.deepStrictEqual(result.result.items, []);
        sinon.assert.notCalled(execute);
    });

    test('retains existing HTTP configurations without changing their TLS settings', async () => {
        const endpoint = await listen(() => assert.fail('This SDK-incompatible HTTP configuration must select the CLI first.'));
        const contents = JSON.parse(connection(endpoint));
        delete contents.clusters[0].cluster['insecure-skip-tls-verify'];
        writeConfig(JSON.stringify(contents));
        execute.resolves({ code: 0, stdout: JSON.stringify({ items: [] }), stderr: '' });

        assert.ok((await listNamespaces(kubectl)).succeeded);

        sinon.assert.calledOnce(execute);
        assert.strictEqual(JSON.parse(fs.readFileSync(path.join(directory, 'config'), 'utf8')).clusters[0].cluster['insecure-skip-tls-verify'], undefined);
    });

    test('distinguishes API errors without exposing response bodies or falling back to kubectl', async () => {
        let code = 401;
        const endpoint = await listen((_request, response) => {
            response.writeHead(code, { 'content-type': 'application/json' });
            response.end(JSON.stringify({ kind: 'Status', code, message: 'synthetic-private-token' }));
        });
        writeConfig(connection(endpoint));
        for (code of [401, 403, 404]) {
            const result = await listNamespaces(kubectl);
            assert.ok(!result.succeeded);
            assert.ok(result.error[0].includes(`HTTP ${code}`), result.error[0]);
            assert.ok(!result.error[0].includes('synthetic-private-token'));
        }
        sinon.assert.notCalled(execute);
    });

    test('rejects invalid names from the API and CLI', async () => {
        const endpoint = await listen((_request, response) => respond(response, ['prod;$(marker)']));
        writeConfig(connection(endpoint));
        const direct = await listNamespaces(kubectl);
        assert.ok(!direct.succeeded && direct.error[0].includes('invalid namespace'));
        writeConfig(connection(endpoint, { exec: { command: 'helper' } }));
        execute.resolves({ code: 0, stdout: JSON.stringify({ items: [{ metadata: { name: 'prod;$(marker)' } }] }), stderr: '' });
        const cli = await listNamespaces(kubectl);
        assert.ok(!cli.succeeded && cli.error[0].includes('invalid namespace'));
    });

    test('rejects malformed lists and repeated continuation tokens', async () => {
        let malformed = true;
        const endpoint = await listen((_request, response) => {
            if (malformed) { response.setHeader('content-type', 'application/json'); response.end('{"items":null}'); }
            else { respond(response, ['default'], 'repeated'); }
        });
        writeConfig(connection(endpoint));
        assert.ok(!(await listNamespaces(kubectl)).succeeded);
        malformed = false;
        const result = await listNamespaces(kubectl);
        assert.ok(!result.succeeded && result.error[0].includes('pagination'));
    });

    test('does not resolve configuration or launch commands for an already-cancelled read', async () => {
        const cancellation = new AbortController();
        cancellation.abort();
        const result = await listNamespaces(kubectl, cancellation.signal);
        assert.ok(!result.succeeded && result.error[0].includes('cancelled'));
        sinon.assert.notCalled(kubeconfig.getKubeconfigPath as sinon.SinonStub);
        sinon.assert.notCalled(execute);
    });

    test('cancels a pending API response', async () => {
        let started!: () => void;
        const pending = new Promise<void>((resolve) => { started = resolve; });
        const endpoint = await listen(() => started());
        writeConfig(connection(endpoint));
        const cancellation = new AbortController();
        const result = listNamespaces(kubectl, cancellation.signal);
        await pending;
        cancellation.abort();
        const completed = await result;
        assert.ok(!completed.succeeded && completed.error[0].includes('cancelled'));
    });

    test('times out a pending API read', async () => {
        let started!: () => void;
        const pending = new Promise<void>((resolve) => { started = resolve; });
        const endpoint = await listen(() => started());
        writeConfig(connection(endpoint));
        const deadline = new AbortController();
        sandbox.stub(AbortSignal, 'timeout').returns(deadline.signal);
        const result = listNamespaces(kubectl);
        await pending;
        deadline.abort();
        const completed = await result;
        assert.ok(!completed.succeeded && completed.error[0].includes('timed out'));
    });

    test('bounds each response before JSON deserialization', async () => {
        const endpoint = await listen((_request, response) => {
            response.writeHead(200, { 'content-type': 'application/json' });
            response.end(Buffer.alloc(MAX_NAMESPACE_RESPONSE_BYTES + 1, ' '));
        });
        writeConfig(connection(endpoint));
        const result = await listNamespaces(kubectl);
        assert.ok(!result.succeeded && result.error[0].includes('20 MiB'));
    });

    test('shares the response-size budget across namespace pages', async () => {
        const padding = 'x'.repeat(11 * 1024 * 1024);
        let requests = 0;
        const endpoint = await listen((_request, response) => {
            requests++;
            response.setHeader('content-type', 'application/json');
            response.end(JSON.stringify({ items: [{ metadata: { name: 'default' } }], metadata: { continue: requests === 1 ? 'next' : undefined }, padding }));
        });
        writeConfig(connection(endpoint));
        const result = await listNamespaces(kubectl);
        assert.ok(!result.succeeded && result.error[0].includes('20 MiB'));
        assert.strictEqual(requests, 2);
    });

    test('does not accept partial CLI output after signal termination', async () => {
        writeConfig(connection('https://example.invalid', { exec: { command: 'helper' } }));
        execute.resolves({ code: -1, signal: 'SIGTERM', stdout: JSON.stringify({ items: [] }), stderr: '' });
        assert.ok(!(await listNamespaces(kubectl)).succeeded);
    });

    test('redacts malformed kubeconfig contents', async () => {
        writeConfig('users: [synthetic-private-token');
        const result = await listNamespaces(kubectl);
        assert.ok(!result.succeeded && !result.error[0].includes('synthetic-private-token'));
        sinon.assert.notCalled(execute);
    });
});
