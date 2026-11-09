import * as assert from 'assert';
import * as querystring from 'querystring';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as config from '../../src/components/config/config';
import { Host } from '../../src/host';
import { Kubectl } from '../../src/kubectl';
import { KubernetesResourceLinkProvider } from '../../src/kuberesources.linkprovider';
import { kubefsUri, KubernetesResourceVirtualFileSystemProvider } from '../../src/kuberesources.virtualfs';
import '../../src/utils/array';

const references = ['pvc/app-data', 'cm/app-config', 'secrets/db-creds'];

suite('Resource reference link namespaces', () => {
    let sandbox: sinon.SinonSandbox;
    setup(() => { sandbox = sinon.createSandbox(); });
    teardown(() => sandbox.restore());

    test('keeps Deployment references in the namespace being viewed rather than the current context', async () => {
        sandbox.stub(config, 'getOutputFormat').returns('yaml');
        const links = await resourceLinks(deployment('prod'), 'prod');
        const invoke = sandbox.stub().resolves({ resultKind: 'exec-succeeded', stdout: 'resource content' });
        const provider = new KubernetesResourceVirtualFileSystemProvider(
            { invokeCommandArgsWithFeedback: invoke } as unknown as Kubectl,
            { showErrorMessage: sandbox.stub().resolves(undefined) } as unknown as Host);

        for (const reference of references) {
            invoke.resetHistory();
            const link = links.find((candidate) => querystring.parse(candidate.target!.query).value === reference);
            assert.ok(link?.target);

            assert.strictEqual(await provider.loadResource(link.target), 'resource content');

            sinon.assert.calledOnceWithExactly(invoke, ['get', reference, '-o', 'yaml', '--namespace', 'prod'], `Loading ${reference}...`);
        }
    });

    test('keeps the document URI namespace authoritative when response metadata disagrees', async () => {
        const links = await resourceLinks(deployment('different'), 'prod');

        for (const reference of references) {
            const link = links.find((candidate) => querystring.parse(candidate.target!.query).value === reference);
            assert.ok(link?.target);
            assert.strictEqual(querystring.parse(link.target.query).ns, 'prod');
        }
    });

    test('retains the existing default lookup when the source URI has no namespace', async () => {
        const links = await resourceLinks(deployment('prod'), undefined);

        for (const reference of references) {
            const link = links.find((candidate) => querystring.parse(candidate.target!.query).value === reference);
            assert.ok(link?.target);
            assert.strictEqual(querystring.parse(link.target.query).ns, undefined);
        }
    });

    test('does not turn a malformed namespace into a default-context reference', async () => {
        const base = kubefsUri('prod', 'deployment/web', 'yaml');
        for (const query of [base.query + '&ns=dev', base.query.replace('ns=prod', 'ns=bad%3Bvalue')]) {
            const links = await resourceLinks(deployment('prod'), 'prod', 'deployment/web', base.with({ query }));
            assert.strictEqual(links.some((link) => references.includes(querystring.parse(link.target!.query).value as string)), false);
        }
    });

    test('keeps cluster-scoped targets and explicit PV claim namespaces unchanged', async () => {
        const text = 'apiVersion: v1\nkind: PersistentVolume\nmetadata:\n  name: data\nspec:\n  storageClassName: standard\n  claimRef:\n    name: app-data\n    namespace: workload\n';
        const links = await resourceLinks(text, 'source', 'pv/data');
        const queries = links.map((link) => querystring.parse(link.target!.query));

        assert.strictEqual(queries.find((query) => query.value === 'sc/standard')?.ns, undefined);
        assert.strictEqual(queries.find((query) => query.value === 'pvc/app-data')?.ns, 'workload');
    });
});

let documentVersion = 0;

async function resourceLinks(text: string, namespace: string | undefined, target = 'deployment/web', uri = kubefsUri(namespace, target, 'yaml')): Promise<vscode.DocumentLink[]> {
    const document = {
        uri,
        version: ++documentVersion,
        getText: () => text,
        positionAt: (offset: number) => {
            const lines = text.slice(0, offset).split('\n');
            return new vscode.Position(lines.length - 1, lines[lines.length - 1].length);
        },
    } as vscode.TextDocument;
    return await Promise.resolve(new KubernetesResourceLinkProvider().provideDocumentLinks(document, {} as vscode.CancellationToken)) || [];
}

function deployment(namespace: string): string {
    return [
        'apiVersion: apps/v1', 'kind: Deployment', 'metadata:', '  name: web', `  namespace: ${namespace}`,
        'spec:', '  template:', '    spec:', '      volumes:',
        '        - name: data', '          persistentVolumeClaim:', '            claimName: app-data',
        '        - name: config', '          configMap:', '            name: app-config',
        '      containers:', '        - name: web', '          image: fixture.invalid/web',
        '          env:', '            - name: DB_PASSWORD', '              valueFrom:',
        '                secretKeyRef:', '                  name: db-creds', '                  key: password',
    ].join('\n');
}
