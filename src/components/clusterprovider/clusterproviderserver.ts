import * as restify from 'restify';
import * as clusterproviderregistry from './clusterproviderregistry';
import { styles, script, waitScript } from '../../wizard';

let cpServer : restify.Server;
const cpPort = 44010;

export function init() : void {
    if (!cpServer) {
        cpServer = restify.createServer({
            formatters: {
                'text/html': (req, resp, body) => body
            }
        });

        cpServer.use(restify.plugins.queryParser());
        cpServer.listen(cpPort);
        cpServer.get('/', handleGetProviderList);
    }
}

export function url(action: clusterproviderregistry.ClusterProviderAction) : string {
    return `http://localhost:${cpPort}/?action=${action}`;
}

function handleGetProviderList(request: restify.Request, response: restify.Response, next: restify.Next) : void {
    const action = request.query["action"];

    const html = handleGetProviderListHtml(action);

    response.contentType = 'text/html';
    response.send(html);
    next();
}

function handleGetProviderListHtml(action: clusterproviderregistry.ClusterProviderAction) : string {
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

    const initialUri = `http://localhost:${clusterTypes[0].port}/${action}?clusterType=${clusterTypes[0].id}`;
    const options = clusterTypes.map((cp) => `<option value="http://localhost:${cp.port}/${action}?clusterType=${cp.id}">${cp.displayName}</option>`).join('\n');

    const selectionChangedScript = script(`
    function selectionChanged() {
        var selectCtrl = document.getElementById('selector');
        var selection = selectCtrl.options[selectCtrl.selectedIndex].value;
        document.getElementById('nextlink').href = selection;
    }
    `);
    
    const html = `<html><body><h1 id='h'>Choose cluster type</h1>
            <style id='styleholder'>
            </style>
            ${styles()}
            ${selectionChangedScript}
            ${waitScript('Loading provider')}
            <div id='content'>
            <p>
            Cluster type: <select id='selector' onchange='selectionChanged()'>
            ${options}
            </select>
            </p>

            <p>
            <a id='nextlink' href='${initialUri}' onclick='promptWait()'>Next &gt;</a>
            </p>
            </div></body></html>`;

    return html;
}
