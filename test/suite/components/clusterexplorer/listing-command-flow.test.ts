import * as assert from 'assert';
import * as sinon from 'sinon';
import { ResourceFolderNode } from '../../../../src/components/clusterexplorer/node.folder.resource';
import { NODE_TYPES } from '../../../../src/components/clusterexplorer/explorer';
import { ClusterExplorerResourceNode } from '../../../../src/components/clusterexplorer/node';
import { ResourceKind } from '../../../../src/kuberesources';
import { Kubectl } from '../../../../src/kubectl';
import { Host } from '../../../../src/host';
import { getResourceArgs } from '../../../../src/components/kubectl/resource-commands';
import { INVALID_KUBERNETES_IDENTIFIER_MESSAGE } from '../../../../src/utils/kubernetes-identifiers';

suite('Listing to command flow', () => {
    test('keeps a listed name as data through node selection and Get arguments', async () => {
        const asLines = sinon.stub().resolves({ succeeded: true, result: ['team:reader;$(marker)& team-a'] });
        const kubectl = { asLines } as unknown as Kubectl;
        const showErrorMessage = sinon.stub().resolves(undefined);
        const host = { showErrorMessage } as unknown as Host;
        const kind = new ResourceKind('Role', 'Roles', 'Role', 'roles', 'roles');

        const children = await ResourceFolderNode.create(kind).getChildren(kubectl, host);

        sinon.assert.calledOnceWithExactly(asLines, [
            'get', 'roles', '-o',
            'custom-columns=NAME:.metadata.name,NAMESPACE:.metadata.namespace'
        ]);
        assert.strictEqual(children.length, 1);
        const node = children[0] as ClusterExplorerResourceNode;
        assert.strictEqual(node.name, 'team:reader;$(marker)&');
        assert.strictEqual(node.namespace, 'team-a');
        assert.strictEqual(node.kindName, 'roles/team:reader;$(marker)&');
        assert.deepStrictEqual(getResourceArgs(node.kindName, node.namespace), [
            'get', 'roles/team:reader;$(marker)&', '--namespace', 'team-a', '-o', 'wide'
        ]);
        sinon.assert.notCalled(showErrorMessage);
    });

    test('rejects a hostile listing before creating a selectable resource node', async () => {
        const asLines = sinon.stub().resolves({ succeeded: true, result: ['api%2fmarker team-a'] });
        const kubectl = { asLines } as unknown as Kubectl;
        const showErrorMessage = sinon.stub().resolves(undefined);
        const host = { showErrorMessage } as unknown as Host;
        const kind = new ResourceKind('Role', 'Roles', 'Role', 'roles', 'roles');

        const children = await ResourceFolderNode.create(kind).getChildren(kubectl, host);

        assert.strictEqual(children.length, 1);
        assert.strictEqual(children[0].nodeType, NODE_TYPES.error);
        sinon.assert.calledOnceWithExactly(showErrorMessage, INVALID_KUBERNETES_IDENTIFIER_MESSAGE);
    });
});
