import * as restify from 'restify';
import * as clusterproviderregistry from '../clusterproviderregistry';
import * as azure from '../../../azure';

let clusterServer : restify.Server;
const clusterPort = 44011;
let context : azure.Context;

export function init(registry: clusterproviderregistry.ClusterProviderRegistry, ctx: azure.Context) {
    if (!clusterServer) {
        clusterServer = restify.createServer({
            formatters: {
                'text/html': (req, resp, body) => body
            }
        });
        
        clusterServer.use(restify.plugins.queryParser());
        clusterServer.listen(clusterPort);
        clusterServer.get('/create', handleCreate);
    
        registry.register({id: 'acs', displayName: "Azure Container Service", port: clusterPort});
        registry.register({id: 'aks', displayName: "Azure Kubernetes Service", port: clusterPort});

        context = ctx;
    }
}

async function handleCreate(request: restify.Request, response: restify.Response, next: restify.Next) {

    const html = await getHandleCreateHtml(request);

    response.contentType = 'text/html';
    response.send(html);
    
    next();
}

async function getHandleCreateHtml(request: restify.Request): Promise<string> {
    const id: string = request.query["id"];
    const subscription: string = request.query["subscription"];

    if (id && !subscription) {

        const mklink = (sub: string) => encodeURI(`http://localhost:${clusterPort}/create?id=${id}&subscription=${sub}`);

        const slr = await azure.getSubscriptionList(context, id);
        if (!slr.result.succeeded) {
            return `<h1>Error ${slr.actionDescription}</h1><p>Error details: ${slr.result.error[0]}</p>`;
        }

        const subscriptions : string[] = slr.result.result;

        if (!subscriptions || !subscriptions.length) {
            return `<h1>You have no Azure subscriptions</h1>`;
        }

        const initialUri = mklink(subscriptions[0]);
        const options = subscriptions.map((s) => `<option value="${mklink(s)}">${s}</option>`).join('\n');
        return `<!-- PromptForSubscription -->
                <html><body>
                <style id='styleholder'>
                </style>
                <script>
                function selectionChanged() {
                    var selectCtrl = document.getElementById('selector');
                    var selection = selectCtrl.options[selectCtrl.selectedIndex].value;
                    document.getElementById('nextlink').href = selection;
                }
                </script>
                <h1 id='h'>Choose subscription</h1>
                <div id='content'>
                <p>
                Azure subscription: <select id='selector' onchange='selectionChanged()'>
                ${options}
                </select>
                </p>

                <p><b>Important! The selected subscription will be set as the active subscription for the Azure CLI.</b></p>

                <p>
                <a id='nextlink' href='${initialUri}'>Next &gt;</a>
                </p>
                </body></html>`;
    } else if (id && subscription) {
        return `<h1>You chose ${subscription}</h1>`;
    }
}
