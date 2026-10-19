import * as assert from 'assert';
import {
    isSafeOpaqueIdentifier,
    isValidConfigDataKey,
    isValidContainerName,
    isValidDns1123Subdomain,
    isValidKubeconfigName,
    isValidKubernetesResourceName,
    isValidKubernetesVersion,
    isValidNamespaceName,
    isValidOpaqueResourceReference,
    isValidKubernetesResourceType,
    kubernetesLabelSelectorToString,
    sanitizeForDisplay,
} from '../../../src/utils/kubernetes-identifiers';

suite('Kubernetes identifier validation', () => {
    test('validates DNS identifiers with the correct field limits', () => {
        assert.strictEqual(isValidNamespaceName('team-1'), true);
        assert.strictEqual(isValidNamespaceName('team.one'), false);
        assert.strictEqual(isValidContainerName('app-1'), true);
        assert.strictEqual(isValidKubernetesResourceName('api.team.example'), true);
        assert.strictEqual(isValidDns1123Subdomain(`${'a'.repeat(64)}.example`), true);
        assert.strictEqual(isValidKubernetesResourceName('pod;marker'), false);
        assert.strictEqual(isValidKubernetesResourceType('deployments.apps'), true);
    });

    test('allows valid generic path-segment names without allowing controls or options', () => {
        assert.strictEqual(isSafeOpaqueIdentifier('team:reader'), true);
        assert.strictEqual(isSafeOpaqueIdentifier('-team-reader'), true);
        assert.strictEqual(isSafeOpaqueIdentifier('a'.repeat(300)), true);
        assert.strictEqual(isValidOpaqueResourceReference('roles/team:reader'), true);
        assert.strictEqual(isSafeOpaqueIdentifier('name/other'), false);
        assert.strictEqual(isSafeOpaqueIdentifier('name%2fother'), false);
        assert.strictEqual(isSafeOpaqueIdentifier('name\nmarker'), false);
    });

    test('keeps kubeconfig names permissive but rejects controls', () => {
        assert.strictEqual(isValidKubeconfigName('context with spaces & $() %PATH%'), true);
        assert.strictEqual(isValidKubeconfigName('context\nmarker'), false);
        assert.strictEqual(isValidKubeconfigName(''), false);
    });

    test('rejects reserved ConfigMap path keys', () => {
        assert.strictEqual(isValidConfigDataKey('app.properties'), true);
        assert.strictEqual(isValidConfigDataKey('.'), false);
        assert.strictEqual(isValidConfigDataKey('..'), false);
        assert.strictEqual(isValidConfigDataKey('..data'), false);
    });

    test('renders matchExpressions without broadening the selector', () => {
        assert.strictEqual(kubernetesLabelSelectorToString({
            matchLabels: { app: 'api' },
            matchExpressions: [
                { key: 'tier', operator: 'In', values: ['frontend', 'edge'] },
                { key: 'debug', operator: 'DoesNotExist', values: [] },
            ],
        }), 'app=api,tier in (frontend,edge),!debug');
    });

    test('validates cluster-selected versions and sanitizes display text', () => {
        assert.strictEqual(isValidKubernetesVersion('v1.30.1-alpha.1+build.7'), true);
        assert.strictEqual(isValidKubernetesVersion('v1.30.1/../../marker'), false);
        assert.strictEqual(sanitizeForDisplay('safe\nname\u202e'), 'safe?name?');
    });
});
