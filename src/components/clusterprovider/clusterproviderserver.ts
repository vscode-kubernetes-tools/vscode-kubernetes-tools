import * as clusterproviderregistry from './clusterproviderregistry';
import { styles, formStyles } from '../../wizard';
import { reporter } from '../../telemetry';
import { NEXT_FN, Wizard, createWizard, Subscriber } from '../wizard/wizard';

export const SENDING_STEP_KEY = 'sendingStep';

const SELECT_CLUSTER_TYPE = 'selectClusterType';

function subscriber(action: clusterproviderregistry.ClusterProviderAction): Subscriber {
    return {
        onCancel(): void {
        },
        onStep(w: Wizard, m: any): void {
            const clusterType: string = m.clusterType;
            if (m[SENDING_STEP_KEY] === SELECT_CLUSTER_TYPE) {
                if (reporter) {
                    reporter.sendTelemetryEvent("cloudselection", { action: action, clusterType: clusterType });
                }
            }
            const cp = clusterproviderregistry.get().list().find((cp) => cp.id === clusterType);
            if (cp) {
                cp.next(w, action, m);
            }
        }
    };
}

export function runClusterWizard(tabTitle: string, action: clusterproviderregistry.ClusterProviderAction) {
    const wizard = createWizard(tabTitle, 'form', subscriber(action));
    const html = handleGetProviderListHtml(action);
    wizard.showPage(html);
}

function handleGetProviderListHtml(action: clusterproviderregistry.ClusterProviderAction): string {
    const clusterTypes = clusterproviderregistry.get().list().filter((cp) => cp.supportedActions.indexOf(action) >= 0);

    if (clusterTypes.length === 0) {
        return `<html><body><h1 id='h'>No suitable providers</h1>
            <style id='styleholder'>
            </style>
            ${styles()}
            <div id='content'>
            <p>There aren't any providers loaded that support this command.
            You could try looking for Kubernetes providers in the Visual Studio
            Code Marketplace.</p>
            </div></body></html>`;
    }

    // const initialUri = `http://localhost:${cpPort}/?action=${action}&clusterType=${clusterTypes[0].id}`;
    const options = clusterTypes.map((cp) => `<option value="${cp.id}">${cp.displayName}</option>`).join('\n');

    const otherClustersInfo = action === 'configure' ? `
    <p>
    If your type of cluster isn't listed here, don't worry. Just add it to your
    kubeconfig file normally (see your cloud or cluster documentation), and it will show
    up in Visual Studio Code automatically. If you're using multiple kubeconfig files,
    you may need to change the <b>vs-kubernetes &gt; vs-kubernetes.kubeconfig</b> setting
    to refer to the right file.
    </p>
    ` : `
    <p>
    If your type of cluster isn't listed here, don't worry. Just create it normally
    (see your cloud or cluster documentation) and add it to your kubeconfig file, and it will show
    up in Visual Studio Code automatically. If you're using multiple kubeconfig files,
    you may need to change the <b>vs-kubernetes &gt; vs-kubernetes.kubeconfig</b> setting
    to refer to the right file.
    </p>
    `;

    const html = `<html><body>
            ${formStyles()}
            ${styles()}
            <h1 id='h'>Choose cluster type</h1>
            <div id='content'>
            <form id='form'>
            <input type='hidden' name='${SENDING_STEP_KEY}' value='${SELECT_CLUSTER_TYPE}' />
            <input type='hidden' name='action' value='${action}' />
            <p>
            Cluster type: <select name='clusterType'>
            ${options}
            </select>
            </p>
            </form>

            <p>
            <button onclick='${NEXT_FN}' class='link-button'>Next &gt;</button>
            </p>

            ${otherClustersInfo}

            </div></body></html>`;

    return html;
}
