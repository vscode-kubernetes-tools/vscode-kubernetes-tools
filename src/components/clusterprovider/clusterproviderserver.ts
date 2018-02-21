import * as restify from 'restify';
import * as clusterproviderregistry from './clusterproviderregistry';
import { styles, script } from '../../wizard';

let cpServer : restify.Server;
const cpPort = 44010;

export function init() {
    if (!cpServer) {
        cpServer = restify.createServer({
            formatters: {
                'text/html': (req, resp, body) => body
            }
        });

        cpServer.use(restify.plugins.queryParser());
        cpServer.listen(cpPort);
        cpServer.get('/', handleGetProviderListHtml);
    }
}

function handleGetProviderListHtml(request: restify.Request, response: restify.Response, next: restify.Next) {
    const clusterTypes = clusterproviderregistry.get().list();
    const initialUri = `http://localhost:${clusterTypes[0].port}/create?id=${clusterTypes[0].id}`;
    const options = clusterTypes.map((cp) => `<option value="http://localhost:${cp.port}/create?id=${cp.id}">${cp.displayName}</option>`).join('\n');

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
            <div id='content'>
            <p>
            Cluster type: <select id='selector' onchange='selectionChanged()'>
            ${options}
            </select>
            </p>

            <p>
            <a id='nextlink' href='${initialUri}'>Next &gt;</a>
            </p>
            </div></body></html>`;

    response.contentType = 'text/html';
    response.send(html);
    next();
}
