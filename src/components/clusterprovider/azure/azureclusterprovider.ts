import * as restify from 'restify';
import * as clusterproviderregistry from '../clusterproviderregistry';

const clusterServer = restify.createServer();
const clusterPort = 44011;
    
export function init(registry: clusterproviderregistry.ClusterProviderRegistry) {
    clusterServer.use(restify.plugins.queryParser());
    clusterServer.listen(clusterPort);
    clusterServer.get('/create', handleCreate);

    registry.register({id: 'acs', displayName: "Azure Container Service", port: clusterPort});
    registry.register({id: 'aks', displayName: "Azure Kubernetes Service", port: clusterPort});

}

function handleCreate(request: restify.Request, response: restify.Response, next: restify.Next) {
    response.send("not a real response");
    next();
}
