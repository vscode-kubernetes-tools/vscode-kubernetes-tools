/*

// This file is currently commented out to avoid causing spurious warnings for the
// extension.  It will in time be moved to a samples repo.

import * as vscode from 'vscode';
import * as k8s from 'vscode-kubernetes-tools-api';
import { ClusterProviderV1 as cp } from 'vscode-kubernetes-tools-api';
import * as contosocloud from 'contoso-cloud-client';

const CONTOSO_PROVIDER_ID = 'contoso';

export async function activate(context: vscode.ExtensionContext) {
    const cpapi = await k8s.extension.clusterProvider.v1;

    if (!cpapi.available) {
        console.log("Unable to register provider: " + cpapi.reason);
        return;
    }

    cpapi.api.register({
        id: CONTOSO_PROVIDER_ID,
        displayName: 'Contoso Kubernetes Platform',
        supportedActions: ['configure', 'create'],
        next: next
    });
}

const REGION_STEP_ID = 'region';
const NAME_STEP_ID = 'name';

function next(wizard: cp.Wizard, action: cp.ClusterProviderAction, message: any): void {
    wizard.showPage('<h1>Please wait... contacting cloud');
    if (action === 'configure') {
        nextConfigureStep(wizard, message);
    } else {
        nextCreateStep(wizard, message);
    }
    if (message[cp.SENDING_STEP_KEY] === cp.SELECT_CLUSTER_TYPE_STEP_ID) {
        wizard.showPage(`<h1>You selected ${action} and I obey!!!!</h1>
        <p><pre>${JSON.stringify(message, undefined, 2)}</pre></p>
        <p><form id='${cp.WIZARD_FORM_NAME}'>
        <input type='hidden' name='clusterType' value='faux' />
        Something: <input type='text' name='something' />
        <p><button onclick='${cp.NEXT_PAGE}'>MAKE IT SO &gt;</button></p>
        </form><p>
        `);
    } else {
        wizard.showPage(`<h1>My work here is done</h1>
        <p><pre>${JSON.stringify(message, undefined, 2)}</pre></p>
        `);
    }
}

function nextConfigureStep(wizard: cp.Wizard, message: any): Promise<string> {
    switch (message[cp.SENDING_STEP_KEY]) {
        case cp.SELECT_CLUSTER_TYPE_STEP_ID:
            return promptForRegion("Which region is the cluster in?");
        case cp.REGION_STEP_ID:
            return promptForClusterName(message);
        case cp.NAME_STEP_ID:
            return addCluster(message);
    }
}

function nextCreateStep(wizard: cp.Wizard, message: any): Promise<string> {
    switch (message[cp.SENDING_STEP_KEY]) {
        case cp.SELECT_CLUSTER_TYPE_STEP_ID:
            return promptForRegion("Which region do you want to create the cluster in?");
        case cp.REGION_STEP_ID:
            return promptForClusterSettings(message);
        case cp.NAME_STEP_ID:
            return createCluster(message);
    }
}

async function promptForRegion(prompt: string): Promise<string> {
    const regions = await contosocloud.listRegions();
    const regionOptions = regions.map((r) => `<option value="${r.id}">${r.name}</option>`).join('\n');
    const regionSelector = `<select name='region'>${regionOptions}</select>`;
    const html = `<h1>Choose region</h1>
        <p>${prompt}</p>
        <form id='${cp.WIZARD_FORM_NAME}'>
            <input type='hidden' name='${cp.SENDING_STEP_KEY}' value='${REGION_STEP_ID}' />
            <input type='hidden' name='${cp.CLUSTER_TYPE_KEY}' value='${CONTOSO_PROVIDER_ID}' />
            <p>Region: ${regionSelector}</p>
            <button onclick='${cp.NEXT_PAGE}'>Next &gt;</button>
        </form>
        `;
    return html;
}

async function promptForClusterName(previousData: any): Promise<string> {
    const clusters = await contosocloud.listClusters(previousData.region);
    const clusterOptions = clusters.map((c) => `<option value="${c.clusterId}">${c.name}</option>`).join('\n');
    const clusterSelector = `<select name='cluster'>${clusterOptions}</select>`;
    const html = `<h1>Choose cluster</h1>
        <p>Which cluster do you want to add to kubeconfig?</p>
        <form id='${cp.WIZARD_FORM_NAME}'>
            <input type='hidden' name='${cp.SENDING_STEP_KEY}' value='${NAME_STEP_ID}' />
            <input type='hidden' name='${cp.CLUSTER_TYPE_KEY}' value='${CONTOSO_PROVIDER_ID}' />
            <input type='hidden' name='region' value='${previousData.region}' />
            <p>Cluster: ${clusterSelector}</p>
            <button onclick='${cp.NEXT_PAGE}'>Add &gt;</button>
        </form>
        `;
    return html;
}

async function addCluster(previousData: any): Promise<string> {
    const result = await contosocloud.addClusterToKubeconfig(previousData.region, previousData.cluster);
    if (result.succeeded) {
        return '<h1>Cluster added</h1><p>Refresh Cluster Explorer to see it</p>';
    }
    return `<h1>Error adding cluster</h1><p>Details: ${result.error}</p>`;
}

async function promptForClusterSettings(previousData: any): Promise<string> {
    const nodeSizes = await contosocloud.listNodeSizes();
    const nodeSizeOptions = nodeSizes.map((s) => `<option value="${s.id}">${s.id}</option>`).join('\n');
    const nodeSizeSelector = `<select name='nodeSize'>${nodeSizeOptions}</select>`;
    const html = `<h1>Choose cluster</h1>
        <p>Which cluster do you want to add to kubeconfig?</p>
        <form id='${cp.WIZARD_FORM_NAME}'>
            <input type='hidden' name='${cp.SENDING_STEP_KEY}' value='${NAME_STEP_ID}' />
            <input type='hidden' name='${cp.CLUSTER_TYPE_KEY}' value='${CONTOSO_PROVIDER_ID}' />
            <input type='hidden' name='region' value='${previousData.region}' />
            <p>Cluster name: <input type='text' name='clusterName' /></p>
            <p>Node size: ${nodeSizeSelector}</p>
            <button onclick='${cp.NEXT_PAGE}'>Create &gt;</button>
        </form>
        `;
    return html;
}

async function createCluster(previousData: any): Promise<string> {
    const result = await contosocloud.createCluster(previousData.region, previousData.name, previousData.nodeSize);
    if (result.succeeded) {
        return '<h1>Cluster created</h1><p>It may take a couple of minutes to become ready</p>';
    }
    return `<h1>Error creating cluster</h1><p>Details: ${result.error}</p>`;
}
*/
