/* eslint-disable quote-props */
/* tslint:disable:object-literal-key-quotes */
/* tslint:disable:semicolon */

// v1.ts provides minimal support for kinds if the Kubernetes schema files
// have not been downloaded by kubectl.
export default {
  "swaggerVersion": "1.2",
  "apiVersion": "v1",
  "basePath": "https://10.10.10.10:6443",
  "resourcePath": "/api/v1",
  "info": {
   "title": "",
   "description": ""
  },
  "apis": [
   {
    "path": "/api/v1/namespaces/{namespace}/bindings",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.Binding",
      "method": "POST",
      "summary": "create a Binding",
      "nickname": "createNamespacedBinding",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "v1.Binding",
        "paramType": "body",
        "name": "body",
        "description": "",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.Binding"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/componentstatuses",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.ComponentStatusList",
      "method": "GET",
      "summary": "list objects of kind ComponentStatus",
      "nickname": "listComponentStatus",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "labelSelector",
        "description": "A selector to restrict the list of returned objects by their labels. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "fieldSelector",
        "description": "A selector to restrict the list of returned objects by their fields. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "watch",
        "description": "Watch for changes to the described resources and return them as a stream of add, update, and remove notifications. Specify resourceVersion.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "resourceVersion",
        "description": "When specified with a watch call, shows changes that occur after that particular version of a resource. Defaults to changes from the beginning of history. When specified for list: - if unset, then the result is returned from remote storage based on quorum-read flag; - if it's 0, then we simply return what we currently have in cache, no guarantee; - if set to non zero, then the result is at least as fresh as given rv.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "timeoutSeconds",
        "description": "Timeout for the list/watch call.",
        "required": false,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.ComponentStatusList"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf",
       "application/json;stream=watch",
       "application/vnd.kubernetes.protobuf;stream=watch"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/componentstatuses/{name}",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.ComponentStatus",
      "method": "GET",
      "summary": "read the specified ComponentStatus",
      "nickname": "readComponentStatus",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the ComponentStatus",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.ComponentStatus"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/namespaces/{namespace}/configmaps",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.ConfigMapList",
      "method": "GET",
      "summary": "list or watch objects of kind ConfigMap",
      "nickname": "listNamespacedConfigMap",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "labelSelector",
        "description": "A selector to restrict the list of returned objects by their labels. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "fieldSelector",
        "description": "A selector to restrict the list of returned objects by their fields. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "watch",
        "description": "Watch for changes to the described resources and return them as a stream of add, update, and remove notifications. Specify resourceVersion.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "resourceVersion",
        "description": "When specified with a watch call, shows changes that occur after that particular version of a resource. Defaults to changes from the beginning of history. When specified for list: - if unset, then the result is returned from remote storage based on quorum-read flag; - if it's 0, then we simply return what we currently have in cache, no guarantee; - if set to non zero, then the result is at least as fresh as given rv.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "timeoutSeconds",
        "description": "Timeout for the list/watch call.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.ConfigMapList"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf",
       "application/json;stream=watch",
       "application/vnd.kubernetes.protobuf;stream=watch"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "v1.ConfigMap",
      "method": "POST",
      "summary": "create a ConfigMap",
      "nickname": "createNamespacedConfigMap",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "v1.ConfigMap",
        "paramType": "body",
        "name": "body",
        "description": "",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.ConfigMap"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "v1.Status",
      "method": "DELETE",
      "summary": "delete collection of ConfigMap",
      "nickname": "deletecollectionNamespacedConfigMap",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "labelSelector",
        "description": "A selector to restrict the list of returned objects by their labels. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "fieldSelector",
        "description": "A selector to restrict the list of returned objects by their fields. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "watch",
        "description": "Watch for changes to the described resources and return them as a stream of add, update, and remove notifications. Specify resourceVersion.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "resourceVersion",
        "description": "When specified with a watch call, shows changes that occur after that particular version of a resource. Defaults to changes from the beginning of history. When specified for list: - if unset, then the result is returned from remote storage based on quorum-read flag; - if it's 0, then we simply return what we currently have in cache, no guarantee; - if set to non zero, then the result is at least as fresh as given rv.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "timeoutSeconds",
        "description": "Timeout for the list/watch call.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.Status"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/watch/namespaces/{namespace}/configmaps",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.WatchEvent",
      "method": "GET",
      "summary": "watch individual changes to a list of ConfigMap",
      "nickname": "watchNamespacedConfigMapList",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "labelSelector",
        "description": "A selector to restrict the list of returned objects by their labels. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "fieldSelector",
        "description": "A selector to restrict the list of returned objects by their fields. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "watch",
        "description": "Watch for changes to the described resources and return them as a stream of add, update, and remove notifications. Specify resourceVersion.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "resourceVersion",
        "description": "When specified with a watch call, shows changes that occur after that particular version of a resource. Defaults to changes from the beginning of history. When specified for list: - if unset, then the result is returned from remote storage based on quorum-read flag; - if it's 0, then we simply return what we currently have in cache, no guarantee; - if set to non zero, then the result is at least as fresh as given rv.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "timeoutSeconds",
        "description": "Timeout for the list/watch call.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.WatchEvent"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf",
       "application/json;stream=watch",
       "application/vnd.kubernetes.protobuf;stream=watch"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/namespaces/{namespace}/configmaps/{name}",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.ConfigMap",
      "method": "GET",
      "summary": "read the specified ConfigMap",
      "nickname": "readNamespacedConfigMap",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "export",
        "description": "Should this value be exported.  Export strips fields that a user can not specify.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "exact",
        "description": "Should the export be exact.  Exact export maintains cluster-specific fields like 'Namespace'.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the ConfigMap",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.ConfigMap"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "v1.ConfigMap",
      "method": "PUT",
      "summary": "replace the specified ConfigMap",
      "nickname": "replaceNamespacedConfigMap",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "v1.ConfigMap",
        "paramType": "body",
        "name": "body",
        "description": "",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the ConfigMap",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.ConfigMap"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "v1.ConfigMap",
      "method": "PATCH",
      "summary": "partially update the specified ConfigMap",
      "nickname": "patchNamespacedConfigMap",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "v1.Patch",
        "paramType": "body",
        "name": "body",
        "description": "",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the ConfigMap",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.ConfigMap"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "application/json-patch+json",
       "application/merge-patch+json",
       "application/strategic-merge-patch+json"
      ]
     },
     {
      "type": "v1.Status",
      "method": "DELETE",
      "summary": "delete a ConfigMap",
      "nickname": "deleteNamespacedConfigMap",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "v1.DeleteOptions",
        "paramType": "body",
        "name": "body",
        "description": "",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "gracePeriodSeconds",
        "description": "The duration in seconds before the object should be deleted. Value must be non-negative integer. The value zero indicates delete immediately. If this value is nil, the default grace period for the specified type will be used. Defaults to a per object value if not specified. zero means delete immediately.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "orphanDependents",
        "description": "Deprecated: please use the PropagationPolicy, this field will be deprecated in 1.7. Should the dependent objects be orphaned. If true/false, the \"orphan\" finalizer will be added to/removed from the object's finalizers list. Either this field or PropagationPolicy may be set, but not both.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "propagationPolicy",
        "description": "Whether and how garbage collection will be performed. Either this field or OrphanDependents may be set, but not both. The default policy is decided by the existing finalizer set in the metadata.finalizers and the resource-specific default policy.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the ConfigMap",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.Status"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/watch/namespaces/{namespace}/configmaps/{name}",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.WatchEvent",
      "method": "GET",
      "summary": "watch changes to an object of kind ConfigMap",
      "nickname": "watchNamespacedConfigMap",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "labelSelector",
        "description": "A selector to restrict the list of returned objects by their labels. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "fieldSelector",
        "description": "A selector to restrict the list of returned objects by their fields. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "watch",
        "description": "Watch for changes to the described resources and return them as a stream of add, update, and remove notifications. Specify resourceVersion.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "resourceVersion",
        "description": "When specified with a watch call, shows changes that occur after that particular version of a resource. Defaults to changes from the beginning of history. When specified for list: - if unset, then the result is returned from remote storage based on quorum-read flag; - if it's 0, then we simply return what we currently have in cache, no guarantee; - if set to non zero, then the result is at least as fresh as given rv.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "timeoutSeconds",
        "description": "Timeout for the list/watch call.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the ConfigMap",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.WatchEvent"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf",
       "application/json;stream=watch",
       "application/vnd.kubernetes.protobuf;stream=watch"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/configmaps",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.ConfigMapList",
      "method": "GET",
      "summary": "list or watch objects of kind ConfigMap",
      "nickname": "listConfigMapForAllNamespaces",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "labelSelector",
        "description": "A selector to restrict the list of returned objects by their labels. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "fieldSelector",
        "description": "A selector to restrict the list of returned objects by their fields. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "watch",
        "description": "Watch for changes to the described resources and return them as a stream of add, update, and remove notifications. Specify resourceVersion.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "resourceVersion",
        "description": "When specified with a watch call, shows changes that occur after that particular version of a resource. Defaults to changes from the beginning of history. When specified for list: - if unset, then the result is returned from remote storage based on quorum-read flag; - if it's 0, then we simply return what we currently have in cache, no guarantee; - if set to non zero, then the result is at least as fresh as given rv.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "timeoutSeconds",
        "description": "Timeout for the list/watch call.",
        "required": false,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.ConfigMapList"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf",
       "application/json;stream=watch",
       "application/vnd.kubernetes.protobuf;stream=watch"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/watch/configmaps",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.WatchEvent",
      "method": "GET",
      "summary": "watch individual changes to a list of ConfigMap",
      "nickname": "watchConfigMapListForAllNamespaces",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "labelSelector",
        "description": "A selector to restrict the list of returned objects by their labels. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "fieldSelector",
        "description": "A selector to restrict the list of returned objects by their fields. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "watch",
        "description": "Watch for changes to the described resources and return them as a stream of add, update, and remove notifications. Specify resourceVersion.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "resourceVersion",
        "description": "When specified with a watch call, shows changes that occur after that particular version of a resource. Defaults to changes from the beginning of history. When specified for list: - if unset, then the result is returned from remote storage based on quorum-read flag; - if it's 0, then we simply return what we currently have in cache, no guarantee; - if set to non zero, then the result is at least as fresh as given rv.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "timeoutSeconds",
        "description": "Timeout for the list/watch call.",
        "required": false,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.WatchEvent"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf",
       "application/json;stream=watch",
       "application/vnd.kubernetes.protobuf;stream=watch"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/namespaces/{namespace}/endpoints",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.EndpointsList",
      "method": "GET",
      "summary": "list or watch objects of kind Endpoints",
      "nickname": "listNamespacedEndpoints",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "labelSelector",
        "description": "A selector to restrict the list of returned objects by their labels. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "fieldSelector",
        "description": "A selector to restrict the list of returned objects by their fields. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "watch",
        "description": "Watch for changes to the described resources and return them as a stream of add, update, and remove notifications. Specify resourceVersion.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "resourceVersion",
        "description": "When specified with a watch call, shows changes that occur after that particular version of a resource. Defaults to changes from the beginning of history. When specified for list: - if unset, then the result is returned from remote storage based on quorum-read flag; - if it's 0, then we simply return what we currently have in cache, no guarantee; - if set to non zero, then the result is at least as fresh as given rv.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "timeoutSeconds",
        "description": "Timeout for the list/watch call.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.EndpointsList"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf",
       "application/json;stream=watch",
       "application/vnd.kubernetes.protobuf;stream=watch"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "v1.Endpoints",
      "method": "POST",
      "summary": "create Endpoints",
      "nickname": "createNamespacedEndpoints",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "v1.Endpoints",
        "paramType": "body",
        "name": "body",
        "description": "",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.Endpoints"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "v1.Status",
      "method": "DELETE",
      "summary": "delete collection of Endpoints",
      "nickname": "deletecollectionNamespacedEndpoints",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "labelSelector",
        "description": "A selector to restrict the list of returned objects by their labels. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "fieldSelector",
        "description": "A selector to restrict the list of returned objects by their fields. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "watch",
        "description": "Watch for changes to the described resources and return them as a stream of add, update, and remove notifications. Specify resourceVersion.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "resourceVersion",
        "description": "When specified with a watch call, shows changes that occur after that particular version of a resource. Defaults to changes from the beginning of history. When specified for list: - if unset, then the result is returned from remote storage based on quorum-read flag; - if it's 0, then we simply return what we currently have in cache, no guarantee; - if set to non zero, then the result is at least as fresh as given rv.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "timeoutSeconds",
        "description": "Timeout for the list/watch call.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.Status"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/watch/namespaces/{namespace}/endpoints",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.WatchEvent",
      "method": "GET",
      "summary": "watch individual changes to a list of Endpoints",
      "nickname": "watchNamespacedEndpointsList",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "labelSelector",
        "description": "A selector to restrict the list of returned objects by their labels. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "fieldSelector",
        "description": "A selector to restrict the list of returned objects by their fields. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "watch",
        "description": "Watch for changes to the described resources and return them as a stream of add, update, and remove notifications. Specify resourceVersion.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "resourceVersion",
        "description": "When specified with a watch call, shows changes that occur after that particular version of a resource. Defaults to changes from the beginning of history. When specified for list: - if unset, then the result is returned from remote storage based on quorum-read flag; - if it's 0, then we simply return what we currently have in cache, no guarantee; - if set to non zero, then the result is at least as fresh as given rv.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "timeoutSeconds",
        "description": "Timeout for the list/watch call.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.WatchEvent"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf",
       "application/json;stream=watch",
       "application/vnd.kubernetes.protobuf;stream=watch"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/namespaces/{namespace}/endpoints/{name}",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.Endpoints",
      "method": "GET",
      "summary": "read the specified Endpoints",
      "nickname": "readNamespacedEndpoints",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "export",
        "description": "Should this value be exported.  Export strips fields that a user can not specify.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "exact",
        "description": "Should the export be exact.  Exact export maintains cluster-specific fields like 'Namespace'.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Endpoints",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.Endpoints"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "v1.Endpoints",
      "method": "PUT",
      "summary": "replace the specified Endpoints",
      "nickname": "replaceNamespacedEndpoints",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "v1.Endpoints",
        "paramType": "body",
        "name": "body",
        "description": "",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Endpoints",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.Endpoints"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "v1.Endpoints",
      "method": "PATCH",
      "summary": "partially update the specified Endpoints",
      "nickname": "patchNamespacedEndpoints",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "v1.Patch",
        "paramType": "body",
        "name": "body",
        "description": "",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Endpoints",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.Endpoints"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "application/json-patch+json",
       "application/merge-patch+json",
       "application/strategic-merge-patch+json"
      ]
     },
     {
      "type": "v1.Status",
      "method": "DELETE",
      "summary": "delete Endpoints",
      "nickname": "deleteNamespacedEndpoints",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "v1.DeleteOptions",
        "paramType": "body",
        "name": "body",
        "description": "",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "gracePeriodSeconds",
        "description": "The duration in seconds before the object should be deleted. Value must be non-negative integer. The value zero indicates delete immediately. If this value is nil, the default grace period for the specified type will be used. Defaults to a per object value if not specified. zero means delete immediately.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "orphanDependents",
        "description": "Deprecated: please use the PropagationPolicy, this field will be deprecated in 1.7. Should the dependent objects be orphaned. If true/false, the \"orphan\" finalizer will be added to/removed from the object's finalizers list. Either this field or PropagationPolicy may be set, but not both.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "propagationPolicy",
        "description": "Whether and how garbage collection will be performed. Either this field or OrphanDependents may be set, but not both. The default policy is decided by the existing finalizer set in the metadata.finalizers and the resource-specific default policy.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Endpoints",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.Status"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/watch/namespaces/{namespace}/endpoints/{name}",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.WatchEvent",
      "method": "GET",
      "summary": "watch changes to an object of kind Endpoints",
      "nickname": "watchNamespacedEndpoints",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "labelSelector",
        "description": "A selector to restrict the list of returned objects by their labels. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "fieldSelector",
        "description": "A selector to restrict the list of returned objects by their fields. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "watch",
        "description": "Watch for changes to the described resources and return them as a stream of add, update, and remove notifications. Specify resourceVersion.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "resourceVersion",
        "description": "When specified with a watch call, shows changes that occur after that particular version of a resource. Defaults to changes from the beginning of history. When specified for list: - if unset, then the result is returned from remote storage based on quorum-read flag; - if it's 0, then we simply return what we currently have in cache, no guarantee; - if set to non zero, then the result is at least as fresh as given rv.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "timeoutSeconds",
        "description": "Timeout for the list/watch call.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Endpoints",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.WatchEvent"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf",
       "application/json;stream=watch",
       "application/vnd.kubernetes.protobuf;stream=watch"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/endpoints",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.EndpointsList",
      "method": "GET",
      "summary": "list or watch objects of kind Endpoints",
      "nickname": "listEndpointsForAllNamespaces",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "labelSelector",
        "description": "A selector to restrict the list of returned objects by their labels. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "fieldSelector",
        "description": "A selector to restrict the list of returned objects by their fields. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "watch",
        "description": "Watch for changes to the described resources and return them as a stream of add, update, and remove notifications. Specify resourceVersion.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "resourceVersion",
        "description": "When specified with a watch call, shows changes that occur after that particular version of a resource. Defaults to changes from the beginning of history. When specified for list: - if unset, then the result is returned from remote storage based on quorum-read flag; - if it's 0, then we simply return what we currently have in cache, no guarantee; - if set to non zero, then the result is at least as fresh as given rv.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "timeoutSeconds",
        "description": "Timeout for the list/watch call.",
        "required": false,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.EndpointsList"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf",
       "application/json;stream=watch",
       "application/vnd.kubernetes.protobuf;stream=watch"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/watch/endpoints",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.WatchEvent",
      "method": "GET",
      "summary": "watch individual changes to a list of Endpoints",
      "nickname": "watchEndpointsListForAllNamespaces",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "labelSelector",
        "description": "A selector to restrict the list of returned objects by their labels. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "fieldSelector",
        "description": "A selector to restrict the list of returned objects by their fields. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "watch",
        "description": "Watch for changes to the described resources and return them as a stream of add, update, and remove notifications. Specify resourceVersion.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "resourceVersion",
        "description": "When specified with a watch call, shows changes that occur after that particular version of a resource. Defaults to changes from the beginning of history. When specified for list: - if unset, then the result is returned from remote storage based on quorum-read flag; - if it's 0, then we simply return what we currently have in cache, no guarantee; - if set to non zero, then the result is at least as fresh as given rv.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "timeoutSeconds",
        "description": "Timeout for the list/watch call.",
        "required": false,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.WatchEvent"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf",
       "application/json;stream=watch",
       "application/vnd.kubernetes.protobuf;stream=watch"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/namespaces/{namespace}/events",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.EventList",
      "method": "GET",
      "summary": "list or watch objects of kind Event",
      "nickname": "listNamespacedEvent",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "labelSelector",
        "description": "A selector to restrict the list of returned objects by their labels. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "fieldSelector",
        "description": "A selector to restrict the list of returned objects by their fields. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "watch",
        "description": "Watch for changes to the described resources and return them as a stream of add, update, and remove notifications. Specify resourceVersion.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "resourceVersion",
        "description": "When specified with a watch call, shows changes that occur after that particular version of a resource. Defaults to changes from the beginning of history. When specified for list: - if unset, then the result is returned from remote storage based on quorum-read flag; - if it's 0, then we simply return what we currently have in cache, no guarantee; - if set to non zero, then the result is at least as fresh as given rv.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "timeoutSeconds",
        "description": "Timeout for the list/watch call.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.EventList"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf",
       "application/json;stream=watch",
       "application/vnd.kubernetes.protobuf;stream=watch"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "v1.Event",
      "method": "POST",
      "summary": "create an Event",
      "nickname": "createNamespacedEvent",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "v1.Event",
        "paramType": "body",
        "name": "body",
        "description": "",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.Event"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "v1.Status",
      "method": "DELETE",
      "summary": "delete collection of Event",
      "nickname": "deletecollectionNamespacedEvent",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "labelSelector",
        "description": "A selector to restrict the list of returned objects by their labels. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "fieldSelector",
        "description": "A selector to restrict the list of returned objects by their fields. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "watch",
        "description": "Watch for changes to the described resources and return them as a stream of add, update, and remove notifications. Specify resourceVersion.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "resourceVersion",
        "description": "When specified with a watch call, shows changes that occur after that particular version of a resource. Defaults to changes from the beginning of history. When specified for list: - if unset, then the result is returned from remote storage based on quorum-read flag; - if it's 0, then we simply return what we currently have in cache, no guarantee; - if set to non zero, then the result is at least as fresh as given rv.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "timeoutSeconds",
        "description": "Timeout for the list/watch call.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.Status"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/watch/namespaces/{namespace}/events",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.WatchEvent",
      "method": "GET",
      "summary": "watch individual changes to a list of Event",
      "nickname": "watchNamespacedEventList",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "labelSelector",
        "description": "A selector to restrict the list of returned objects by their labels. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "fieldSelector",
        "description": "A selector to restrict the list of returned objects by their fields. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "watch",
        "description": "Watch for changes to the described resources and return them as a stream of add, update, and remove notifications. Specify resourceVersion.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "resourceVersion",
        "description": "When specified with a watch call, shows changes that occur after that particular version of a resource. Defaults to changes from the beginning of history. When specified for list: - if unset, then the result is returned from remote storage based on quorum-read flag; - if it's 0, then we simply return what we currently have in cache, no guarantee; - if set to non zero, then the result is at least as fresh as given rv.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "timeoutSeconds",
        "description": "Timeout for the list/watch call.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.WatchEvent"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf",
       "application/json;stream=watch",
       "application/vnd.kubernetes.protobuf;stream=watch"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/namespaces/{namespace}/events/{name}",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.Event",
      "method": "GET",
      "summary": "read the specified Event",
      "nickname": "readNamespacedEvent",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "export",
        "description": "Should this value be exported.  Export strips fields that a user can not specify.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "exact",
        "description": "Should the export be exact.  Exact export maintains cluster-specific fields like 'Namespace'.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Event",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.Event"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "v1.Event",
      "method": "PUT",
      "summary": "replace the specified Event",
      "nickname": "replaceNamespacedEvent",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "v1.Event",
        "paramType": "body",
        "name": "body",
        "description": "",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Event",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.Event"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "v1.Event",
      "method": "PATCH",
      "summary": "partially update the specified Event",
      "nickname": "patchNamespacedEvent",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "v1.Patch",
        "paramType": "body",
        "name": "body",
        "description": "",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Event",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.Event"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "application/json-patch+json",
       "application/merge-patch+json",
       "application/strategic-merge-patch+json"
      ]
     },
     {
      "type": "v1.Status",
      "method": "DELETE",
      "summary": "delete an Event",
      "nickname": "deleteNamespacedEvent",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "v1.DeleteOptions",
        "paramType": "body",
        "name": "body",
        "description": "",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "gracePeriodSeconds",
        "description": "The duration in seconds before the object should be deleted. Value must be non-negative integer. The value zero indicates delete immediately. If this value is nil, the default grace period for the specified type will be used. Defaults to a per object value if not specified. zero means delete immediately.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "orphanDependents",
        "description": "Deprecated: please use the PropagationPolicy, this field will be deprecated in 1.7. Should the dependent objects be orphaned. If true/false, the \"orphan\" finalizer will be added to/removed from the object's finalizers list. Either this field or PropagationPolicy may be set, but not both.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "propagationPolicy",
        "description": "Whether and how garbage collection will be performed. Either this field or OrphanDependents may be set, but not both. The default policy is decided by the existing finalizer set in the metadata.finalizers and the resource-specific default policy.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Event",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.Status"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/watch/namespaces/{namespace}/events/{name}",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.WatchEvent",
      "method": "GET",
      "summary": "watch changes to an object of kind Event",
      "nickname": "watchNamespacedEvent",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "labelSelector",
        "description": "A selector to restrict the list of returned objects by their labels. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "fieldSelector",
        "description": "A selector to restrict the list of returned objects by their fields. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "watch",
        "description": "Watch for changes to the described resources and return them as a stream of add, update, and remove notifications. Specify resourceVersion.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "resourceVersion",
        "description": "When specified with a watch call, shows changes that occur after that particular version of a resource. Defaults to changes from the beginning of history. When specified for list: - if unset, then the result is returned from remote storage based on quorum-read flag; - if it's 0, then we simply return what we currently have in cache, no guarantee; - if set to non zero, then the result is at least as fresh as given rv.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "timeoutSeconds",
        "description": "Timeout for the list/watch call.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Event",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.WatchEvent"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf",
       "application/json;stream=watch",
       "application/vnd.kubernetes.protobuf;stream=watch"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/events",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.EventList",
      "method": "GET",
      "summary": "list or watch objects of kind Event",
      "nickname": "listEventForAllNamespaces",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "labelSelector",
        "description": "A selector to restrict the list of returned objects by their labels. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "fieldSelector",
        "description": "A selector to restrict the list of returned objects by their fields. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "watch",
        "description": "Watch for changes to the described resources and return them as a stream of add, update, and remove notifications. Specify resourceVersion.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "resourceVersion",
        "description": "When specified with a watch call, shows changes that occur after that particular version of a resource. Defaults to changes from the beginning of history. When specified for list: - if unset, then the result is returned from remote storage based on quorum-read flag; - if it's 0, then we simply return what we currently have in cache, no guarantee; - if set to non zero, then the result is at least as fresh as given rv.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "timeoutSeconds",
        "description": "Timeout for the list/watch call.",
        "required": false,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.EventList"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf",
       "application/json;stream=watch",
       "application/vnd.kubernetes.protobuf;stream=watch"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/watch/events",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.WatchEvent",
      "method": "GET",
      "summary": "watch individual changes to a list of Event",
      "nickname": "watchEventListForAllNamespaces",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "labelSelector",
        "description": "A selector to restrict the list of returned objects by their labels. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "fieldSelector",
        "description": "A selector to restrict the list of returned objects by their fields. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "watch",
        "description": "Watch for changes to the described resources and return them as a stream of add, update, and remove notifications. Specify resourceVersion.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "resourceVersion",
        "description": "When specified with a watch call, shows changes that occur after that particular version of a resource. Defaults to changes from the beginning of history. When specified for list: - if unset, then the result is returned from remote storage based on quorum-read flag; - if it's 0, then we simply return what we currently have in cache, no guarantee; - if set to non zero, then the result is at least as fresh as given rv.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "timeoutSeconds",
        "description": "Timeout for the list/watch call.",
        "required": false,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.WatchEvent"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf",
       "application/json;stream=watch",
       "application/vnd.kubernetes.protobuf;stream=watch"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/namespaces/{namespace}/limitranges",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.LimitRangeList",
      "method": "GET",
      "summary": "list or watch objects of kind LimitRange",
      "nickname": "listNamespacedLimitRange",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "labelSelector",
        "description": "A selector to restrict the list of returned objects by their labels. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "fieldSelector",
        "description": "A selector to restrict the list of returned objects by their fields. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "watch",
        "description": "Watch for changes to the described resources and return them as a stream of add, update, and remove notifications. Specify resourceVersion.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "resourceVersion",
        "description": "When specified with a watch call, shows changes that occur after that particular version of a resource. Defaults to changes from the beginning of history. When specified for list: - if unset, then the result is returned from remote storage based on quorum-read flag; - if it's 0, then we simply return what we currently have in cache, no guarantee; - if set to non zero, then the result is at least as fresh as given rv.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "timeoutSeconds",
        "description": "Timeout for the list/watch call.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.LimitRangeList"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf",
       "application/json;stream=watch",
       "application/vnd.kubernetes.protobuf;stream=watch"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "v1.LimitRange",
      "method": "POST",
      "summary": "create a LimitRange",
      "nickname": "createNamespacedLimitRange",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "v1.LimitRange",
        "paramType": "body",
        "name": "body",
        "description": "",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.LimitRange"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "v1.Status",
      "method": "DELETE",
      "summary": "delete collection of LimitRange",
      "nickname": "deletecollectionNamespacedLimitRange",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "labelSelector",
        "description": "A selector to restrict the list of returned objects by their labels. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "fieldSelector",
        "description": "A selector to restrict the list of returned objects by their fields. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "watch",
        "description": "Watch for changes to the described resources and return them as a stream of add, update, and remove notifications. Specify resourceVersion.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "resourceVersion",
        "description": "When specified with a watch call, shows changes that occur after that particular version of a resource. Defaults to changes from the beginning of history. When specified for list: - if unset, then the result is returned from remote storage based on quorum-read flag; - if it's 0, then we simply return what we currently have in cache, no guarantee; - if set to non zero, then the result is at least as fresh as given rv.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "timeoutSeconds",
        "description": "Timeout for the list/watch call.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.Status"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/watch/namespaces/{namespace}/limitranges",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.WatchEvent",
      "method": "GET",
      "summary": "watch individual changes to a list of LimitRange",
      "nickname": "watchNamespacedLimitRangeList",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "labelSelector",
        "description": "A selector to restrict the list of returned objects by their labels. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "fieldSelector",
        "description": "A selector to restrict the list of returned objects by their fields. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "watch",
        "description": "Watch for changes to the described resources and return them as a stream of add, update, and remove notifications. Specify resourceVersion.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "resourceVersion",
        "description": "When specified with a watch call, shows changes that occur after that particular version of a resource. Defaults to changes from the beginning of history. When specified for list: - if unset, then the result is returned from remote storage based on quorum-read flag; - if it's 0, then we simply return what we currently have in cache, no guarantee; - if set to non zero, then the result is at least as fresh as given rv.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "timeoutSeconds",
        "description": "Timeout for the list/watch call.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.WatchEvent"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf",
       "application/json;stream=watch",
       "application/vnd.kubernetes.protobuf;stream=watch"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/namespaces/{namespace}/limitranges/{name}",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.LimitRange",
      "method": "GET",
      "summary": "read the specified LimitRange",
      "nickname": "readNamespacedLimitRange",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "export",
        "description": "Should this value be exported.  Export strips fields that a user can not specify.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "exact",
        "description": "Should the export be exact.  Exact export maintains cluster-specific fields like 'Namespace'.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the LimitRange",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.LimitRange"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "v1.LimitRange",
      "method": "PUT",
      "summary": "replace the specified LimitRange",
      "nickname": "replaceNamespacedLimitRange",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "v1.LimitRange",
        "paramType": "body",
        "name": "body",
        "description": "",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the LimitRange",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.LimitRange"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "v1.LimitRange",
      "method": "PATCH",
      "summary": "partially update the specified LimitRange",
      "nickname": "patchNamespacedLimitRange",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "v1.Patch",
        "paramType": "body",
        "name": "body",
        "description": "",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the LimitRange",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.LimitRange"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "application/json-patch+json",
       "application/merge-patch+json",
       "application/strategic-merge-patch+json"
      ]
     },
     {
      "type": "v1.Status",
      "method": "DELETE",
      "summary": "delete a LimitRange",
      "nickname": "deleteNamespacedLimitRange",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "v1.DeleteOptions",
        "paramType": "body",
        "name": "body",
        "description": "",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "gracePeriodSeconds",
        "description": "The duration in seconds before the object should be deleted. Value must be non-negative integer. The value zero indicates delete immediately. If this value is nil, the default grace period for the specified type will be used. Defaults to a per object value if not specified. zero means delete immediately.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "orphanDependents",
        "description": "Deprecated: please use the PropagationPolicy, this field will be deprecated in 1.7. Should the dependent objects be orphaned. If true/false, the \"orphan\" finalizer will be added to/removed from the object's finalizers list. Either this field or PropagationPolicy may be set, but not both.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "propagationPolicy",
        "description": "Whether and how garbage collection will be performed. Either this field or OrphanDependents may be set, but not both. The default policy is decided by the existing finalizer set in the metadata.finalizers and the resource-specific default policy.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the LimitRange",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.Status"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/watch/namespaces/{namespace}/limitranges/{name}",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.WatchEvent",
      "method": "GET",
      "summary": "watch changes to an object of kind LimitRange",
      "nickname": "watchNamespacedLimitRange",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "labelSelector",
        "description": "A selector to restrict the list of returned objects by their labels. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "fieldSelector",
        "description": "A selector to restrict the list of returned objects by their fields. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "watch",
        "description": "Watch for changes to the described resources and return them as a stream of add, update, and remove notifications. Specify resourceVersion.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "resourceVersion",
        "description": "When specified with a watch call, shows changes that occur after that particular version of a resource. Defaults to changes from the beginning of history. When specified for list: - if unset, then the result is returned from remote storage based on quorum-read flag; - if it's 0, then we simply return what we currently have in cache, no guarantee; - if set to non zero, then the result is at least as fresh as given rv.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "timeoutSeconds",
        "description": "Timeout for the list/watch call.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the LimitRange",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.WatchEvent"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf",
       "application/json;stream=watch",
       "application/vnd.kubernetes.protobuf;stream=watch"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/limitranges",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.LimitRangeList",
      "method": "GET",
      "summary": "list or watch objects of kind LimitRange",
      "nickname": "listLimitRangeForAllNamespaces",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "labelSelector",
        "description": "A selector to restrict the list of returned objects by their labels. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "fieldSelector",
        "description": "A selector to restrict the list of returned objects by their fields. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "watch",
        "description": "Watch for changes to the described resources and return them as a stream of add, update, and remove notifications. Specify resourceVersion.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "resourceVersion",
        "description": "When specified with a watch call, shows changes that occur after that particular version of a resource. Defaults to changes from the beginning of history. When specified for list: - if unset, then the result is returned from remote storage based on quorum-read flag; - if it's 0, then we simply return what we currently have in cache, no guarantee; - if set to non zero, then the result is at least as fresh as given rv.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "timeoutSeconds",
        "description": "Timeout for the list/watch call.",
        "required": false,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.LimitRangeList"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf",
       "application/json;stream=watch",
       "application/vnd.kubernetes.protobuf;stream=watch"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/watch/limitranges",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.WatchEvent",
      "method": "GET",
      "summary": "watch individual changes to a list of LimitRange",
      "nickname": "watchLimitRangeListForAllNamespaces",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "labelSelector",
        "description": "A selector to restrict the list of returned objects by their labels. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "fieldSelector",
        "description": "A selector to restrict the list of returned objects by their fields. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "watch",
        "description": "Watch for changes to the described resources and return them as a stream of add, update, and remove notifications. Specify resourceVersion.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "resourceVersion",
        "description": "When specified with a watch call, shows changes that occur after that particular version of a resource. Defaults to changes from the beginning of history. When specified for list: - if unset, then the result is returned from remote storage based on quorum-read flag; - if it's 0, then we simply return what we currently have in cache, no guarantee; - if set to non zero, then the result is at least as fresh as given rv.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "timeoutSeconds",
        "description": "Timeout for the list/watch call.",
        "required": false,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.WatchEvent"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf",
       "application/json;stream=watch",
       "application/vnd.kubernetes.protobuf;stream=watch"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/namespaces",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.NamespaceList",
      "method": "GET",
      "summary": "list or watch objects of kind Namespace",
      "nickname": "listNamespace",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "labelSelector",
        "description": "A selector to restrict the list of returned objects by their labels. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "fieldSelector",
        "description": "A selector to restrict the list of returned objects by their fields. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "watch",
        "description": "Watch for changes to the described resources and return them as a stream of add, update, and remove notifications. Specify resourceVersion.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "resourceVersion",
        "description": "When specified with a watch call, shows changes that occur after that particular version of a resource. Defaults to changes from the beginning of history. When specified for list: - if unset, then the result is returned from remote storage based on quorum-read flag; - if it's 0, then we simply return what we currently have in cache, no guarantee; - if set to non zero, then the result is at least as fresh as given rv.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "timeoutSeconds",
        "description": "Timeout for the list/watch call.",
        "required": false,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.NamespaceList"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf",
       "application/json;stream=watch",
       "application/vnd.kubernetes.protobuf;stream=watch"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "v1.Namespace",
      "method": "POST",
      "summary": "create a Namespace",
      "nickname": "createNamespace",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "v1.Namespace",
        "paramType": "body",
        "name": "body",
        "description": "",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.Namespace"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "v1.Status",
      "method": "DELETE",
      "summary": "delete collection of Namespace",
      "nickname": "deletecollectionNamespace",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "labelSelector",
        "description": "A selector to restrict the list of returned objects by their labels. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "fieldSelector",
        "description": "A selector to restrict the list of returned objects by their fields. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "watch",
        "description": "Watch for changes to the described resources and return them as a stream of add, update, and remove notifications. Specify resourceVersion.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "resourceVersion",
        "description": "When specified with a watch call, shows changes that occur after that particular version of a resource. Defaults to changes from the beginning of history. When specified for list: - if unset, then the result is returned from remote storage based on quorum-read flag; - if it's 0, then we simply return what we currently have in cache, no guarantee; - if set to non zero, then the result is at least as fresh as given rv.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "timeoutSeconds",
        "description": "Timeout for the list/watch call.",
        "required": false,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.Status"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/watch/namespaces",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.WatchEvent",
      "method": "GET",
      "summary": "watch individual changes to a list of Namespace",
      "nickname": "watchNamespaceList",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "labelSelector",
        "description": "A selector to restrict the list of returned objects by their labels. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "fieldSelector",
        "description": "A selector to restrict the list of returned objects by their fields. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "watch",
        "description": "Watch for changes to the described resources and return them as a stream of add, update, and remove notifications. Specify resourceVersion.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "resourceVersion",
        "description": "When specified with a watch call, shows changes that occur after that particular version of a resource. Defaults to changes from the beginning of history. When specified for list: - if unset, then the result is returned from remote storage based on quorum-read flag; - if it's 0, then we simply return what we currently have in cache, no guarantee; - if set to non zero, then the result is at least as fresh as given rv.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "timeoutSeconds",
        "description": "Timeout for the list/watch call.",
        "required": false,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.WatchEvent"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf",
       "application/json;stream=watch",
       "application/vnd.kubernetes.protobuf;stream=watch"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/namespaces/{name}",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.Namespace",
      "method": "GET",
      "summary": "read the specified Namespace",
      "nickname": "readNamespace",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "export",
        "description": "Should this value be exported.  Export strips fields that a user can not specify.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "exact",
        "description": "Should the export be exact.  Exact export maintains cluster-specific fields like 'Namespace'.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Namespace",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.Namespace"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "v1.Namespace",
      "method": "PUT",
      "summary": "replace the specified Namespace",
      "nickname": "replaceNamespace",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "v1.Namespace",
        "paramType": "body",
        "name": "body",
        "description": "",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Namespace",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.Namespace"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "v1.Namespace",
      "method": "PATCH",
      "summary": "partially update the specified Namespace",
      "nickname": "patchNamespace",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "v1.Patch",
        "paramType": "body",
        "name": "body",
        "description": "",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Namespace",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.Namespace"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "application/json-patch+json",
       "application/merge-patch+json",
       "application/strategic-merge-patch+json"
      ]
     },
     {
      "type": "v1.Status",
      "method": "DELETE",
      "summary": "delete a Namespace",
      "nickname": "deleteNamespace",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "v1.DeleteOptions",
        "paramType": "body",
        "name": "body",
        "description": "",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "gracePeriodSeconds",
        "description": "The duration in seconds before the object should be deleted. Value must be non-negative integer. The value zero indicates delete immediately. If this value is nil, the default grace period for the specified type will be used. Defaults to a per object value if not specified. zero means delete immediately.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "orphanDependents",
        "description": "Deprecated: please use the PropagationPolicy, this field will be deprecated in 1.7. Should the dependent objects be orphaned. If true/false, the \"orphan\" finalizer will be added to/removed from the object's finalizers list. Either this field or PropagationPolicy may be set, but not both.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "propagationPolicy",
        "description": "Whether and how garbage collection will be performed. Either this field or OrphanDependents may be set, but not both. The default policy is decided by the existing finalizer set in the metadata.finalizers and the resource-specific default policy.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Namespace",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.Status"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/watch/namespaces/{name}",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.WatchEvent",
      "method": "GET",
      "summary": "watch changes to an object of kind Namespace",
      "nickname": "watchNamespace",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "labelSelector",
        "description": "A selector to restrict the list of returned objects by their labels. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "fieldSelector",
        "description": "A selector to restrict the list of returned objects by their fields. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "watch",
        "description": "Watch for changes to the described resources and return them as a stream of add, update, and remove notifications. Specify resourceVersion.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "resourceVersion",
        "description": "When specified with a watch call, shows changes that occur after that particular version of a resource. Defaults to changes from the beginning of history. When specified for list: - if unset, then the result is returned from remote storage based on quorum-read flag; - if it's 0, then we simply return what we currently have in cache, no guarantee; - if set to non zero, then the result is at least as fresh as given rv.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "timeoutSeconds",
        "description": "Timeout for the list/watch call.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Namespace",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.WatchEvent"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf",
       "application/json;stream=watch",
       "application/vnd.kubernetes.protobuf;stream=watch"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/namespaces/{name}/finalize",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.Namespace",
      "method": "PUT",
      "summary": "replace finalize of the specified Namespace",
      "nickname": "replaceNamespaceFinalize",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "v1.Namespace",
        "paramType": "body",
        "name": "body",
        "description": "",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Namespace",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.Namespace"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/namespaces/{name}/status",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.Namespace",
      "method": "GET",
      "summary": "read status of the specified Namespace",
      "nickname": "readNamespaceStatus",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Namespace",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.Namespace"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "v1.Namespace",
      "method": "PUT",
      "summary": "replace status of the specified Namespace",
      "nickname": "replaceNamespaceStatus",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "v1.Namespace",
        "paramType": "body",
        "name": "body",
        "description": "",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Namespace",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.Namespace"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "v1.Namespace",
      "method": "PATCH",
      "summary": "partially update status of the specified Namespace",
      "nickname": "patchNamespaceStatus",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "v1.Patch",
        "paramType": "body",
        "name": "body",
        "description": "",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Namespace",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.Namespace"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "application/json-patch+json",
       "application/merge-patch+json",
       "application/strategic-merge-patch+json"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/nodes",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.NodeList",
      "method": "GET",
      "summary": "list or watch objects of kind Node",
      "nickname": "listNode",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "labelSelector",
        "description": "A selector to restrict the list of returned objects by their labels. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "fieldSelector",
        "description": "A selector to restrict the list of returned objects by their fields. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "watch",
        "description": "Watch for changes to the described resources and return them as a stream of add, update, and remove notifications. Specify resourceVersion.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "resourceVersion",
        "description": "When specified with a watch call, shows changes that occur after that particular version of a resource. Defaults to changes from the beginning of history. When specified for list: - if unset, then the result is returned from remote storage based on quorum-read flag; - if it's 0, then we simply return what we currently have in cache, no guarantee; - if set to non zero, then the result is at least as fresh as given rv.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "timeoutSeconds",
        "description": "Timeout for the list/watch call.",
        "required": false,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.NodeList"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf",
       "application/json;stream=watch",
       "application/vnd.kubernetes.protobuf;stream=watch"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "v1.Node",
      "method": "POST",
      "summary": "create a Node",
      "nickname": "createNode",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "v1.Node",
        "paramType": "body",
        "name": "body",
        "description": "",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.Node"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "v1.Status",
      "method": "DELETE",
      "summary": "delete collection of Node",
      "nickname": "deletecollectionNode",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "labelSelector",
        "description": "A selector to restrict the list of returned objects by their labels. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "fieldSelector",
        "description": "A selector to restrict the list of returned objects by their fields. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "watch",
        "description": "Watch for changes to the described resources and return them as a stream of add, update, and remove notifications. Specify resourceVersion.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "resourceVersion",
        "description": "When specified with a watch call, shows changes that occur after that particular version of a resource. Defaults to changes from the beginning of history. When specified for list: - if unset, then the result is returned from remote storage based on quorum-read flag; - if it's 0, then we simply return what we currently have in cache, no guarantee; - if set to non zero, then the result is at least as fresh as given rv.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "timeoutSeconds",
        "description": "Timeout for the list/watch call.",
        "required": false,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.Status"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/watch/nodes",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.WatchEvent",
      "method": "GET",
      "summary": "watch individual changes to a list of Node",
      "nickname": "watchNodeList",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "labelSelector",
        "description": "A selector to restrict the list of returned objects by their labels. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "fieldSelector",
        "description": "A selector to restrict the list of returned objects by their fields. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "watch",
        "description": "Watch for changes to the described resources and return them as a stream of add, update, and remove notifications. Specify resourceVersion.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "resourceVersion",
        "description": "When specified with a watch call, shows changes that occur after that particular version of a resource. Defaults to changes from the beginning of history. When specified for list: - if unset, then the result is returned from remote storage based on quorum-read flag; - if it's 0, then we simply return what we currently have in cache, no guarantee; - if set to non zero, then the result is at least as fresh as given rv.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "timeoutSeconds",
        "description": "Timeout for the list/watch call.",
        "required": false,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.WatchEvent"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf",
       "application/json;stream=watch",
       "application/vnd.kubernetes.protobuf;stream=watch"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/nodes/{name}",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.Node",
      "method": "GET",
      "summary": "read the specified Node",
      "nickname": "readNode",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "export",
        "description": "Should this value be exported.  Export strips fields that a user can not specify.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "exact",
        "description": "Should the export be exact.  Exact export maintains cluster-specific fields like 'Namespace'.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Node",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.Node"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "v1.Node",
      "method": "PUT",
      "summary": "replace the specified Node",
      "nickname": "replaceNode",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "v1.Node",
        "paramType": "body",
        "name": "body",
        "description": "",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Node",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.Node"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "v1.Node",
      "method": "PATCH",
      "summary": "partially update the specified Node",
      "nickname": "patchNode",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "v1.Patch",
        "paramType": "body",
        "name": "body",
        "description": "",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Node",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.Node"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "application/json-patch+json",
       "application/merge-patch+json",
       "application/strategic-merge-patch+json"
      ]
     },
     {
      "type": "v1.Status",
      "method": "DELETE",
      "summary": "delete a Node",
      "nickname": "deleteNode",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "v1.DeleteOptions",
        "paramType": "body",
        "name": "body",
        "description": "",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "gracePeriodSeconds",
        "description": "The duration in seconds before the object should be deleted. Value must be non-negative integer. The value zero indicates delete immediately. If this value is nil, the default grace period for the specified type will be used. Defaults to a per object value if not specified. zero means delete immediately.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "orphanDependents",
        "description": "Deprecated: please use the PropagationPolicy, this field will be deprecated in 1.7. Should the dependent objects be orphaned. If true/false, the \"orphan\" finalizer will be added to/removed from the object's finalizers list. Either this field or PropagationPolicy may be set, but not both.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "propagationPolicy",
        "description": "Whether and how garbage collection will be performed. Either this field or OrphanDependents may be set, but not both. The default policy is decided by the existing finalizer set in the metadata.finalizers and the resource-specific default policy.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Node",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.Status"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/watch/nodes/{name}",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.WatchEvent",
      "method": "GET",
      "summary": "watch changes to an object of kind Node",
      "nickname": "watchNode",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "labelSelector",
        "description": "A selector to restrict the list of returned objects by their labels. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "fieldSelector",
        "description": "A selector to restrict the list of returned objects by their fields. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "watch",
        "description": "Watch for changes to the described resources and return them as a stream of add, update, and remove notifications. Specify resourceVersion.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "resourceVersion",
        "description": "When specified with a watch call, shows changes that occur after that particular version of a resource. Defaults to changes from the beginning of history. When specified for list: - if unset, then the result is returned from remote storage based on quorum-read flag; - if it's 0, then we simply return what we currently have in cache, no guarantee; - if set to non zero, then the result is at least as fresh as given rv.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "timeoutSeconds",
        "description": "Timeout for the list/watch call.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Node",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.WatchEvent"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf",
       "application/json;stream=watch",
       "application/vnd.kubernetes.protobuf;stream=watch"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/proxy/nodes/{name}/{path}",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "string",
      "method": "GET",
      "summary": "proxy GET requests to Node",
      "nickname": "proxyGETNodeWithPath",
      "parameters": [
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Node",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "path",
        "description": "path to the resource",
        "required": true,
        "allowMultiple": false
       }
      ],
      "produces": [
       "*/*"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "string",
      "method": "PUT",
      "summary": "proxy PUT requests to Node",
      "nickname": "proxyPUTNodeWithPath",
      "parameters": [
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Node",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "path",
        "description": "path to the resource",
        "required": true,
        "allowMultiple": false
       }
      ],
      "produces": [
       "*/*"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "string",
      "method": "POST",
      "summary": "proxy POST requests to Node",
      "nickname": "proxyPOSTNodeWithPath",
      "parameters": [
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Node",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "path",
        "description": "path to the resource",
        "required": true,
        "allowMultiple": false
       }
      ],
      "produces": [
       "*/*"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "string",
      "method": "PATCH",
      "summary": "proxy PATCH requests to Node",
      "nickname": "proxyPATCHNodeWithPath",
      "parameters": [
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Node",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "path",
        "description": "path to the resource",
        "required": true,
        "allowMultiple": false
       }
      ],
      "produces": [
       "*/*"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "string",
      "method": "DELETE",
      "summary": "proxy DELETE requests to Node",
      "nickname": "proxyDELETENodeWithPath",
      "parameters": [
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Node",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "path",
        "description": "path to the resource",
        "required": true,
        "allowMultiple": false
       }
      ],
      "produces": [
       "*/*"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "string",
      "method": "HEAD",
      "summary": "proxy HEAD requests to Node",
      "nickname": "proxyHEADNodeWithPath",
      "parameters": [
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Node",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "path",
        "description": "path to the resource",
        "required": true,
        "allowMultiple": false
       }
      ],
      "produces": [
       "*/*"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "string",
      "method": "OPTIONS",
      "summary": "proxy OPTIONS requests to Node",
      "nickname": "proxyOPTIONSNodeWithPath",
      "parameters": [
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Node",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "path",
        "description": "path to the resource",
        "required": true,
        "allowMultiple": false
       }
      ],
      "produces": [
       "*/*"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/proxy/nodes/{name}",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "string",
      "method": "GET",
      "summary": "proxy GET requests to Node",
      "nickname": "proxyGETNode",
      "parameters": [
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Node",
        "required": true,
        "allowMultiple": false
       }
      ],
      "produces": [
       "*/*"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "string",
      "method": "PUT",
      "summary": "proxy PUT requests to Node",
      "nickname": "proxyPUTNode",
      "parameters": [
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Node",
        "required": true,
        "allowMultiple": false
       }
      ],
      "produces": [
       "*/*"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "string",
      "method": "POST",
      "summary": "proxy POST requests to Node",
      "nickname": "proxyPOSTNode",
      "parameters": [
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Node",
        "required": true,
        "allowMultiple": false
       }
      ],
      "produces": [
       "*/*"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "string",
      "method": "PATCH",
      "summary": "proxy PATCH requests to Node",
      "nickname": "proxyPATCHNode",
      "parameters": [
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Node",
        "required": true,
        "allowMultiple": false
       }
      ],
      "produces": [
       "*/*"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "string",
      "method": "DELETE",
      "summary": "proxy DELETE requests to Node",
      "nickname": "proxyDELETENode",
      "parameters": [
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Node",
        "required": true,
        "allowMultiple": false
       }
      ],
      "produces": [
       "*/*"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "string",
      "method": "HEAD",
      "summary": "proxy HEAD requests to Node",
      "nickname": "proxyHEADNode",
      "parameters": [
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Node",
        "required": true,
        "allowMultiple": false
       }
      ],
      "produces": [
       "*/*"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "string",
      "method": "OPTIONS",
      "summary": "proxy OPTIONS requests to Node",
      "nickname": "proxyOPTIONSNode",
      "parameters": [
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Node",
        "required": true,
        "allowMultiple": false
       }
      ],
      "produces": [
       "*/*"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/nodes/{name}/proxy",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "string",
      "method": "GET",
      "summary": "connect GET requests to proxy of Node",
      "nickname": "connectGetNodeProxy",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "path",
        "description": "Path is the URL path to use for the current proxy request to node.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Node",
        "required": true,
        "allowMultiple": false
       }
      ],
      "produces": [
       "*/*"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "string",
      "method": "POST",
      "summary": "connect POST requests to proxy of Node",
      "nickname": "connectPostNodeProxy",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "path",
        "description": "Path is the URL path to use for the current proxy request to node.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Node",
        "required": true,
        "allowMultiple": false
       }
      ],
      "produces": [
       "*/*"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "string",
      "method": "PUT",
      "summary": "connect PUT requests to proxy of Node",
      "nickname": "connectPutNodeProxy",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "path",
        "description": "Path is the URL path to use for the current proxy request to node.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Node",
        "required": true,
        "allowMultiple": false
       }
      ],
      "produces": [
       "*/*"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "string",
      "method": "PATCH",
      "summary": "connect PATCH requests to proxy of Node",
      "nickname": "connectPatchNodeProxy",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "path",
        "description": "Path is the URL path to use for the current proxy request to node.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Node",
        "required": true,
        "allowMultiple": false
       }
      ],
      "produces": [
       "*/*"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "string",
      "method": "DELETE",
      "summary": "connect DELETE requests to proxy of Node",
      "nickname": "connectDeleteNodeProxy",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "path",
        "description": "Path is the URL path to use for the current proxy request to node.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Node",
        "required": true,
        "allowMultiple": false
       }
      ],
      "produces": [
       "*/*"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "string",
      "method": "HEAD",
      "summary": "connect HEAD requests to proxy of Node",
      "nickname": "connectHeadNodeProxy",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "path",
        "description": "Path is the URL path to use for the current proxy request to node.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Node",
        "required": true,
        "allowMultiple": false
       }
      ],
      "produces": [
       "*/*"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "string",
      "method": "OPTIONS",
      "summary": "connect OPTIONS requests to proxy of Node",
      "nickname": "connectOptionsNodeProxy",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "path",
        "description": "Path is the URL path to use for the current proxy request to node.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Node",
        "required": true,
        "allowMultiple": false
       }
      ],
      "produces": [
       "*/*"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/nodes/{name}/proxy/{path}",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "string",
      "method": "GET",
      "summary": "connect GET requests to proxy of Node",
      "nickname": "connectGetNodeProxyWithPath",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "path",
        "description": "Path is the URL path to use for the current proxy request to node.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Node",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "path",
        "description": "path to the resource",
        "required": true,
        "allowMultiple": false
       }
      ],
      "produces": [
       "*/*"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "string",
      "method": "POST",
      "summary": "connect POST requests to proxy of Node",
      "nickname": "connectPostNodeProxyWithPath",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "path",
        "description": "Path is the URL path to use for the current proxy request to node.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Node",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "path",
        "description": "path to the resource",
        "required": true,
        "allowMultiple": false
       }
      ],
      "produces": [
       "*/*"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "string",
      "method": "PUT",
      "summary": "connect PUT requests to proxy of Node",
      "nickname": "connectPutNodeProxyWithPath",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "path",
        "description": "Path is the URL path to use for the current proxy request to node.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Node",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "path",
        "description": "path to the resource",
        "required": true,
        "allowMultiple": false
       }
      ],
      "produces": [
       "*/*"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "string",
      "method": "PATCH",
      "summary": "connect PATCH requests to proxy of Node",
      "nickname": "connectPatchNodeProxyWithPath",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "path",
        "description": "Path is the URL path to use for the current proxy request to node.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Node",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "path",
        "description": "path to the resource",
        "required": true,
        "allowMultiple": false
       }
      ],
      "produces": [
       "*/*"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "string",
      "method": "DELETE",
      "summary": "connect DELETE requests to proxy of Node",
      "nickname": "connectDeleteNodeProxyWithPath",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "path",
        "description": "Path is the URL path to use for the current proxy request to node.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Node",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "path",
        "description": "path to the resource",
        "required": true,
        "allowMultiple": false
       }
      ],
      "produces": [
       "*/*"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "string",
      "method": "HEAD",
      "summary": "connect HEAD requests to proxy of Node",
      "nickname": "connectHeadNodeProxyWithPath",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "path",
        "description": "Path is the URL path to use for the current proxy request to node.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Node",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "path",
        "description": "path to the resource",
        "required": true,
        "allowMultiple": false
       }
      ],
      "produces": [
       "*/*"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "string",
      "method": "OPTIONS",
      "summary": "connect OPTIONS requests to proxy of Node",
      "nickname": "connectOptionsNodeProxyWithPath",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "path",
        "description": "Path is the URL path to use for the current proxy request to node.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Node",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "path",
        "description": "path to the resource",
        "required": true,
        "allowMultiple": false
       }
      ],
      "produces": [
       "*/*"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/nodes/{name}/status",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.Node",
      "method": "GET",
      "summary": "read status of the specified Node",
      "nickname": "readNodeStatus",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Node",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.Node"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "v1.Node",
      "method": "PUT",
      "summary": "replace status of the specified Node",
      "nickname": "replaceNodeStatus",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "v1.Node",
        "paramType": "body",
        "name": "body",
        "description": "",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Node",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.Node"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "v1.Node",
      "method": "PATCH",
      "summary": "partially update status of the specified Node",
      "nickname": "patchNodeStatus",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "v1.Patch",
        "paramType": "body",
        "name": "body",
        "description": "",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Node",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.Node"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "application/json-patch+json",
       "application/merge-patch+json",
       "application/strategic-merge-patch+json"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/namespaces/{namespace}/persistentvolumeclaims",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.PersistentVolumeClaimList",
      "method": "GET",
      "summary": "list or watch objects of kind PersistentVolumeClaim",
      "nickname": "listNamespacedPersistentVolumeClaim",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "labelSelector",
        "description": "A selector to restrict the list of returned objects by their labels. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "fieldSelector",
        "description": "A selector to restrict the list of returned objects by their fields. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "watch",
        "description": "Watch for changes to the described resources and return them as a stream of add, update, and remove notifications. Specify resourceVersion.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "resourceVersion",
        "description": "When specified with a watch call, shows changes that occur after that particular version of a resource. Defaults to changes from the beginning of history. When specified for list: - if unset, then the result is returned from remote storage based on quorum-read flag; - if it's 0, then we simply return what we currently have in cache, no guarantee; - if set to non zero, then the result is at least as fresh as given rv.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "timeoutSeconds",
        "description": "Timeout for the list/watch call.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.PersistentVolumeClaimList"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf",
       "application/json;stream=watch",
       "application/vnd.kubernetes.protobuf;stream=watch"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "v1.PersistentVolumeClaim",
      "method": "POST",
      "summary": "create a PersistentVolumeClaim",
      "nickname": "createNamespacedPersistentVolumeClaim",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "v1.PersistentVolumeClaim",
        "paramType": "body",
        "name": "body",
        "description": "",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.PersistentVolumeClaim"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "v1.Status",
      "method": "DELETE",
      "summary": "delete collection of PersistentVolumeClaim",
      "nickname": "deletecollectionNamespacedPersistentVolumeClaim",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "labelSelector",
        "description": "A selector to restrict the list of returned objects by their labels. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "fieldSelector",
        "description": "A selector to restrict the list of returned objects by their fields. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "watch",
        "description": "Watch for changes to the described resources and return them as a stream of add, update, and remove notifications. Specify resourceVersion.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "resourceVersion",
        "description": "When specified with a watch call, shows changes that occur after that particular version of a resource. Defaults to changes from the beginning of history. When specified for list: - if unset, then the result is returned from remote storage based on quorum-read flag; - if it's 0, then we simply return what we currently have in cache, no guarantee; - if set to non zero, then the result is at least as fresh as given rv.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "timeoutSeconds",
        "description": "Timeout for the list/watch call.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.Status"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/watch/namespaces/{namespace}/persistentvolumeclaims",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.WatchEvent",
      "method": "GET",
      "summary": "watch individual changes to a list of PersistentVolumeClaim",
      "nickname": "watchNamespacedPersistentVolumeClaimList",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "labelSelector",
        "description": "A selector to restrict the list of returned objects by their labels. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "fieldSelector",
        "description": "A selector to restrict the list of returned objects by their fields. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "watch",
        "description": "Watch for changes to the described resources and return them as a stream of add, update, and remove notifications. Specify resourceVersion.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "resourceVersion",
        "description": "When specified with a watch call, shows changes that occur after that particular version of a resource. Defaults to changes from the beginning of history. When specified for list: - if unset, then the result is returned from remote storage based on quorum-read flag; - if it's 0, then we simply return what we currently have in cache, no guarantee; - if set to non zero, then the result is at least as fresh as given rv.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "timeoutSeconds",
        "description": "Timeout for the list/watch call.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.WatchEvent"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf",
       "application/json;stream=watch",
       "application/vnd.kubernetes.protobuf;stream=watch"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/namespaces/{namespace}/persistentvolumeclaims/{name}",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.PersistentVolumeClaim",
      "method": "GET",
      "summary": "read the specified PersistentVolumeClaim",
      "nickname": "readNamespacedPersistentVolumeClaim",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "export",
        "description": "Should this value be exported.  Export strips fields that a user can not specify.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "exact",
        "description": "Should the export be exact.  Exact export maintains cluster-specific fields like 'Namespace'.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the PersistentVolumeClaim",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.PersistentVolumeClaim"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "v1.PersistentVolumeClaim",
      "method": "PUT",
      "summary": "replace the specified PersistentVolumeClaim",
      "nickname": "replaceNamespacedPersistentVolumeClaim",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "v1.PersistentVolumeClaim",
        "paramType": "body",
        "name": "body",
        "description": "",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the PersistentVolumeClaim",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.PersistentVolumeClaim"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "v1.PersistentVolumeClaim",
      "method": "PATCH",
      "summary": "partially update the specified PersistentVolumeClaim",
      "nickname": "patchNamespacedPersistentVolumeClaim",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "v1.Patch",
        "paramType": "body",
        "name": "body",
        "description": "",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the PersistentVolumeClaim",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.PersistentVolumeClaim"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "application/json-patch+json",
       "application/merge-patch+json",
       "application/strategic-merge-patch+json"
      ]
     },
     {
      "type": "v1.Status",
      "method": "DELETE",
      "summary": "delete a PersistentVolumeClaim",
      "nickname": "deleteNamespacedPersistentVolumeClaim",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "v1.DeleteOptions",
        "paramType": "body",
        "name": "body",
        "description": "",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "gracePeriodSeconds",
        "description": "The duration in seconds before the object should be deleted. Value must be non-negative integer. The value zero indicates delete immediately. If this value is nil, the default grace period for the specified type will be used. Defaults to a per object value if not specified. zero means delete immediately.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "orphanDependents",
        "description": "Deprecated: please use the PropagationPolicy, this field will be deprecated in 1.7. Should the dependent objects be orphaned. If true/false, the \"orphan\" finalizer will be added to/removed from the object's finalizers list. Either this field or PropagationPolicy may be set, but not both.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "propagationPolicy",
        "description": "Whether and how garbage collection will be performed. Either this field or OrphanDependents may be set, but not both. The default policy is decided by the existing finalizer set in the metadata.finalizers and the resource-specific default policy.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the PersistentVolumeClaim",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.Status"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/watch/namespaces/{namespace}/persistentvolumeclaims/{name}",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.WatchEvent",
      "method": "GET",
      "summary": "watch changes to an object of kind PersistentVolumeClaim",
      "nickname": "watchNamespacedPersistentVolumeClaim",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "labelSelector",
        "description": "A selector to restrict the list of returned objects by their labels. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "fieldSelector",
        "description": "A selector to restrict the list of returned objects by their fields. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "watch",
        "description": "Watch for changes to the described resources and return them as a stream of add, update, and remove notifications. Specify resourceVersion.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "resourceVersion",
        "description": "When specified with a watch call, shows changes that occur after that particular version of a resource. Defaults to changes from the beginning of history. When specified for list: - if unset, then the result is returned from remote storage based on quorum-read flag; - if it's 0, then we simply return what we currently have in cache, no guarantee; - if set to non zero, then the result is at least as fresh as given rv.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "timeoutSeconds",
        "description": "Timeout for the list/watch call.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the PersistentVolumeClaim",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.WatchEvent"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf",
       "application/json;stream=watch",
       "application/vnd.kubernetes.protobuf;stream=watch"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/persistentvolumeclaims",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.PersistentVolumeClaimList",
      "method": "GET",
      "summary": "list or watch objects of kind PersistentVolumeClaim",
      "nickname": "listPersistentVolumeClaimForAllNamespaces",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "labelSelector",
        "description": "A selector to restrict the list of returned objects by their labels. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "fieldSelector",
        "description": "A selector to restrict the list of returned objects by their fields. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "watch",
        "description": "Watch for changes to the described resources and return them as a stream of add, update, and remove notifications. Specify resourceVersion.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "resourceVersion",
        "description": "When specified with a watch call, shows changes that occur after that particular version of a resource. Defaults to changes from the beginning of history. When specified for list: - if unset, then the result is returned from remote storage based on quorum-read flag; - if it's 0, then we simply return what we currently have in cache, no guarantee; - if set to non zero, then the result is at least as fresh as given rv.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "timeoutSeconds",
        "description": "Timeout for the list/watch call.",
        "required": false,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.PersistentVolumeClaimList"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf",
       "application/json;stream=watch",
       "application/vnd.kubernetes.protobuf;stream=watch"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/watch/persistentvolumeclaims",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.WatchEvent",
      "method": "GET",
      "summary": "watch individual changes to a list of PersistentVolumeClaim",
      "nickname": "watchPersistentVolumeClaimListForAllNamespaces",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "labelSelector",
        "description": "A selector to restrict the list of returned objects by their labels. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "fieldSelector",
        "description": "A selector to restrict the list of returned objects by their fields. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "watch",
        "description": "Watch for changes to the described resources and return them as a stream of add, update, and remove notifications. Specify resourceVersion.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "resourceVersion",
        "description": "When specified with a watch call, shows changes that occur after that particular version of a resource. Defaults to changes from the beginning of history. When specified for list: - if unset, then the result is returned from remote storage based on quorum-read flag; - if it's 0, then we simply return what we currently have in cache, no guarantee; - if set to non zero, then the result is at least as fresh as given rv.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "timeoutSeconds",
        "description": "Timeout for the list/watch call.",
        "required": false,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.WatchEvent"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf",
       "application/json;stream=watch",
       "application/vnd.kubernetes.protobuf;stream=watch"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/namespaces/{namespace}/persistentvolumeclaims/{name}/status",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.PersistentVolumeClaim",
      "method": "GET",
      "summary": "read status of the specified PersistentVolumeClaim",
      "nickname": "readNamespacedPersistentVolumeClaimStatus",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the PersistentVolumeClaim",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.PersistentVolumeClaim"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "v1.PersistentVolumeClaim",
      "method": "PUT",
      "summary": "replace status of the specified PersistentVolumeClaim",
      "nickname": "replaceNamespacedPersistentVolumeClaimStatus",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "v1.PersistentVolumeClaim",
        "paramType": "body",
        "name": "body",
        "description": "",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the PersistentVolumeClaim",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.PersistentVolumeClaim"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "v1.PersistentVolumeClaim",
      "method": "PATCH",
      "summary": "partially update status of the specified PersistentVolumeClaim",
      "nickname": "patchNamespacedPersistentVolumeClaimStatus",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "v1.Patch",
        "paramType": "body",
        "name": "body",
        "description": "",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the PersistentVolumeClaim",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.PersistentVolumeClaim"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "application/json-patch+json",
       "application/merge-patch+json",
       "application/strategic-merge-patch+json"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/persistentvolumes",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.PersistentVolumeList",
      "method": "GET",
      "summary": "list or watch objects of kind PersistentVolume",
      "nickname": "listPersistentVolume",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "labelSelector",
        "description": "A selector to restrict the list of returned objects by their labels. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "fieldSelector",
        "description": "A selector to restrict the list of returned objects by their fields. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "watch",
        "description": "Watch for changes to the described resources and return them as a stream of add, update, and remove notifications. Specify resourceVersion.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "resourceVersion",
        "description": "When specified with a watch call, shows changes that occur after that particular version of a resource. Defaults to changes from the beginning of history. When specified for list: - if unset, then the result is returned from remote storage based on quorum-read flag; - if it's 0, then we simply return what we currently have in cache, no guarantee; - if set to non zero, then the result is at least as fresh as given rv.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "timeoutSeconds",
        "description": "Timeout for the list/watch call.",
        "required": false,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.PersistentVolumeList"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf",
       "application/json;stream=watch",
       "application/vnd.kubernetes.protobuf;stream=watch"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "v1.PersistentVolume",
      "method": "POST",
      "summary": "create a PersistentVolume",
      "nickname": "createPersistentVolume",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "v1.PersistentVolume",
        "paramType": "body",
        "name": "body",
        "description": "",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.PersistentVolume"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "v1.Status",
      "method": "DELETE",
      "summary": "delete collection of PersistentVolume",
      "nickname": "deletecollectionPersistentVolume",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "labelSelector",
        "description": "A selector to restrict the list of returned objects by their labels. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "fieldSelector",
        "description": "A selector to restrict the list of returned objects by their fields. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "watch",
        "description": "Watch for changes to the described resources and return them as a stream of add, update, and remove notifications. Specify resourceVersion.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "resourceVersion",
        "description": "When specified with a watch call, shows changes that occur after that particular version of a resource. Defaults to changes from the beginning of history. When specified for list: - if unset, then the result is returned from remote storage based on quorum-read flag; - if it's 0, then we simply return what we currently have in cache, no guarantee; - if set to non zero, then the result is at least as fresh as given rv.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "timeoutSeconds",
        "description": "Timeout for the list/watch call.",
        "required": false,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.Status"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/watch/persistentvolumes",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.WatchEvent",
      "method": "GET",
      "summary": "watch individual changes to a list of PersistentVolume",
      "nickname": "watchPersistentVolumeList",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "labelSelector",
        "description": "A selector to restrict the list of returned objects by their labels. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "fieldSelector",
        "description": "A selector to restrict the list of returned objects by their fields. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "watch",
        "description": "Watch for changes to the described resources and return them as a stream of add, update, and remove notifications. Specify resourceVersion.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "resourceVersion",
        "description": "When specified with a watch call, shows changes that occur after that particular version of a resource. Defaults to changes from the beginning of history. When specified for list: - if unset, then the result is returned from remote storage based on quorum-read flag; - if it's 0, then we simply return what we currently have in cache, no guarantee; - if set to non zero, then the result is at least as fresh as given rv.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "timeoutSeconds",
        "description": "Timeout for the list/watch call.",
        "required": false,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.WatchEvent"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf",
       "application/json;stream=watch",
       "application/vnd.kubernetes.protobuf;stream=watch"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/persistentvolumes/{name}",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.PersistentVolume",
      "method": "GET",
      "summary": "read the specified PersistentVolume",
      "nickname": "readPersistentVolume",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "export",
        "description": "Should this value be exported.  Export strips fields that a user can not specify.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "exact",
        "description": "Should the export be exact.  Exact export maintains cluster-specific fields like 'Namespace'.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the PersistentVolume",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.PersistentVolume"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "v1.PersistentVolume",
      "method": "PUT",
      "summary": "replace the specified PersistentVolume",
      "nickname": "replacePersistentVolume",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "v1.PersistentVolume",
        "paramType": "body",
        "name": "body",
        "description": "",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the PersistentVolume",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.PersistentVolume"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "v1.PersistentVolume",
      "method": "PATCH",
      "summary": "partially update the specified PersistentVolume",
      "nickname": "patchPersistentVolume",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "v1.Patch",
        "paramType": "body",
        "name": "body",
        "description": "",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the PersistentVolume",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.PersistentVolume"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "application/json-patch+json",
       "application/merge-patch+json",
       "application/strategic-merge-patch+json"
      ]
     },
     {
      "type": "v1.Status",
      "method": "DELETE",
      "summary": "delete a PersistentVolume",
      "nickname": "deletePersistentVolume",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "v1.DeleteOptions",
        "paramType": "body",
        "name": "body",
        "description": "",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "gracePeriodSeconds",
        "description": "The duration in seconds before the object should be deleted. Value must be non-negative integer. The value zero indicates delete immediately. If this value is nil, the default grace period for the specified type will be used. Defaults to a per object value if not specified. zero means delete immediately.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "orphanDependents",
        "description": "Deprecated: please use the PropagationPolicy, this field will be deprecated in 1.7. Should the dependent objects be orphaned. If true/false, the \"orphan\" finalizer will be added to/removed from the object's finalizers list. Either this field or PropagationPolicy may be set, but not both.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "propagationPolicy",
        "description": "Whether and how garbage collection will be performed. Either this field or OrphanDependents may be set, but not both. The default policy is decided by the existing finalizer set in the metadata.finalizers and the resource-specific default policy.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the PersistentVolume",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.Status"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/watch/persistentvolumes/{name}",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.WatchEvent",
      "method": "GET",
      "summary": "watch changes to an object of kind PersistentVolume",
      "nickname": "watchPersistentVolume",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "labelSelector",
        "description": "A selector to restrict the list of returned objects by their labels. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "fieldSelector",
        "description": "A selector to restrict the list of returned objects by their fields. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "watch",
        "description": "Watch for changes to the described resources and return them as a stream of add, update, and remove notifications. Specify resourceVersion.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "resourceVersion",
        "description": "When specified with a watch call, shows changes that occur after that particular version of a resource. Defaults to changes from the beginning of history. When specified for list: - if unset, then the result is returned from remote storage based on quorum-read flag; - if it's 0, then we simply return what we currently have in cache, no guarantee; - if set to non zero, then the result is at least as fresh as given rv.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "timeoutSeconds",
        "description": "Timeout for the list/watch call.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the PersistentVolume",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.WatchEvent"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf",
       "application/json;stream=watch",
       "application/vnd.kubernetes.protobuf;stream=watch"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/persistentvolumes/{name}/status",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.PersistentVolume",
      "method": "GET",
      "summary": "read status of the specified PersistentVolume",
      "nickname": "readPersistentVolumeStatus",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the PersistentVolume",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.PersistentVolume"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "v1.PersistentVolume",
      "method": "PUT",
      "summary": "replace status of the specified PersistentVolume",
      "nickname": "replacePersistentVolumeStatus",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "v1.PersistentVolume",
        "paramType": "body",
        "name": "body",
        "description": "",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the PersistentVolume",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.PersistentVolume"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "v1.PersistentVolume",
      "method": "PATCH",
      "summary": "partially update status of the specified PersistentVolume",
      "nickname": "patchPersistentVolumeStatus",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "v1.Patch",
        "paramType": "body",
        "name": "body",
        "description": "",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the PersistentVolume",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.PersistentVolume"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "application/json-patch+json",
       "application/merge-patch+json",
       "application/strategic-merge-patch+json"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/namespaces/{namespace}/pods",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.PodList",
      "method": "GET",
      "summary": "list or watch objects of kind Pod",
      "nickname": "listNamespacedPod",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "labelSelector",
        "description": "A selector to restrict the list of returned objects by their labels. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "fieldSelector",
        "description": "A selector to restrict the list of returned objects by their fields. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "watch",
        "description": "Watch for changes to the described resources and return them as a stream of add, update, and remove notifications. Specify resourceVersion.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "resourceVersion",
        "description": "When specified with a watch call, shows changes that occur after that particular version of a resource. Defaults to changes from the beginning of history. When specified for list: - if unset, then the result is returned from remote storage based on quorum-read flag; - if it's 0, then we simply return what we currently have in cache, no guarantee; - if set to non zero, then the result is at least as fresh as given rv.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "timeoutSeconds",
        "description": "Timeout for the list/watch call.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.PodList"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf",
       "application/json;stream=watch",
       "application/vnd.kubernetes.protobuf;stream=watch"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "v1.Pod",
      "method": "POST",
      "summary": "create a Pod",
      "nickname": "createNamespacedPod",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "v1.Pod",
        "paramType": "body",
        "name": "body",
        "description": "",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.Pod"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "v1.Status",
      "method": "DELETE",
      "summary": "delete collection of Pod",
      "nickname": "deletecollectionNamespacedPod",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "labelSelector",
        "description": "A selector to restrict the list of returned objects by their labels. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "fieldSelector",
        "description": "A selector to restrict the list of returned objects by their fields. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "watch",
        "description": "Watch for changes to the described resources and return them as a stream of add, update, and remove notifications. Specify resourceVersion.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "resourceVersion",
        "description": "When specified with a watch call, shows changes that occur after that particular version of a resource. Defaults to changes from the beginning of history. When specified for list: - if unset, then the result is returned from remote storage based on quorum-read flag; - if it's 0, then we simply return what we currently have in cache, no guarantee; - if set to non zero, then the result is at least as fresh as given rv.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "timeoutSeconds",
        "description": "Timeout for the list/watch call.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.Status"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/watch/namespaces/{namespace}/pods",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.WatchEvent",
      "method": "GET",
      "summary": "watch individual changes to a list of Pod",
      "nickname": "watchNamespacedPodList",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "labelSelector",
        "description": "A selector to restrict the list of returned objects by their labels. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "fieldSelector",
        "description": "A selector to restrict the list of returned objects by their fields. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "watch",
        "description": "Watch for changes to the described resources and return them as a stream of add, update, and remove notifications. Specify resourceVersion.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "resourceVersion",
        "description": "When specified with a watch call, shows changes that occur after that particular version of a resource. Defaults to changes from the beginning of history. When specified for list: - if unset, then the result is returned from remote storage based on quorum-read flag; - if it's 0, then we simply return what we currently have in cache, no guarantee; - if set to non zero, then the result is at least as fresh as given rv.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "timeoutSeconds",
        "description": "Timeout for the list/watch call.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.WatchEvent"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf",
       "application/json;stream=watch",
       "application/vnd.kubernetes.protobuf;stream=watch"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/namespaces/{namespace}/pods/{name}",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.Pod",
      "method": "GET",
      "summary": "read the specified Pod",
      "nickname": "readNamespacedPod",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "export",
        "description": "Should this value be exported.  Export strips fields that a user can not specify.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "exact",
        "description": "Should the export be exact.  Exact export maintains cluster-specific fields like 'Namespace'.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Pod",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.Pod"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "v1.Pod",
      "method": "PUT",
      "summary": "replace the specified Pod",
      "nickname": "replaceNamespacedPod",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "v1.Pod",
        "paramType": "body",
        "name": "body",
        "description": "",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Pod",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.Pod"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "v1.Pod",
      "method": "PATCH",
      "summary": "partially update the specified Pod",
      "nickname": "patchNamespacedPod",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "v1.Patch",
        "paramType": "body",
        "name": "body",
        "description": "",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Pod",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.Pod"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "application/json-patch+json",
       "application/merge-patch+json",
       "application/strategic-merge-patch+json"
      ]
     },
     {
      "type": "v1.Status",
      "method": "DELETE",
      "summary": "delete a Pod",
      "nickname": "deleteNamespacedPod",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "v1.DeleteOptions",
        "paramType": "body",
        "name": "body",
        "description": "",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "gracePeriodSeconds",
        "description": "The duration in seconds before the object should be deleted. Value must be non-negative integer. The value zero indicates delete immediately. If this value is nil, the default grace period for the specified type will be used. Defaults to a per object value if not specified. zero means delete immediately.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "orphanDependents",
        "description": "Deprecated: please use the PropagationPolicy, this field will be deprecated in 1.7. Should the dependent objects be orphaned. If true/false, the \"orphan\" finalizer will be added to/removed from the object's finalizers list. Either this field or PropagationPolicy may be set, but not both.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "propagationPolicy",
        "description": "Whether and how garbage collection will be performed. Either this field or OrphanDependents may be set, but not both. The default policy is decided by the existing finalizer set in the metadata.finalizers and the resource-specific default policy.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Pod",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.Status"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/watch/namespaces/{namespace}/pods/{name}",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.WatchEvent",
      "method": "GET",
      "summary": "watch changes to an object of kind Pod",
      "nickname": "watchNamespacedPod",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "labelSelector",
        "description": "A selector to restrict the list of returned objects by their labels. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "fieldSelector",
        "description": "A selector to restrict the list of returned objects by their fields. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "watch",
        "description": "Watch for changes to the described resources and return them as a stream of add, update, and remove notifications. Specify resourceVersion.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "resourceVersion",
        "description": "When specified with a watch call, shows changes that occur after that particular version of a resource. Defaults to changes from the beginning of history. When specified for list: - if unset, then the result is returned from remote storage based on quorum-read flag; - if it's 0, then we simply return what we currently have in cache, no guarantee; - if set to non zero, then the result is at least as fresh as given rv.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "timeoutSeconds",
        "description": "Timeout for the list/watch call.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Pod",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.WatchEvent"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf",
       "application/json;stream=watch",
       "application/vnd.kubernetes.protobuf;stream=watch"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/proxy/namespaces/{namespace}/pods/{name}/{path}",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "string",
      "method": "GET",
      "summary": "proxy GET requests to Pod",
      "nickname": "proxyGETNamespacedPodWithPath",
      "parameters": [
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Pod",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "path",
        "description": "path to the resource",
        "required": true,
        "allowMultiple": false
       }
      ],
      "produces": [
       "*/*"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "string",
      "method": "PUT",
      "summary": "proxy PUT requests to Pod",
      "nickname": "proxyPUTNamespacedPodWithPath",
      "parameters": [
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Pod",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "path",
        "description": "path to the resource",
        "required": true,
        "allowMultiple": false
       }
      ],
      "produces": [
       "*/*"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "string",
      "method": "POST",
      "summary": "proxy POST requests to Pod",
      "nickname": "proxyPOSTNamespacedPodWithPath",
      "parameters": [
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Pod",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "path",
        "description": "path to the resource",
        "required": true,
        "allowMultiple": false
       }
      ],
      "produces": [
       "*/*"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "string",
      "method": "PATCH",
      "summary": "proxy PATCH requests to Pod",
      "nickname": "proxyPATCHNamespacedPodWithPath",
      "parameters": [
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Pod",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "path",
        "description": "path to the resource",
        "required": true,
        "allowMultiple": false
       }
      ],
      "produces": [
       "*/*"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "string",
      "method": "DELETE",
      "summary": "proxy DELETE requests to Pod",
      "nickname": "proxyDELETENamespacedPodWithPath",
      "parameters": [
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Pod",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "path",
        "description": "path to the resource",
        "required": true,
        "allowMultiple": false
       }
      ],
      "produces": [
       "*/*"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "string",
      "method": "HEAD",
      "summary": "proxy HEAD requests to Pod",
      "nickname": "proxyHEADNamespacedPodWithPath",
      "parameters": [
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Pod",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "path",
        "description": "path to the resource",
        "required": true,
        "allowMultiple": false
       }
      ],
      "produces": [
       "*/*"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "string",
      "method": "OPTIONS",
      "summary": "proxy OPTIONS requests to Pod",
      "nickname": "proxyOPTIONSNamespacedPodWithPath",
      "parameters": [
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Pod",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "path",
        "description": "path to the resource",
        "required": true,
        "allowMultiple": false
       }
      ],
      "produces": [
       "*/*"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/proxy/namespaces/{namespace}/pods/{name}",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "string",
      "method": "GET",
      "summary": "proxy GET requests to Pod",
      "nickname": "proxyGETNamespacedPod",
      "parameters": [
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Pod",
        "required": true,
        "allowMultiple": false
       }
      ],
      "produces": [
       "*/*"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "string",
      "method": "PUT",
      "summary": "proxy PUT requests to Pod",
      "nickname": "proxyPUTNamespacedPod",
      "parameters": [
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Pod",
        "required": true,
        "allowMultiple": false
       }
      ],
      "produces": [
       "*/*"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "string",
      "method": "POST",
      "summary": "proxy POST requests to Pod",
      "nickname": "proxyPOSTNamespacedPod",
      "parameters": [
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Pod",
        "required": true,
        "allowMultiple": false
       }
      ],
      "produces": [
       "*/*"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "string",
      "method": "PATCH",
      "summary": "proxy PATCH requests to Pod",
      "nickname": "proxyPATCHNamespacedPod",
      "parameters": [
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Pod",
        "required": true,
        "allowMultiple": false
       }
      ],
      "produces": [
       "*/*"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "string",
      "method": "DELETE",
      "summary": "proxy DELETE requests to Pod",
      "nickname": "proxyDELETENamespacedPod",
      "parameters": [
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Pod",
        "required": true,
        "allowMultiple": false
       }
      ],
      "produces": [
       "*/*"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "string",
      "method": "HEAD",
      "summary": "proxy HEAD requests to Pod",
      "nickname": "proxyHEADNamespacedPod",
      "parameters": [
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Pod",
        "required": true,
        "allowMultiple": false
       }
      ],
      "produces": [
       "*/*"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "string",
      "method": "OPTIONS",
      "summary": "proxy OPTIONS requests to Pod",
      "nickname": "proxyOPTIONSNamespacedPod",
      "parameters": [
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Pod",
        "required": true,
        "allowMultiple": false
       }
      ],
      "produces": [
       "*/*"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/pods",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.PodList",
      "method": "GET",
      "summary": "list or watch objects of kind Pod",
      "nickname": "listPodForAllNamespaces",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "labelSelector",
        "description": "A selector to restrict the list of returned objects by their labels. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "fieldSelector",
        "description": "A selector to restrict the list of returned objects by their fields. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "watch",
        "description": "Watch for changes to the described resources and return them as a stream of add, update, and remove notifications. Specify resourceVersion.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "resourceVersion",
        "description": "When specified with a watch call, shows changes that occur after that particular version of a resource. Defaults to changes from the beginning of history. When specified for list: - if unset, then the result is returned from remote storage based on quorum-read flag; - if it's 0, then we simply return what we currently have in cache, no guarantee; - if set to non zero, then the result is at least as fresh as given rv.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "timeoutSeconds",
        "description": "Timeout for the list/watch call.",
        "required": false,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.PodList"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf",
       "application/json;stream=watch",
       "application/vnd.kubernetes.protobuf;stream=watch"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/watch/pods",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.WatchEvent",
      "method": "GET",
      "summary": "watch individual changes to a list of Pod",
      "nickname": "watchPodListForAllNamespaces",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "labelSelector",
        "description": "A selector to restrict the list of returned objects by their labels. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "fieldSelector",
        "description": "A selector to restrict the list of returned objects by their fields. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "watch",
        "description": "Watch for changes to the described resources and return them as a stream of add, update, and remove notifications. Specify resourceVersion.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "resourceVersion",
        "description": "When specified with a watch call, shows changes that occur after that particular version of a resource. Defaults to changes from the beginning of history. When specified for list: - if unset, then the result is returned from remote storage based on quorum-read flag; - if it's 0, then we simply return what we currently have in cache, no guarantee; - if set to non zero, then the result is at least as fresh as given rv.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "timeoutSeconds",
        "description": "Timeout for the list/watch call.",
        "required": false,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.WatchEvent"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf",
       "application/json;stream=watch",
       "application/vnd.kubernetes.protobuf;stream=watch"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/namespaces/{namespace}/pods/{name}/attach",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "string",
      "method": "GET",
      "summary": "connect GET requests to attach of Pod",
      "nickname": "connectGetNamespacedPodAttach",
      "parameters": [
       {
        "type": "boolean",
        "paramType": "query",
        "name": "stdin",
        "description": "Stdin if true, redirects the standard input stream of the pod for this call. Defaults to false.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "stdout",
        "description": "Stdout if true indicates that stdout is to be redirected for the attach call. Defaults to true.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "stderr",
        "description": "Stderr if true indicates that stderr is to be redirected for the attach call. Defaults to true.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "tty",
        "description": "TTY if true indicates that a tty will be allocated for the attach call. This is passed through the container runtime so the tty is allocated on the worker node by the container runtime. Defaults to false.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "container",
        "description": "The container in which to execute the command. Defaults to only container if there is only one container in the pod.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Pod",
        "required": true,
        "allowMultiple": false
       }
      ],
      "produces": [
       "*/*"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "string",
      "method": "POST",
      "summary": "connect POST requests to attach of Pod",
      "nickname": "connectPostNamespacedPodAttach",
      "parameters": [
       {
        "type": "boolean",
        "paramType": "query",
        "name": "stdin",
        "description": "Stdin if true, redirects the standard input stream of the pod for this call. Defaults to false.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "stdout",
        "description": "Stdout if true indicates that stdout is to be redirected for the attach call. Defaults to true.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "stderr",
        "description": "Stderr if true indicates that stderr is to be redirected for the attach call. Defaults to true.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "tty",
        "description": "TTY if true indicates that a tty will be allocated for the attach call. This is passed through the container runtime so the tty is allocated on the worker node by the container runtime. Defaults to false.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "container",
        "description": "The container in which to execute the command. Defaults to only container if there is only one container in the pod.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Pod",
        "required": true,
        "allowMultiple": false
       }
      ],
      "produces": [
       "*/*"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/namespaces/{namespace}/pods/{name}/binding",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.Binding",
      "method": "POST",
      "summary": "create binding of a Binding",
      "nickname": "createNamespacedBindingBinding",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "v1.Binding",
        "paramType": "body",
        "name": "body",
        "description": "",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Binding",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.Binding"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/namespaces/{namespace}/pods/{name}/eviction",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1beta1.Eviction",
      "method": "POST",
      "summary": "create eviction of an Eviction",
      "nickname": "createNamespacedEvictionEviction",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "v1beta1.Eviction",
        "paramType": "body",
        "name": "body",
        "description": "",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Eviction",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1beta1.Eviction"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/namespaces/{namespace}/pods/{name}/exec",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "string",
      "method": "GET",
      "summary": "connect GET requests to exec of Pod",
      "nickname": "connectGetNamespacedPodExec",
      "parameters": [
       {
        "type": "boolean",
        "paramType": "query",
        "name": "stdin",
        "description": "Redirect the standard input stream of the pod for this call. Defaults to false.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "stdout",
        "description": "Redirect the standard output stream of the pod for this call. Defaults to true.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "stderr",
        "description": "Redirect the standard error stream of the pod for this call. Defaults to true.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "tty",
        "description": "TTY if true indicates that a tty will be allocated for the exec call. Defaults to false.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "container",
        "description": "Container in which to execute the command. Defaults to only container if there is only one container in the pod.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "command",
        "description": "Command is the remote command to execute. argv array. Not executed within a shell.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Pod",
        "required": true,
        "allowMultiple": false
       }
      ],
      "produces": [
       "*/*"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "string",
      "method": "POST",
      "summary": "connect POST requests to exec of Pod",
      "nickname": "connectPostNamespacedPodExec",
      "parameters": [
       {
        "type": "boolean",
        "paramType": "query",
        "name": "stdin",
        "description": "Redirect the standard input stream of the pod for this call. Defaults to false.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "stdout",
        "description": "Redirect the standard output stream of the pod for this call. Defaults to true.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "stderr",
        "description": "Redirect the standard error stream of the pod for this call. Defaults to true.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "tty",
        "description": "TTY if true indicates that a tty will be allocated for the exec call. Defaults to false.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "container",
        "description": "Container in which to execute the command. Defaults to only container if there is only one container in the pod.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "command",
        "description": "Command is the remote command to execute. argv array. Not executed within a shell.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Pod",
        "required": true,
        "allowMultiple": false
       }
      ],
      "produces": [
       "*/*"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/namespaces/{namespace}/pods/{name}/log",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "string",
      "method": "GET",
      "summary": "read log of the specified Pod",
      "nickname": "readNamespacedPodLog",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "container",
        "description": "The container for which to stream logs. Defaults to only container if there is one container in the pod.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "follow",
        "description": "Follow the log stream of the pod. Defaults to false.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "previous",
        "description": "Return previous terminated container logs. Defaults to false.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "sinceSeconds",
        "description": "A relative time in seconds before the current time from which to show logs. If this value precedes the time a pod was started, only logs since the pod start will be returned. If this value is in the future, no logs will be returned. Only one of sinceSeconds or sinceTime may be specified.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "timestamps",
        "description": "If true, add an RFC3339 or RFC3339Nano timestamp at the beginning of every line of log output. Defaults to false.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "tailLines",
        "description": "If set, the number of lines from the end of the logs to show. If not specified, logs are shown from the creation of the container or sinceSeconds or sinceTime",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "limitBytes",
        "description": "If set, the number of bytes to read from the server before terminating the log output. This may not display a complete final line of logging, and may return slightly more or slightly less than the specified limit.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Pod",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "string"
       }
      ],
      "produces": [
       "text/plain",
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/namespaces/{namespace}/pods/{name}/portforward",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "string",
      "method": "GET",
      "summary": "connect GET requests to portforward of Pod",
      "nickname": "connectGetNamespacedPodPortforward",
      "parameters": [
       {
        "type": "integer",
        "paramType": "query",
        "name": "ports",
        "description": "List of ports to forward Required when using WebSockets",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Pod",
        "required": true,
        "allowMultiple": false
       }
      ],
      "produces": [
       "*/*"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "string",
      "method": "POST",
      "summary": "connect POST requests to portforward of Pod",
      "nickname": "connectPostNamespacedPodPortforward",
      "parameters": [
       {
        "type": "integer",
        "paramType": "query",
        "name": "ports",
        "description": "List of ports to forward Required when using WebSockets",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Pod",
        "required": true,
        "allowMultiple": false
       }
      ],
      "produces": [
       "*/*"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/namespaces/{namespace}/pods/{name}/proxy",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "string",
      "method": "GET",
      "summary": "connect GET requests to proxy of Pod",
      "nickname": "connectGetNamespacedPodProxy",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "path",
        "description": "Path is the URL path to use for the current proxy request to pod.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Pod",
        "required": true,
        "allowMultiple": false
       }
      ],
      "produces": [
       "*/*"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "string",
      "method": "POST",
      "summary": "connect POST requests to proxy of Pod",
      "nickname": "connectPostNamespacedPodProxy",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "path",
        "description": "Path is the URL path to use for the current proxy request to pod.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Pod",
        "required": true,
        "allowMultiple": false
       }
      ],
      "produces": [
       "*/*"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "string",
      "method": "PUT",
      "summary": "connect PUT requests to proxy of Pod",
      "nickname": "connectPutNamespacedPodProxy",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "path",
        "description": "Path is the URL path to use for the current proxy request to pod.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Pod",
        "required": true,
        "allowMultiple": false
       }
      ],
      "produces": [
       "*/*"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "string",
      "method": "PATCH",
      "summary": "connect PATCH requests to proxy of Pod",
      "nickname": "connectPatchNamespacedPodProxy",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "path",
        "description": "Path is the URL path to use for the current proxy request to pod.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Pod",
        "required": true,
        "allowMultiple": false
       }
      ],
      "produces": [
       "*/*"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "string",
      "method": "DELETE",
      "summary": "connect DELETE requests to proxy of Pod",
      "nickname": "connectDeleteNamespacedPodProxy",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "path",
        "description": "Path is the URL path to use for the current proxy request to pod.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Pod",
        "required": true,
        "allowMultiple": false
       }
      ],
      "produces": [
       "*/*"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "string",
      "method": "HEAD",
      "summary": "connect HEAD requests to proxy of Pod",
      "nickname": "connectHeadNamespacedPodProxy",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "path",
        "description": "Path is the URL path to use for the current proxy request to pod.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Pod",
        "required": true,
        "allowMultiple": false
       }
      ],
      "produces": [
       "*/*"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "string",
      "method": "OPTIONS",
      "summary": "connect OPTIONS requests to proxy of Pod",
      "nickname": "connectOptionsNamespacedPodProxy",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "path",
        "description": "Path is the URL path to use for the current proxy request to pod.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Pod",
        "required": true,
        "allowMultiple": false
       }
      ],
      "produces": [
       "*/*"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/namespaces/{namespace}/pods/{name}/proxy/{path}",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "string",
      "method": "GET",
      "summary": "connect GET requests to proxy of Pod",
      "nickname": "connectGetNamespacedPodProxyWithPath",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "path",
        "description": "Path is the URL path to use for the current proxy request to pod.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Pod",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "path",
        "description": "path to the resource",
        "required": true,
        "allowMultiple": false
       }
      ],
      "produces": [
       "*/*"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "string",
      "method": "POST",
      "summary": "connect POST requests to proxy of Pod",
      "nickname": "connectPostNamespacedPodProxyWithPath",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "path",
        "description": "Path is the URL path to use for the current proxy request to pod.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Pod",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "path",
        "description": "path to the resource",
        "required": true,
        "allowMultiple": false
       }
      ],
      "produces": [
       "*/*"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "string",
      "method": "PUT",
      "summary": "connect PUT requests to proxy of Pod",
      "nickname": "connectPutNamespacedPodProxyWithPath",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "path",
        "description": "Path is the URL path to use for the current proxy request to pod.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Pod",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "path",
        "description": "path to the resource",
        "required": true,
        "allowMultiple": false
       }
      ],
      "produces": [
       "*/*"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "string",
      "method": "PATCH",
      "summary": "connect PATCH requests to proxy of Pod",
      "nickname": "connectPatchNamespacedPodProxyWithPath",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "path",
        "description": "Path is the URL path to use for the current proxy request to pod.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Pod",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "path",
        "description": "path to the resource",
        "required": true,
        "allowMultiple": false
       }
      ],
      "produces": [
       "*/*"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "string",
      "method": "DELETE",
      "summary": "connect DELETE requests to proxy of Pod",
      "nickname": "connectDeleteNamespacedPodProxyWithPath",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "path",
        "description": "Path is the URL path to use for the current proxy request to pod.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Pod",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "path",
        "description": "path to the resource",
        "required": true,
        "allowMultiple": false
       }
      ],
      "produces": [
       "*/*"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "string",
      "method": "HEAD",
      "summary": "connect HEAD requests to proxy of Pod",
      "nickname": "connectHeadNamespacedPodProxyWithPath",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "path",
        "description": "Path is the URL path to use for the current proxy request to pod.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Pod",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "path",
        "description": "path to the resource",
        "required": true,
        "allowMultiple": false
       }
      ],
      "produces": [
       "*/*"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "string",
      "method": "OPTIONS",
      "summary": "connect OPTIONS requests to proxy of Pod",
      "nickname": "connectOptionsNamespacedPodProxyWithPath",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "path",
        "description": "Path is the URL path to use for the current proxy request to pod.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Pod",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "path",
        "description": "path to the resource",
        "required": true,
        "allowMultiple": false
       }
      ],
      "produces": [
       "*/*"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/namespaces/{namespace}/pods/{name}/status",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.Pod",
      "method": "GET",
      "summary": "read status of the specified Pod",
      "nickname": "readNamespacedPodStatus",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Pod",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.Pod"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "v1.Pod",
      "method": "PUT",
      "summary": "replace status of the specified Pod",
      "nickname": "replaceNamespacedPodStatus",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "v1.Pod",
        "paramType": "body",
        "name": "body",
        "description": "",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Pod",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.Pod"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "v1.Pod",
      "method": "PATCH",
      "summary": "partially update status of the specified Pod",
      "nickname": "patchNamespacedPodStatus",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "v1.Patch",
        "paramType": "body",
        "name": "body",
        "description": "",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Pod",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.Pod"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "application/json-patch+json",
       "application/merge-patch+json",
       "application/strategic-merge-patch+json"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/namespaces/{namespace}/podtemplates",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.PodTemplateList",
      "method": "GET",
      "summary": "list or watch objects of kind PodTemplate",
      "nickname": "listNamespacedPodTemplate",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "labelSelector",
        "description": "A selector to restrict the list of returned objects by their labels. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "fieldSelector",
        "description": "A selector to restrict the list of returned objects by their fields. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "watch",
        "description": "Watch for changes to the described resources and return them as a stream of add, update, and remove notifications. Specify resourceVersion.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "resourceVersion",
        "description": "When specified with a watch call, shows changes that occur after that particular version of a resource. Defaults to changes from the beginning of history. When specified for list: - if unset, then the result is returned from remote storage based on quorum-read flag; - if it's 0, then we simply return what we currently have in cache, no guarantee; - if set to non zero, then the result is at least as fresh as given rv.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "timeoutSeconds",
        "description": "Timeout for the list/watch call.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.PodTemplateList"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf",
       "application/json;stream=watch",
       "application/vnd.kubernetes.protobuf;stream=watch"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "v1.PodTemplate",
      "method": "POST",
      "summary": "create a PodTemplate",
      "nickname": "createNamespacedPodTemplate",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "v1.PodTemplate",
        "paramType": "body",
        "name": "body",
        "description": "",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.PodTemplate"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "v1.Status",
      "method": "DELETE",
      "summary": "delete collection of PodTemplate",
      "nickname": "deletecollectionNamespacedPodTemplate",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "labelSelector",
        "description": "A selector to restrict the list of returned objects by their labels. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "fieldSelector",
        "description": "A selector to restrict the list of returned objects by their fields. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "watch",
        "description": "Watch for changes to the described resources and return them as a stream of add, update, and remove notifications. Specify resourceVersion.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "resourceVersion",
        "description": "When specified with a watch call, shows changes that occur after that particular version of a resource. Defaults to changes from the beginning of history. When specified for list: - if unset, then the result is returned from remote storage based on quorum-read flag; - if it's 0, then we simply return what we currently have in cache, no guarantee; - if set to non zero, then the result is at least as fresh as given rv.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "timeoutSeconds",
        "description": "Timeout for the list/watch call.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.Status"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/watch/namespaces/{namespace}/podtemplates",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.WatchEvent",
      "method": "GET",
      "summary": "watch individual changes to a list of PodTemplate",
      "nickname": "watchNamespacedPodTemplateList",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "labelSelector",
        "description": "A selector to restrict the list of returned objects by their labels. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "fieldSelector",
        "description": "A selector to restrict the list of returned objects by their fields. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "watch",
        "description": "Watch for changes to the described resources and return them as a stream of add, update, and remove notifications. Specify resourceVersion.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "resourceVersion",
        "description": "When specified with a watch call, shows changes that occur after that particular version of a resource. Defaults to changes from the beginning of history. When specified for list: - if unset, then the result is returned from remote storage based on quorum-read flag; - if it's 0, then we simply return what we currently have in cache, no guarantee; - if set to non zero, then the result is at least as fresh as given rv.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "timeoutSeconds",
        "description": "Timeout for the list/watch call.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.WatchEvent"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf",
       "application/json;stream=watch",
       "application/vnd.kubernetes.protobuf;stream=watch"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/namespaces/{namespace}/podtemplates/{name}",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.PodTemplate",
      "method": "GET",
      "summary": "read the specified PodTemplate",
      "nickname": "readNamespacedPodTemplate",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "export",
        "description": "Should this value be exported.  Export strips fields that a user can not specify.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "exact",
        "description": "Should the export be exact.  Exact export maintains cluster-specific fields like 'Namespace'.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the PodTemplate",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.PodTemplate"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "v1.PodTemplate",
      "method": "PUT",
      "summary": "replace the specified PodTemplate",
      "nickname": "replaceNamespacedPodTemplate",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "v1.PodTemplate",
        "paramType": "body",
        "name": "body",
        "description": "",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the PodTemplate",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.PodTemplate"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "v1.PodTemplate",
      "method": "PATCH",
      "summary": "partially update the specified PodTemplate",
      "nickname": "patchNamespacedPodTemplate",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "v1.Patch",
        "paramType": "body",
        "name": "body",
        "description": "",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the PodTemplate",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.PodTemplate"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "application/json-patch+json",
       "application/merge-patch+json",
       "application/strategic-merge-patch+json"
      ]
     },
     {
      "type": "v1.Status",
      "method": "DELETE",
      "summary": "delete a PodTemplate",
      "nickname": "deleteNamespacedPodTemplate",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "v1.DeleteOptions",
        "paramType": "body",
        "name": "body",
        "description": "",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "gracePeriodSeconds",
        "description": "The duration in seconds before the object should be deleted. Value must be non-negative integer. The value zero indicates delete immediately. If this value is nil, the default grace period for the specified type will be used. Defaults to a per object value if not specified. zero means delete immediately.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "orphanDependents",
        "description": "Deprecated: please use the PropagationPolicy, this field will be deprecated in 1.7. Should the dependent objects be orphaned. If true/false, the \"orphan\" finalizer will be added to/removed from the object's finalizers list. Either this field or PropagationPolicy may be set, but not both.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "propagationPolicy",
        "description": "Whether and how garbage collection will be performed. Either this field or OrphanDependents may be set, but not both. The default policy is decided by the existing finalizer set in the metadata.finalizers and the resource-specific default policy.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the PodTemplate",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.Status"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/watch/namespaces/{namespace}/podtemplates/{name}",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.WatchEvent",
      "method": "GET",
      "summary": "watch changes to an object of kind PodTemplate",
      "nickname": "watchNamespacedPodTemplate",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "labelSelector",
        "description": "A selector to restrict the list of returned objects by their labels. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "fieldSelector",
        "description": "A selector to restrict the list of returned objects by their fields. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "watch",
        "description": "Watch for changes to the described resources and return them as a stream of add, update, and remove notifications. Specify resourceVersion.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "resourceVersion",
        "description": "When specified with a watch call, shows changes that occur after that particular version of a resource. Defaults to changes from the beginning of history. When specified for list: - if unset, then the result is returned from remote storage based on quorum-read flag; - if it's 0, then we simply return what we currently have in cache, no guarantee; - if set to non zero, then the result is at least as fresh as given rv.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "timeoutSeconds",
        "description": "Timeout for the list/watch call.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the PodTemplate",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.WatchEvent"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf",
       "application/json;stream=watch",
       "application/vnd.kubernetes.protobuf;stream=watch"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/podtemplates",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.PodTemplateList",
      "method": "GET",
      "summary": "list or watch objects of kind PodTemplate",
      "nickname": "listPodTemplateForAllNamespaces",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "labelSelector",
        "description": "A selector to restrict the list of returned objects by their labels. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "fieldSelector",
        "description": "A selector to restrict the list of returned objects by their fields. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "watch",
        "description": "Watch for changes to the described resources and return them as a stream of add, update, and remove notifications. Specify resourceVersion.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "resourceVersion",
        "description": "When specified with a watch call, shows changes that occur after that particular version of a resource. Defaults to changes from the beginning of history. When specified for list: - if unset, then the result is returned from remote storage based on quorum-read flag; - if it's 0, then we simply return what we currently have in cache, no guarantee; - if set to non zero, then the result is at least as fresh as given rv.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "timeoutSeconds",
        "description": "Timeout for the list/watch call.",
        "required": false,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.PodTemplateList"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf",
       "application/json;stream=watch",
       "application/vnd.kubernetes.protobuf;stream=watch"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/watch/podtemplates",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.WatchEvent",
      "method": "GET",
      "summary": "watch individual changes to a list of PodTemplate",
      "nickname": "watchPodTemplateListForAllNamespaces",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "labelSelector",
        "description": "A selector to restrict the list of returned objects by their labels. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "fieldSelector",
        "description": "A selector to restrict the list of returned objects by their fields. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "watch",
        "description": "Watch for changes to the described resources and return them as a stream of add, update, and remove notifications. Specify resourceVersion.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "resourceVersion",
        "description": "When specified with a watch call, shows changes that occur after that particular version of a resource. Defaults to changes from the beginning of history. When specified for list: - if unset, then the result is returned from remote storage based on quorum-read flag; - if it's 0, then we simply return what we currently have in cache, no guarantee; - if set to non zero, then the result is at least as fresh as given rv.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "timeoutSeconds",
        "description": "Timeout for the list/watch call.",
        "required": false,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.WatchEvent"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf",
       "application/json;stream=watch",
       "application/vnd.kubernetes.protobuf;stream=watch"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/namespaces/{namespace}/replicationcontrollers",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.ReplicationControllerList",
      "method": "GET",
      "summary": "list or watch objects of kind ReplicationController",
      "nickname": "listNamespacedReplicationController",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "labelSelector",
        "description": "A selector to restrict the list of returned objects by their labels. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "fieldSelector",
        "description": "A selector to restrict the list of returned objects by their fields. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "watch",
        "description": "Watch for changes to the described resources and return them as a stream of add, update, and remove notifications. Specify resourceVersion.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "resourceVersion",
        "description": "When specified with a watch call, shows changes that occur after that particular version of a resource. Defaults to changes from the beginning of history. When specified for list: - if unset, then the result is returned from remote storage based on quorum-read flag; - if it's 0, then we simply return what we currently have in cache, no guarantee; - if set to non zero, then the result is at least as fresh as given rv.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "timeoutSeconds",
        "description": "Timeout for the list/watch call.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.ReplicationControllerList"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf",
       "application/json;stream=watch",
       "application/vnd.kubernetes.protobuf;stream=watch"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "v1.ReplicationController",
      "method": "POST",
      "summary": "create a ReplicationController",
      "nickname": "createNamespacedReplicationController",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "v1.ReplicationController",
        "paramType": "body",
        "name": "body",
        "description": "",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.ReplicationController"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "v1.Status",
      "method": "DELETE",
      "summary": "delete collection of ReplicationController",
      "nickname": "deletecollectionNamespacedReplicationController",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "labelSelector",
        "description": "A selector to restrict the list of returned objects by their labels. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "fieldSelector",
        "description": "A selector to restrict the list of returned objects by their fields. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "watch",
        "description": "Watch for changes to the described resources and return them as a stream of add, update, and remove notifications. Specify resourceVersion.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "resourceVersion",
        "description": "When specified with a watch call, shows changes that occur after that particular version of a resource. Defaults to changes from the beginning of history. When specified for list: - if unset, then the result is returned from remote storage based on quorum-read flag; - if it's 0, then we simply return what we currently have in cache, no guarantee; - if set to non zero, then the result is at least as fresh as given rv.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "timeoutSeconds",
        "description": "Timeout for the list/watch call.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.Status"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/watch/namespaces/{namespace}/replicationcontrollers",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.WatchEvent",
      "method": "GET",
      "summary": "watch individual changes to a list of ReplicationController",
      "nickname": "watchNamespacedReplicationControllerList",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "labelSelector",
        "description": "A selector to restrict the list of returned objects by their labels. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "fieldSelector",
        "description": "A selector to restrict the list of returned objects by their fields. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "watch",
        "description": "Watch for changes to the described resources and return them as a stream of add, update, and remove notifications. Specify resourceVersion.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "resourceVersion",
        "description": "When specified with a watch call, shows changes that occur after that particular version of a resource. Defaults to changes from the beginning of history. When specified for list: - if unset, then the result is returned from remote storage based on quorum-read flag; - if it's 0, then we simply return what we currently have in cache, no guarantee; - if set to non zero, then the result is at least as fresh as given rv.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "timeoutSeconds",
        "description": "Timeout for the list/watch call.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.WatchEvent"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf",
       "application/json;stream=watch",
       "application/vnd.kubernetes.protobuf;stream=watch"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/namespaces/{namespace}/replicationcontrollers/{name}",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.ReplicationController",
      "method": "GET",
      "summary": "read the specified ReplicationController",
      "nickname": "readNamespacedReplicationController",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "export",
        "description": "Should this value be exported.  Export strips fields that a user can not specify.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "exact",
        "description": "Should the export be exact.  Exact export maintains cluster-specific fields like 'Namespace'.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the ReplicationController",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.ReplicationController"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "v1.ReplicationController",
      "method": "PUT",
      "summary": "replace the specified ReplicationController",
      "nickname": "replaceNamespacedReplicationController",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "v1.ReplicationController",
        "paramType": "body",
        "name": "body",
        "description": "",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the ReplicationController",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.ReplicationController"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "v1.ReplicationController",
      "method": "PATCH",
      "summary": "partially update the specified ReplicationController",
      "nickname": "patchNamespacedReplicationController",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "v1.Patch",
        "paramType": "body",
        "name": "body",
        "description": "",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the ReplicationController",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.ReplicationController"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "application/json-patch+json",
       "application/merge-patch+json",
       "application/strategic-merge-patch+json"
      ]
     },
     {
      "type": "v1.Status",
      "method": "DELETE",
      "summary": "delete a ReplicationController",
      "nickname": "deleteNamespacedReplicationController",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "v1.DeleteOptions",
        "paramType": "body",
        "name": "body",
        "description": "",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "gracePeriodSeconds",
        "description": "The duration in seconds before the object should be deleted. Value must be non-negative integer. The value zero indicates delete immediately. If this value is nil, the default grace period for the specified type will be used. Defaults to a per object value if not specified. zero means delete immediately.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "orphanDependents",
        "description": "Deprecated: please use the PropagationPolicy, this field will be deprecated in 1.7. Should the dependent objects be orphaned. If true/false, the \"orphan\" finalizer will be added to/removed from the object's finalizers list. Either this field or PropagationPolicy may be set, but not both.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "propagationPolicy",
        "description": "Whether and how garbage collection will be performed. Either this field or OrphanDependents may be set, but not both. The default policy is decided by the existing finalizer set in the metadata.finalizers and the resource-specific default policy.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the ReplicationController",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.Status"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/watch/namespaces/{namespace}/replicationcontrollers/{name}",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.WatchEvent",
      "method": "GET",
      "summary": "watch changes to an object of kind ReplicationController",
      "nickname": "watchNamespacedReplicationController",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "labelSelector",
        "description": "A selector to restrict the list of returned objects by their labels. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "fieldSelector",
        "description": "A selector to restrict the list of returned objects by their fields. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "watch",
        "description": "Watch for changes to the described resources and return them as a stream of add, update, and remove notifications. Specify resourceVersion.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "resourceVersion",
        "description": "When specified with a watch call, shows changes that occur after that particular version of a resource. Defaults to changes from the beginning of history. When specified for list: - if unset, then the result is returned from remote storage based on quorum-read flag; - if it's 0, then we simply return what we currently have in cache, no guarantee; - if set to non zero, then the result is at least as fresh as given rv.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "timeoutSeconds",
        "description": "Timeout for the list/watch call.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the ReplicationController",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.WatchEvent"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf",
       "application/json;stream=watch",
       "application/vnd.kubernetes.protobuf;stream=watch"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/replicationcontrollers",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.ReplicationControllerList",
      "method": "GET",
      "summary": "list or watch objects of kind ReplicationController",
      "nickname": "listReplicationControllerForAllNamespaces",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "labelSelector",
        "description": "A selector to restrict the list of returned objects by their labels. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "fieldSelector",
        "description": "A selector to restrict the list of returned objects by their fields. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "watch",
        "description": "Watch for changes to the described resources and return them as a stream of add, update, and remove notifications. Specify resourceVersion.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "resourceVersion",
        "description": "When specified with a watch call, shows changes that occur after that particular version of a resource. Defaults to changes from the beginning of history. When specified for list: - if unset, then the result is returned from remote storage based on quorum-read flag; - if it's 0, then we simply return what we currently have in cache, no guarantee; - if set to non zero, then the result is at least as fresh as given rv.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "timeoutSeconds",
        "description": "Timeout for the list/watch call.",
        "required": false,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.ReplicationControllerList"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf",
       "application/json;stream=watch",
       "application/vnd.kubernetes.protobuf;stream=watch"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/watch/replicationcontrollers",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.WatchEvent",
      "method": "GET",
      "summary": "watch individual changes to a list of ReplicationController",
      "nickname": "watchReplicationControllerListForAllNamespaces",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "labelSelector",
        "description": "A selector to restrict the list of returned objects by their labels. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "fieldSelector",
        "description": "A selector to restrict the list of returned objects by their fields. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "watch",
        "description": "Watch for changes to the described resources and return them as a stream of add, update, and remove notifications. Specify resourceVersion.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "resourceVersion",
        "description": "When specified with a watch call, shows changes that occur after that particular version of a resource. Defaults to changes from the beginning of history. When specified for list: - if unset, then the result is returned from remote storage based on quorum-read flag; - if it's 0, then we simply return what we currently have in cache, no guarantee; - if set to non zero, then the result is at least as fresh as given rv.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "timeoutSeconds",
        "description": "Timeout for the list/watch call.",
        "required": false,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.WatchEvent"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf",
       "application/json;stream=watch",
       "application/vnd.kubernetes.protobuf;stream=watch"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/namespaces/{namespace}/replicationcontrollers/{name}/scale",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.Scale",
      "method": "GET",
      "summary": "read scale of the specified Scale",
      "nickname": "readNamespacedScaleScale",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Scale",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.Scale"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "v1.Scale",
      "method": "PUT",
      "summary": "replace scale of the specified Scale",
      "nickname": "replaceNamespacedScaleScale",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "v1.Scale",
        "paramType": "body",
        "name": "body",
        "description": "",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Scale",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.Scale"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "v1.Scale",
      "method": "PATCH",
      "summary": "partially update scale of the specified Scale",
      "nickname": "patchNamespacedScaleScale",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "v1.Patch",
        "paramType": "body",
        "name": "body",
        "description": "",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Scale",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.Scale"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "application/json-patch+json",
       "application/merge-patch+json",
       "application/strategic-merge-patch+json"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/namespaces/{namespace}/replicationcontrollers/{name}/status",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.ReplicationController",
      "method": "GET",
      "summary": "read status of the specified ReplicationController",
      "nickname": "readNamespacedReplicationControllerStatus",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the ReplicationController",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.ReplicationController"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "v1.ReplicationController",
      "method": "PUT",
      "summary": "replace status of the specified ReplicationController",
      "nickname": "replaceNamespacedReplicationControllerStatus",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "v1.ReplicationController",
        "paramType": "body",
        "name": "body",
        "description": "",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the ReplicationController",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.ReplicationController"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "v1.ReplicationController",
      "method": "PATCH",
      "summary": "partially update status of the specified ReplicationController",
      "nickname": "patchNamespacedReplicationControllerStatus",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "v1.Patch",
        "paramType": "body",
        "name": "body",
        "description": "",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the ReplicationController",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.ReplicationController"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "application/json-patch+json",
       "application/merge-patch+json",
       "application/strategic-merge-patch+json"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/namespaces/{namespace}/resourcequotas",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.ResourceQuotaList",
      "method": "GET",
      "summary": "list or watch objects of kind ResourceQuota",
      "nickname": "listNamespacedResourceQuota",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "labelSelector",
        "description": "A selector to restrict the list of returned objects by their labels. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "fieldSelector",
        "description": "A selector to restrict the list of returned objects by their fields. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "watch",
        "description": "Watch for changes to the described resources and return them as a stream of add, update, and remove notifications. Specify resourceVersion.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "resourceVersion",
        "description": "When specified with a watch call, shows changes that occur after that particular version of a resource. Defaults to changes from the beginning of history. When specified for list: - if unset, then the result is returned from remote storage based on quorum-read flag; - if it's 0, then we simply return what we currently have in cache, no guarantee; - if set to non zero, then the result is at least as fresh as given rv.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "timeoutSeconds",
        "description": "Timeout for the list/watch call.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.ResourceQuotaList"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf",
       "application/json;stream=watch",
       "application/vnd.kubernetes.protobuf;stream=watch"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "v1.ResourceQuota",
      "method": "POST",
      "summary": "create a ResourceQuota",
      "nickname": "createNamespacedResourceQuota",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "v1.ResourceQuota",
        "paramType": "body",
        "name": "body",
        "description": "",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.ResourceQuota"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "v1.Status",
      "method": "DELETE",
      "summary": "delete collection of ResourceQuota",
      "nickname": "deletecollectionNamespacedResourceQuota",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "labelSelector",
        "description": "A selector to restrict the list of returned objects by their labels. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "fieldSelector",
        "description": "A selector to restrict the list of returned objects by their fields. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "watch",
        "description": "Watch for changes to the described resources and return them as a stream of add, update, and remove notifications. Specify resourceVersion.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "resourceVersion",
        "description": "When specified with a watch call, shows changes that occur after that particular version of a resource. Defaults to changes from the beginning of history. When specified for list: - if unset, then the result is returned from remote storage based on quorum-read flag; - if it's 0, then we simply return what we currently have in cache, no guarantee; - if set to non zero, then the result is at least as fresh as given rv.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "timeoutSeconds",
        "description": "Timeout for the list/watch call.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.Status"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/watch/namespaces/{namespace}/resourcequotas",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.WatchEvent",
      "method": "GET",
      "summary": "watch individual changes to a list of ResourceQuota",
      "nickname": "watchNamespacedResourceQuotaList",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "labelSelector",
        "description": "A selector to restrict the list of returned objects by their labels. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "fieldSelector",
        "description": "A selector to restrict the list of returned objects by their fields. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "watch",
        "description": "Watch for changes to the described resources and return them as a stream of add, update, and remove notifications. Specify resourceVersion.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "resourceVersion",
        "description": "When specified with a watch call, shows changes that occur after that particular version of a resource. Defaults to changes from the beginning of history. When specified for list: - if unset, then the result is returned from remote storage based on quorum-read flag; - if it's 0, then we simply return what we currently have in cache, no guarantee; - if set to non zero, then the result is at least as fresh as given rv.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "timeoutSeconds",
        "description": "Timeout for the list/watch call.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.WatchEvent"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf",
       "application/json;stream=watch",
       "application/vnd.kubernetes.protobuf;stream=watch"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/namespaces/{namespace}/resourcequotas/{name}",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.ResourceQuota",
      "method": "GET",
      "summary": "read the specified ResourceQuota",
      "nickname": "readNamespacedResourceQuota",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "export",
        "description": "Should this value be exported.  Export strips fields that a user can not specify.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "exact",
        "description": "Should the export be exact.  Exact export maintains cluster-specific fields like 'Namespace'.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the ResourceQuota",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.ResourceQuota"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "v1.ResourceQuota",
      "method": "PUT",
      "summary": "replace the specified ResourceQuota",
      "nickname": "replaceNamespacedResourceQuota",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "v1.ResourceQuota",
        "paramType": "body",
        "name": "body",
        "description": "",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the ResourceQuota",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.ResourceQuota"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "v1.ResourceQuota",
      "method": "PATCH",
      "summary": "partially update the specified ResourceQuota",
      "nickname": "patchNamespacedResourceQuota",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "v1.Patch",
        "paramType": "body",
        "name": "body",
        "description": "",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the ResourceQuota",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.ResourceQuota"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "application/json-patch+json",
       "application/merge-patch+json",
       "application/strategic-merge-patch+json"
      ]
     },
     {
      "type": "v1.Status",
      "method": "DELETE",
      "summary": "delete a ResourceQuota",
      "nickname": "deleteNamespacedResourceQuota",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "v1.DeleteOptions",
        "paramType": "body",
        "name": "body",
        "description": "",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "gracePeriodSeconds",
        "description": "The duration in seconds before the object should be deleted. Value must be non-negative integer. The value zero indicates delete immediately. If this value is nil, the default grace period for the specified type will be used. Defaults to a per object value if not specified. zero means delete immediately.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "orphanDependents",
        "description": "Deprecated: please use the PropagationPolicy, this field will be deprecated in 1.7. Should the dependent objects be orphaned. If true/false, the \"orphan\" finalizer will be added to/removed from the object's finalizers list. Either this field or PropagationPolicy may be set, but not both.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "propagationPolicy",
        "description": "Whether and how garbage collection will be performed. Either this field or OrphanDependents may be set, but not both. The default policy is decided by the existing finalizer set in the metadata.finalizers and the resource-specific default policy.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the ResourceQuota",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.Status"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/watch/namespaces/{namespace}/resourcequotas/{name}",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.WatchEvent",
      "method": "GET",
      "summary": "watch changes to an object of kind ResourceQuota",
      "nickname": "watchNamespacedResourceQuota",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "labelSelector",
        "description": "A selector to restrict the list of returned objects by their labels. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "fieldSelector",
        "description": "A selector to restrict the list of returned objects by their fields. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "watch",
        "description": "Watch for changes to the described resources and return them as a stream of add, update, and remove notifications. Specify resourceVersion.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "resourceVersion",
        "description": "When specified with a watch call, shows changes that occur after that particular version of a resource. Defaults to changes from the beginning of history. When specified for list: - if unset, then the result is returned from remote storage based on quorum-read flag; - if it's 0, then we simply return what we currently have in cache, no guarantee; - if set to non zero, then the result is at least as fresh as given rv.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "timeoutSeconds",
        "description": "Timeout for the list/watch call.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the ResourceQuota",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.WatchEvent"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf",
       "application/json;stream=watch",
       "application/vnd.kubernetes.protobuf;stream=watch"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/resourcequotas",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.ResourceQuotaList",
      "method": "GET",
      "summary": "list or watch objects of kind ResourceQuota",
      "nickname": "listResourceQuotaForAllNamespaces",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "labelSelector",
        "description": "A selector to restrict the list of returned objects by their labels. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "fieldSelector",
        "description": "A selector to restrict the list of returned objects by their fields. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "watch",
        "description": "Watch for changes to the described resources and return them as a stream of add, update, and remove notifications. Specify resourceVersion.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "resourceVersion",
        "description": "When specified with a watch call, shows changes that occur after that particular version of a resource. Defaults to changes from the beginning of history. When specified for list: - if unset, then the result is returned from remote storage based on quorum-read flag; - if it's 0, then we simply return what we currently have in cache, no guarantee; - if set to non zero, then the result is at least as fresh as given rv.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "timeoutSeconds",
        "description": "Timeout for the list/watch call.",
        "required": false,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.ResourceQuotaList"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf",
       "application/json;stream=watch",
       "application/vnd.kubernetes.protobuf;stream=watch"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/watch/resourcequotas",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.WatchEvent",
      "method": "GET",
      "summary": "watch individual changes to a list of ResourceQuota",
      "nickname": "watchResourceQuotaListForAllNamespaces",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "labelSelector",
        "description": "A selector to restrict the list of returned objects by their labels. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "fieldSelector",
        "description": "A selector to restrict the list of returned objects by their fields. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "watch",
        "description": "Watch for changes to the described resources and return them as a stream of add, update, and remove notifications. Specify resourceVersion.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "resourceVersion",
        "description": "When specified with a watch call, shows changes that occur after that particular version of a resource. Defaults to changes from the beginning of history. When specified for list: - if unset, then the result is returned from remote storage based on quorum-read flag; - if it's 0, then we simply return what we currently have in cache, no guarantee; - if set to non zero, then the result is at least as fresh as given rv.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "timeoutSeconds",
        "description": "Timeout for the list/watch call.",
        "required": false,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.WatchEvent"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf",
       "application/json;stream=watch",
       "application/vnd.kubernetes.protobuf;stream=watch"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/namespaces/{namespace}/resourcequotas/{name}/status",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.ResourceQuota",
      "method": "GET",
      "summary": "read status of the specified ResourceQuota",
      "nickname": "readNamespacedResourceQuotaStatus",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the ResourceQuota",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.ResourceQuota"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "v1.ResourceQuota",
      "method": "PUT",
      "summary": "replace status of the specified ResourceQuota",
      "nickname": "replaceNamespacedResourceQuotaStatus",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "v1.ResourceQuota",
        "paramType": "body",
        "name": "body",
        "description": "",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the ResourceQuota",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.ResourceQuota"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "v1.ResourceQuota",
      "method": "PATCH",
      "summary": "partially update status of the specified ResourceQuota",
      "nickname": "patchNamespacedResourceQuotaStatus",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "v1.Patch",
        "paramType": "body",
        "name": "body",
        "description": "",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the ResourceQuota",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.ResourceQuota"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "application/json-patch+json",
       "application/merge-patch+json",
       "application/strategic-merge-patch+json"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/namespaces/{namespace}/secrets",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.SecretList",
      "method": "GET",
      "summary": "list or watch objects of kind Secret",
      "nickname": "listNamespacedSecret",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "labelSelector",
        "description": "A selector to restrict the list of returned objects by their labels. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "fieldSelector",
        "description": "A selector to restrict the list of returned objects by their fields. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "watch",
        "description": "Watch for changes to the described resources and return them as a stream of add, update, and remove notifications. Specify resourceVersion.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "resourceVersion",
        "description": "When specified with a watch call, shows changes that occur after that particular version of a resource. Defaults to changes from the beginning of history. When specified for list: - if unset, then the result is returned from remote storage based on quorum-read flag; - if it's 0, then we simply return what we currently have in cache, no guarantee; - if set to non zero, then the result is at least as fresh as given rv.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "timeoutSeconds",
        "description": "Timeout for the list/watch call.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.SecretList"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf",
       "application/json;stream=watch",
       "application/vnd.kubernetes.protobuf;stream=watch"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "v1.Secret",
      "method": "POST",
      "summary": "create a Secret",
      "nickname": "createNamespacedSecret",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "v1.Secret",
        "paramType": "body",
        "name": "body",
        "description": "",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.Secret"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "v1.Status",
      "method": "DELETE",
      "summary": "delete collection of Secret",
      "nickname": "deletecollectionNamespacedSecret",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "labelSelector",
        "description": "A selector to restrict the list of returned objects by their labels. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "fieldSelector",
        "description": "A selector to restrict the list of returned objects by their fields. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "watch",
        "description": "Watch for changes to the described resources and return them as a stream of add, update, and remove notifications. Specify resourceVersion.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "resourceVersion",
        "description": "When specified with a watch call, shows changes that occur after that particular version of a resource. Defaults to changes from the beginning of history. When specified for list: - if unset, then the result is returned from remote storage based on quorum-read flag; - if it's 0, then we simply return what we currently have in cache, no guarantee; - if set to non zero, then the result is at least as fresh as given rv.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "timeoutSeconds",
        "description": "Timeout for the list/watch call.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.Status"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/watch/namespaces/{namespace}/secrets",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.WatchEvent",
      "method": "GET",
      "summary": "watch individual changes to a list of Secret",
      "nickname": "watchNamespacedSecretList",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "labelSelector",
        "description": "A selector to restrict the list of returned objects by their labels. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "fieldSelector",
        "description": "A selector to restrict the list of returned objects by their fields. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "watch",
        "description": "Watch for changes to the described resources and return them as a stream of add, update, and remove notifications. Specify resourceVersion.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "resourceVersion",
        "description": "When specified with a watch call, shows changes that occur after that particular version of a resource. Defaults to changes from the beginning of history. When specified for list: - if unset, then the result is returned from remote storage based on quorum-read flag; - if it's 0, then we simply return what we currently have in cache, no guarantee; - if set to non zero, then the result is at least as fresh as given rv.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "timeoutSeconds",
        "description": "Timeout for the list/watch call.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.WatchEvent"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf",
       "application/json;stream=watch",
       "application/vnd.kubernetes.protobuf;stream=watch"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/namespaces/{namespace}/secrets/{name}",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.Secret",
      "method": "GET",
      "summary": "read the specified Secret",
      "nickname": "readNamespacedSecret",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "export",
        "description": "Should this value be exported.  Export strips fields that a user can not specify.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "exact",
        "description": "Should the export be exact.  Exact export maintains cluster-specific fields like 'Namespace'.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Secret",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.Secret"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "v1.Secret",
      "method": "PUT",
      "summary": "replace the specified Secret",
      "nickname": "replaceNamespacedSecret",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "v1.Secret",
        "paramType": "body",
        "name": "body",
        "description": "",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Secret",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.Secret"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "v1.Secret",
      "method": "PATCH",
      "summary": "partially update the specified Secret",
      "nickname": "patchNamespacedSecret",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "v1.Patch",
        "paramType": "body",
        "name": "body",
        "description": "",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Secret",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.Secret"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "application/json-patch+json",
       "application/merge-patch+json",
       "application/strategic-merge-patch+json"
      ]
     },
     {
      "type": "v1.Status",
      "method": "DELETE",
      "summary": "delete a Secret",
      "nickname": "deleteNamespacedSecret",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "v1.DeleteOptions",
        "paramType": "body",
        "name": "body",
        "description": "",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "gracePeriodSeconds",
        "description": "The duration in seconds before the object should be deleted. Value must be non-negative integer. The value zero indicates delete immediately. If this value is nil, the default grace period for the specified type will be used. Defaults to a per object value if not specified. zero means delete immediately.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "orphanDependents",
        "description": "Deprecated: please use the PropagationPolicy, this field will be deprecated in 1.7. Should the dependent objects be orphaned. If true/false, the \"orphan\" finalizer will be added to/removed from the object's finalizers list. Either this field or PropagationPolicy may be set, but not both.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "propagationPolicy",
        "description": "Whether and how garbage collection will be performed. Either this field or OrphanDependents may be set, but not both. The default policy is decided by the existing finalizer set in the metadata.finalizers and the resource-specific default policy.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Secret",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.Status"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/watch/namespaces/{namespace}/secrets/{name}",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.WatchEvent",
      "method": "GET",
      "summary": "watch changes to an object of kind Secret",
      "nickname": "watchNamespacedSecret",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "labelSelector",
        "description": "A selector to restrict the list of returned objects by their labels. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "fieldSelector",
        "description": "A selector to restrict the list of returned objects by their fields. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "watch",
        "description": "Watch for changes to the described resources and return them as a stream of add, update, and remove notifications. Specify resourceVersion.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "resourceVersion",
        "description": "When specified with a watch call, shows changes that occur after that particular version of a resource. Defaults to changes from the beginning of history. When specified for list: - if unset, then the result is returned from remote storage based on quorum-read flag; - if it's 0, then we simply return what we currently have in cache, no guarantee; - if set to non zero, then the result is at least as fresh as given rv.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "timeoutSeconds",
        "description": "Timeout for the list/watch call.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Secret",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.WatchEvent"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf",
       "application/json;stream=watch",
       "application/vnd.kubernetes.protobuf;stream=watch"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/secrets",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.SecretList",
      "method": "GET",
      "summary": "list or watch objects of kind Secret",
      "nickname": "listSecretForAllNamespaces",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "labelSelector",
        "description": "A selector to restrict the list of returned objects by their labels. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "fieldSelector",
        "description": "A selector to restrict the list of returned objects by their fields. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "watch",
        "description": "Watch for changes to the described resources and return them as a stream of add, update, and remove notifications. Specify resourceVersion.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "resourceVersion",
        "description": "When specified with a watch call, shows changes that occur after that particular version of a resource. Defaults to changes from the beginning of history. When specified for list: - if unset, then the result is returned from remote storage based on quorum-read flag; - if it's 0, then we simply return what we currently have in cache, no guarantee; - if set to non zero, then the result is at least as fresh as given rv.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "timeoutSeconds",
        "description": "Timeout for the list/watch call.",
        "required": false,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.SecretList"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf",
       "application/json;stream=watch",
       "application/vnd.kubernetes.protobuf;stream=watch"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/watch/secrets",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.WatchEvent",
      "method": "GET",
      "summary": "watch individual changes to a list of Secret",
      "nickname": "watchSecretListForAllNamespaces",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "labelSelector",
        "description": "A selector to restrict the list of returned objects by their labels. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "fieldSelector",
        "description": "A selector to restrict the list of returned objects by their fields. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "watch",
        "description": "Watch for changes to the described resources and return them as a stream of add, update, and remove notifications. Specify resourceVersion.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "resourceVersion",
        "description": "When specified with a watch call, shows changes that occur after that particular version of a resource. Defaults to changes from the beginning of history. When specified for list: - if unset, then the result is returned from remote storage based on quorum-read flag; - if it's 0, then we simply return what we currently have in cache, no guarantee; - if set to non zero, then the result is at least as fresh as given rv.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "timeoutSeconds",
        "description": "Timeout for the list/watch call.",
        "required": false,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.WatchEvent"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf",
       "application/json;stream=watch",
       "application/vnd.kubernetes.protobuf;stream=watch"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/namespaces/{namespace}/serviceaccounts",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.ServiceAccountList",
      "method": "GET",
      "summary": "list or watch objects of kind ServiceAccount",
      "nickname": "listNamespacedServiceAccount",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "labelSelector",
        "description": "A selector to restrict the list of returned objects by their labels. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "fieldSelector",
        "description": "A selector to restrict the list of returned objects by their fields. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "watch",
        "description": "Watch for changes to the described resources and return them as a stream of add, update, and remove notifications. Specify resourceVersion.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "resourceVersion",
        "description": "When specified with a watch call, shows changes that occur after that particular version of a resource. Defaults to changes from the beginning of history. When specified for list: - if unset, then the result is returned from remote storage based on quorum-read flag; - if it's 0, then we simply return what we currently have in cache, no guarantee; - if set to non zero, then the result is at least as fresh as given rv.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "timeoutSeconds",
        "description": "Timeout for the list/watch call.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.ServiceAccountList"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf",
       "application/json;stream=watch",
       "application/vnd.kubernetes.protobuf;stream=watch"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "v1.ServiceAccount",
      "method": "POST",
      "summary": "create a ServiceAccount",
      "nickname": "createNamespacedServiceAccount",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "v1.ServiceAccount",
        "paramType": "body",
        "name": "body",
        "description": "",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.ServiceAccount"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "v1.Status",
      "method": "DELETE",
      "summary": "delete collection of ServiceAccount",
      "nickname": "deletecollectionNamespacedServiceAccount",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "labelSelector",
        "description": "A selector to restrict the list of returned objects by their labels. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "fieldSelector",
        "description": "A selector to restrict the list of returned objects by their fields. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "watch",
        "description": "Watch for changes to the described resources and return them as a stream of add, update, and remove notifications. Specify resourceVersion.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "resourceVersion",
        "description": "When specified with a watch call, shows changes that occur after that particular version of a resource. Defaults to changes from the beginning of history. When specified for list: - if unset, then the result is returned from remote storage based on quorum-read flag; - if it's 0, then we simply return what we currently have in cache, no guarantee; - if set to non zero, then the result is at least as fresh as given rv.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "timeoutSeconds",
        "description": "Timeout for the list/watch call.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.Status"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/watch/namespaces/{namespace}/serviceaccounts",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.WatchEvent",
      "method": "GET",
      "summary": "watch individual changes to a list of ServiceAccount",
      "nickname": "watchNamespacedServiceAccountList",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "labelSelector",
        "description": "A selector to restrict the list of returned objects by their labels. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "fieldSelector",
        "description": "A selector to restrict the list of returned objects by their fields. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "watch",
        "description": "Watch for changes to the described resources and return them as a stream of add, update, and remove notifications. Specify resourceVersion.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "resourceVersion",
        "description": "When specified with a watch call, shows changes that occur after that particular version of a resource. Defaults to changes from the beginning of history. When specified for list: - if unset, then the result is returned from remote storage based on quorum-read flag; - if it's 0, then we simply return what we currently have in cache, no guarantee; - if set to non zero, then the result is at least as fresh as given rv.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "timeoutSeconds",
        "description": "Timeout for the list/watch call.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.WatchEvent"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf",
       "application/json;stream=watch",
       "application/vnd.kubernetes.protobuf;stream=watch"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/namespaces/{namespace}/serviceaccounts/{name}",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.ServiceAccount",
      "method": "GET",
      "summary": "read the specified ServiceAccount",
      "nickname": "readNamespacedServiceAccount",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "export",
        "description": "Should this value be exported.  Export strips fields that a user can not specify.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "exact",
        "description": "Should the export be exact.  Exact export maintains cluster-specific fields like 'Namespace'.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the ServiceAccount",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.ServiceAccount"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "v1.ServiceAccount",
      "method": "PUT",
      "summary": "replace the specified ServiceAccount",
      "nickname": "replaceNamespacedServiceAccount",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "v1.ServiceAccount",
        "paramType": "body",
        "name": "body",
        "description": "",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the ServiceAccount",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.ServiceAccount"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "v1.ServiceAccount",
      "method": "PATCH",
      "summary": "partially update the specified ServiceAccount",
      "nickname": "patchNamespacedServiceAccount",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "v1.Patch",
        "paramType": "body",
        "name": "body",
        "description": "",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the ServiceAccount",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.ServiceAccount"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "application/json-patch+json",
       "application/merge-patch+json",
       "application/strategic-merge-patch+json"
      ]
     },
     {
      "type": "v1.Status",
      "method": "DELETE",
      "summary": "delete a ServiceAccount",
      "nickname": "deleteNamespacedServiceAccount",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "v1.DeleteOptions",
        "paramType": "body",
        "name": "body",
        "description": "",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "gracePeriodSeconds",
        "description": "The duration in seconds before the object should be deleted. Value must be non-negative integer. The value zero indicates delete immediately. If this value is nil, the default grace period for the specified type will be used. Defaults to a per object value if not specified. zero means delete immediately.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "orphanDependents",
        "description": "Deprecated: please use the PropagationPolicy, this field will be deprecated in 1.7. Should the dependent objects be orphaned. If true/false, the \"orphan\" finalizer will be added to/removed from the object's finalizers list. Either this field or PropagationPolicy may be set, but not both.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "propagationPolicy",
        "description": "Whether and how garbage collection will be performed. Either this field or OrphanDependents may be set, but not both. The default policy is decided by the existing finalizer set in the metadata.finalizers and the resource-specific default policy.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the ServiceAccount",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.Status"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/watch/namespaces/{namespace}/serviceaccounts/{name}",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.WatchEvent",
      "method": "GET",
      "summary": "watch changes to an object of kind ServiceAccount",
      "nickname": "watchNamespacedServiceAccount",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "labelSelector",
        "description": "A selector to restrict the list of returned objects by their labels. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "fieldSelector",
        "description": "A selector to restrict the list of returned objects by their fields. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "watch",
        "description": "Watch for changes to the described resources and return them as a stream of add, update, and remove notifications. Specify resourceVersion.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "resourceVersion",
        "description": "When specified with a watch call, shows changes that occur after that particular version of a resource. Defaults to changes from the beginning of history. When specified for list: - if unset, then the result is returned from remote storage based on quorum-read flag; - if it's 0, then we simply return what we currently have in cache, no guarantee; - if set to non zero, then the result is at least as fresh as given rv.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "timeoutSeconds",
        "description": "Timeout for the list/watch call.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the ServiceAccount",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.WatchEvent"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf",
       "application/json;stream=watch",
       "application/vnd.kubernetes.protobuf;stream=watch"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/serviceaccounts",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.ServiceAccountList",
      "method": "GET",
      "summary": "list or watch objects of kind ServiceAccount",
      "nickname": "listServiceAccountForAllNamespaces",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "labelSelector",
        "description": "A selector to restrict the list of returned objects by their labels. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "fieldSelector",
        "description": "A selector to restrict the list of returned objects by their fields. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "watch",
        "description": "Watch for changes to the described resources and return them as a stream of add, update, and remove notifications. Specify resourceVersion.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "resourceVersion",
        "description": "When specified with a watch call, shows changes that occur after that particular version of a resource. Defaults to changes from the beginning of history. When specified for list: - if unset, then the result is returned from remote storage based on quorum-read flag; - if it's 0, then we simply return what we currently have in cache, no guarantee; - if set to non zero, then the result is at least as fresh as given rv.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "timeoutSeconds",
        "description": "Timeout for the list/watch call.",
        "required": false,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.ServiceAccountList"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf",
       "application/json;stream=watch",
       "application/vnd.kubernetes.protobuf;stream=watch"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/watch/serviceaccounts",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.WatchEvent",
      "method": "GET",
      "summary": "watch individual changes to a list of ServiceAccount",
      "nickname": "watchServiceAccountListForAllNamespaces",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "labelSelector",
        "description": "A selector to restrict the list of returned objects by their labels. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "fieldSelector",
        "description": "A selector to restrict the list of returned objects by their fields. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "watch",
        "description": "Watch for changes to the described resources and return them as a stream of add, update, and remove notifications. Specify resourceVersion.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "resourceVersion",
        "description": "When specified with a watch call, shows changes that occur after that particular version of a resource. Defaults to changes from the beginning of history. When specified for list: - if unset, then the result is returned from remote storage based on quorum-read flag; - if it's 0, then we simply return what we currently have in cache, no guarantee; - if set to non zero, then the result is at least as fresh as given rv.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "timeoutSeconds",
        "description": "Timeout for the list/watch call.",
        "required": false,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.WatchEvent"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf",
       "application/json;stream=watch",
       "application/vnd.kubernetes.protobuf;stream=watch"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/namespaces/{namespace}/services",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.ServiceList",
      "method": "GET",
      "summary": "list or watch objects of kind Service",
      "nickname": "listNamespacedService",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "labelSelector",
        "description": "A selector to restrict the list of returned objects by their labels. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "fieldSelector",
        "description": "A selector to restrict the list of returned objects by their fields. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "watch",
        "description": "Watch for changes to the described resources and return them as a stream of add, update, and remove notifications. Specify resourceVersion.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "resourceVersion",
        "description": "When specified with a watch call, shows changes that occur after that particular version of a resource. Defaults to changes from the beginning of history. When specified for list: - if unset, then the result is returned from remote storage based on quorum-read flag; - if it's 0, then we simply return what we currently have in cache, no guarantee; - if set to non zero, then the result is at least as fresh as given rv.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "timeoutSeconds",
        "description": "Timeout for the list/watch call.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.ServiceList"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf",
       "application/json;stream=watch",
       "application/vnd.kubernetes.protobuf;stream=watch"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "v1.Service",
      "method": "POST",
      "summary": "create a Service",
      "nickname": "createNamespacedService",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "v1.Service",
        "paramType": "body",
        "name": "body",
        "description": "",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.Service"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/watch/namespaces/{namespace}/services",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.WatchEvent",
      "method": "GET",
      "summary": "watch individual changes to a list of Service",
      "nickname": "watchNamespacedServiceList",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "labelSelector",
        "description": "A selector to restrict the list of returned objects by their labels. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "fieldSelector",
        "description": "A selector to restrict the list of returned objects by their fields. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "watch",
        "description": "Watch for changes to the described resources and return them as a stream of add, update, and remove notifications. Specify resourceVersion.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "resourceVersion",
        "description": "When specified with a watch call, shows changes that occur after that particular version of a resource. Defaults to changes from the beginning of history. When specified for list: - if unset, then the result is returned from remote storage based on quorum-read flag; - if it's 0, then we simply return what we currently have in cache, no guarantee; - if set to non zero, then the result is at least as fresh as given rv.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "timeoutSeconds",
        "description": "Timeout for the list/watch call.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.WatchEvent"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf",
       "application/json;stream=watch",
       "application/vnd.kubernetes.protobuf;stream=watch"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/namespaces/{namespace}/services/{name}",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.Service",
      "method": "GET",
      "summary": "read the specified Service",
      "nickname": "readNamespacedService",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "export",
        "description": "Should this value be exported.  Export strips fields that a user can not specify.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "exact",
        "description": "Should the export be exact.  Exact export maintains cluster-specific fields like 'Namespace'.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Service",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.Service"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "v1.Service",
      "method": "PUT",
      "summary": "replace the specified Service",
      "nickname": "replaceNamespacedService",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "v1.Service",
        "paramType": "body",
        "name": "body",
        "description": "",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Service",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.Service"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "v1.Service",
      "method": "PATCH",
      "summary": "partially update the specified Service",
      "nickname": "patchNamespacedService",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "v1.Patch",
        "paramType": "body",
        "name": "body",
        "description": "",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Service",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.Service"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "application/json-patch+json",
       "application/merge-patch+json",
       "application/strategic-merge-patch+json"
      ]
     },
     {
      "type": "v1.Status",
      "method": "DELETE",
      "summary": "delete a Service",
      "nickname": "deleteNamespacedService",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Service",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.Status"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/watch/namespaces/{namespace}/services/{name}",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.WatchEvent",
      "method": "GET",
      "summary": "watch changes to an object of kind Service",
      "nickname": "watchNamespacedService",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "labelSelector",
        "description": "A selector to restrict the list of returned objects by their labels. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "fieldSelector",
        "description": "A selector to restrict the list of returned objects by their fields. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "watch",
        "description": "Watch for changes to the described resources and return them as a stream of add, update, and remove notifications. Specify resourceVersion.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "resourceVersion",
        "description": "When specified with a watch call, shows changes that occur after that particular version of a resource. Defaults to changes from the beginning of history. When specified for list: - if unset, then the result is returned from remote storage based on quorum-read flag; - if it's 0, then we simply return what we currently have in cache, no guarantee; - if set to non zero, then the result is at least as fresh as given rv.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "timeoutSeconds",
        "description": "Timeout for the list/watch call.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Service",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.WatchEvent"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf",
       "application/json;stream=watch",
       "application/vnd.kubernetes.protobuf;stream=watch"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/proxy/namespaces/{namespace}/services/{name}/{path}",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "string",
      "method": "GET",
      "summary": "proxy GET requests to Service",
      "nickname": "proxyGETNamespacedServiceWithPath",
      "parameters": [
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Service",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "path",
        "description": "path to the resource",
        "required": true,
        "allowMultiple": false
       }
      ],
      "produces": [
       "*/*"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "string",
      "method": "PUT",
      "summary": "proxy PUT requests to Service",
      "nickname": "proxyPUTNamespacedServiceWithPath",
      "parameters": [
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Service",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "path",
        "description": "path to the resource",
        "required": true,
        "allowMultiple": false
       }
      ],
      "produces": [
       "*/*"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "string",
      "method": "POST",
      "summary": "proxy POST requests to Service",
      "nickname": "proxyPOSTNamespacedServiceWithPath",
      "parameters": [
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Service",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "path",
        "description": "path to the resource",
        "required": true,
        "allowMultiple": false
       }
      ],
      "produces": [
       "*/*"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "string",
      "method": "PATCH",
      "summary": "proxy PATCH requests to Service",
      "nickname": "proxyPATCHNamespacedServiceWithPath",
      "parameters": [
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Service",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "path",
        "description": "path to the resource",
        "required": true,
        "allowMultiple": false
       }
      ],
      "produces": [
       "*/*"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "string",
      "method": "DELETE",
      "summary": "proxy DELETE requests to Service",
      "nickname": "proxyDELETENamespacedServiceWithPath",
      "parameters": [
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Service",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "path",
        "description": "path to the resource",
        "required": true,
        "allowMultiple": false
       }
      ],
      "produces": [
       "*/*"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "string",
      "method": "HEAD",
      "summary": "proxy HEAD requests to Service",
      "nickname": "proxyHEADNamespacedServiceWithPath",
      "parameters": [
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Service",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "path",
        "description": "path to the resource",
        "required": true,
        "allowMultiple": false
       }
      ],
      "produces": [
       "*/*"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "string",
      "method": "OPTIONS",
      "summary": "proxy OPTIONS requests to Service",
      "nickname": "proxyOPTIONSNamespacedServiceWithPath",
      "parameters": [
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Service",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "path",
        "description": "path to the resource",
        "required": true,
        "allowMultiple": false
       }
      ],
      "produces": [
       "*/*"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/proxy/namespaces/{namespace}/services/{name}",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "string",
      "method": "GET",
      "summary": "proxy GET requests to Service",
      "nickname": "proxyGETNamespacedService",
      "parameters": [
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Service",
        "required": true,
        "allowMultiple": false
       }
      ],
      "produces": [
       "*/*"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "string",
      "method": "PUT",
      "summary": "proxy PUT requests to Service",
      "nickname": "proxyPUTNamespacedService",
      "parameters": [
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Service",
        "required": true,
        "allowMultiple": false
       }
      ],
      "produces": [
       "*/*"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "string",
      "method": "POST",
      "summary": "proxy POST requests to Service",
      "nickname": "proxyPOSTNamespacedService",
      "parameters": [
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Service",
        "required": true,
        "allowMultiple": false
       }
      ],
      "produces": [
       "*/*"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "string",
      "method": "PATCH",
      "summary": "proxy PATCH requests to Service",
      "nickname": "proxyPATCHNamespacedService",
      "parameters": [
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Service",
        "required": true,
        "allowMultiple": false
       }
      ],
      "produces": [
       "*/*"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "string",
      "method": "DELETE",
      "summary": "proxy DELETE requests to Service",
      "nickname": "proxyDELETENamespacedService",
      "parameters": [
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Service",
        "required": true,
        "allowMultiple": false
       }
      ],
      "produces": [
       "*/*"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "string",
      "method": "HEAD",
      "summary": "proxy HEAD requests to Service",
      "nickname": "proxyHEADNamespacedService",
      "parameters": [
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Service",
        "required": true,
        "allowMultiple": false
       }
      ],
      "produces": [
       "*/*"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "string",
      "method": "OPTIONS",
      "summary": "proxy OPTIONS requests to Service",
      "nickname": "proxyOPTIONSNamespacedService",
      "parameters": [
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Service",
        "required": true,
        "allowMultiple": false
       }
      ],
      "produces": [
       "*/*"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/services",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.ServiceList",
      "method": "GET",
      "summary": "list or watch objects of kind Service",
      "nickname": "listServiceForAllNamespaces",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "labelSelector",
        "description": "A selector to restrict the list of returned objects by their labels. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "fieldSelector",
        "description": "A selector to restrict the list of returned objects by their fields. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "watch",
        "description": "Watch for changes to the described resources and return them as a stream of add, update, and remove notifications. Specify resourceVersion.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "resourceVersion",
        "description": "When specified with a watch call, shows changes that occur after that particular version of a resource. Defaults to changes from the beginning of history. When specified for list: - if unset, then the result is returned from remote storage based on quorum-read flag; - if it's 0, then we simply return what we currently have in cache, no guarantee; - if set to non zero, then the result is at least as fresh as given rv.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "timeoutSeconds",
        "description": "Timeout for the list/watch call.",
        "required": false,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.ServiceList"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf",
       "application/json;stream=watch",
       "application/vnd.kubernetes.protobuf;stream=watch"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/watch/services",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.WatchEvent",
      "method": "GET",
      "summary": "watch individual changes to a list of Service",
      "nickname": "watchServiceListForAllNamespaces",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "labelSelector",
        "description": "A selector to restrict the list of returned objects by their labels. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "fieldSelector",
        "description": "A selector to restrict the list of returned objects by their fields. Defaults to everything.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "boolean",
        "paramType": "query",
        "name": "watch",
        "description": "Watch for changes to the described resources and return them as a stream of add, update, and remove notifications. Specify resourceVersion.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "query",
        "name": "resourceVersion",
        "description": "When specified with a watch call, shows changes that occur after that particular version of a resource. Defaults to changes from the beginning of history. When specified for list: - if unset, then the result is returned from remote storage based on quorum-read flag; - if it's 0, then we simply return what we currently have in cache, no guarantee; - if set to non zero, then the result is at least as fresh as given rv.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "integer",
        "paramType": "query",
        "name": "timeoutSeconds",
        "description": "Timeout for the list/watch call.",
        "required": false,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.WatchEvent"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf",
       "application/json;stream=watch",
       "application/vnd.kubernetes.protobuf;stream=watch"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/namespaces/{namespace}/services/{name}/proxy",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "string",
      "method": "GET",
      "summary": "connect GET requests to proxy of Service",
      "nickname": "connectGetNamespacedServiceProxy",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "path",
        "description": "Path is the part of URLs that include service endpoints, suffixes, and parameters to use for the current proxy request to service. For example, the whole request URL is http://localhost/api/v1/namespaces/kube-system/services/elasticsearch-logging/_search?q=user:kimchy. Path is _search?q=user:kimchy.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Service",
        "required": true,
        "allowMultiple": false
       }
      ],
      "produces": [
       "*/*"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "string",
      "method": "POST",
      "summary": "connect POST requests to proxy of Service",
      "nickname": "connectPostNamespacedServiceProxy",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "path",
        "description": "Path is the part of URLs that include service endpoints, suffixes, and parameters to use for the current proxy request to service. For example, the whole request URL is http://localhost/api/v1/namespaces/kube-system/services/elasticsearch-logging/_search?q=user:kimchy. Path is _search?q=user:kimchy.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Service",
        "required": true,
        "allowMultiple": false
       }
      ],
      "produces": [
       "*/*"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "string",
      "method": "PUT",
      "summary": "connect PUT requests to proxy of Service",
      "nickname": "connectPutNamespacedServiceProxy",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "path",
        "description": "Path is the part of URLs that include service endpoints, suffixes, and parameters to use for the current proxy request to service. For example, the whole request URL is http://localhost/api/v1/namespaces/kube-system/services/elasticsearch-logging/_search?q=user:kimchy. Path is _search?q=user:kimchy.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Service",
        "required": true,
        "allowMultiple": false
       }
      ],
      "produces": [
       "*/*"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "string",
      "method": "PATCH",
      "summary": "connect PATCH requests to proxy of Service",
      "nickname": "connectPatchNamespacedServiceProxy",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "path",
        "description": "Path is the part of URLs that include service endpoints, suffixes, and parameters to use for the current proxy request to service. For example, the whole request URL is http://localhost/api/v1/namespaces/kube-system/services/elasticsearch-logging/_search?q=user:kimchy. Path is _search?q=user:kimchy.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Service",
        "required": true,
        "allowMultiple": false
       }
      ],
      "produces": [
       "*/*"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "string",
      "method": "DELETE",
      "summary": "connect DELETE requests to proxy of Service",
      "nickname": "connectDeleteNamespacedServiceProxy",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "path",
        "description": "Path is the part of URLs that include service endpoints, suffixes, and parameters to use for the current proxy request to service. For example, the whole request URL is http://localhost/api/v1/namespaces/kube-system/services/elasticsearch-logging/_search?q=user:kimchy. Path is _search?q=user:kimchy.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Service",
        "required": true,
        "allowMultiple": false
       }
      ],
      "produces": [
       "*/*"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "string",
      "method": "HEAD",
      "summary": "connect HEAD requests to proxy of Service",
      "nickname": "connectHeadNamespacedServiceProxy",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "path",
        "description": "Path is the part of URLs that include service endpoints, suffixes, and parameters to use for the current proxy request to service. For example, the whole request URL is http://localhost/api/v1/namespaces/kube-system/services/elasticsearch-logging/_search?q=user:kimchy. Path is _search?q=user:kimchy.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Service",
        "required": true,
        "allowMultiple": false
       }
      ],
      "produces": [
       "*/*"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "string",
      "method": "OPTIONS",
      "summary": "connect OPTIONS requests to proxy of Service",
      "nickname": "connectOptionsNamespacedServiceProxy",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "path",
        "description": "Path is the part of URLs that include service endpoints, suffixes, and parameters to use for the current proxy request to service. For example, the whole request URL is http://localhost/api/v1/namespaces/kube-system/services/elasticsearch-logging/_search?q=user:kimchy. Path is _search?q=user:kimchy.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Service",
        "required": true,
        "allowMultiple": false
       }
      ],
      "produces": [
       "*/*"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/namespaces/{namespace}/services/{name}/proxy/{path}",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "string",
      "method": "GET",
      "summary": "connect GET requests to proxy of Service",
      "nickname": "connectGetNamespacedServiceProxyWithPath",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "path",
        "description": "Path is the part of URLs that include service endpoints, suffixes, and parameters to use for the current proxy request to service. For example, the whole request URL is http://localhost/api/v1/namespaces/kube-system/services/elasticsearch-logging/_search?q=user:kimchy. Path is _search?q=user:kimchy.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Service",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "path",
        "description": "path to the resource",
        "required": true,
        "allowMultiple": false
       }
      ],
      "produces": [
       "*/*"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "string",
      "method": "POST",
      "summary": "connect POST requests to proxy of Service",
      "nickname": "connectPostNamespacedServiceProxyWithPath",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "path",
        "description": "Path is the part of URLs that include service endpoints, suffixes, and parameters to use for the current proxy request to service. For example, the whole request URL is http://localhost/api/v1/namespaces/kube-system/services/elasticsearch-logging/_search?q=user:kimchy. Path is _search?q=user:kimchy.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Service",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "path",
        "description": "path to the resource",
        "required": true,
        "allowMultiple": false
       }
      ],
      "produces": [
       "*/*"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "string",
      "method": "PUT",
      "summary": "connect PUT requests to proxy of Service",
      "nickname": "connectPutNamespacedServiceProxyWithPath",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "path",
        "description": "Path is the part of URLs that include service endpoints, suffixes, and parameters to use for the current proxy request to service. For example, the whole request URL is http://localhost/api/v1/namespaces/kube-system/services/elasticsearch-logging/_search?q=user:kimchy. Path is _search?q=user:kimchy.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Service",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "path",
        "description": "path to the resource",
        "required": true,
        "allowMultiple": false
       }
      ],
      "produces": [
       "*/*"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "string",
      "method": "PATCH",
      "summary": "connect PATCH requests to proxy of Service",
      "nickname": "connectPatchNamespacedServiceProxyWithPath",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "path",
        "description": "Path is the part of URLs that include service endpoints, suffixes, and parameters to use for the current proxy request to service. For example, the whole request URL is http://localhost/api/v1/namespaces/kube-system/services/elasticsearch-logging/_search?q=user:kimchy. Path is _search?q=user:kimchy.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Service",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "path",
        "description": "path to the resource",
        "required": true,
        "allowMultiple": false
       }
      ],
      "produces": [
       "*/*"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "string",
      "method": "DELETE",
      "summary": "connect DELETE requests to proxy of Service",
      "nickname": "connectDeleteNamespacedServiceProxyWithPath",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "path",
        "description": "Path is the part of URLs that include service endpoints, suffixes, and parameters to use for the current proxy request to service. For example, the whole request URL is http://localhost/api/v1/namespaces/kube-system/services/elasticsearch-logging/_search?q=user:kimchy. Path is _search?q=user:kimchy.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Service",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "path",
        "description": "path to the resource",
        "required": true,
        "allowMultiple": false
       }
      ],
      "produces": [
       "*/*"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "string",
      "method": "HEAD",
      "summary": "connect HEAD requests to proxy of Service",
      "nickname": "connectHeadNamespacedServiceProxyWithPath",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "path",
        "description": "Path is the part of URLs that include service endpoints, suffixes, and parameters to use for the current proxy request to service. For example, the whole request URL is http://localhost/api/v1/namespaces/kube-system/services/elasticsearch-logging/_search?q=user:kimchy. Path is _search?q=user:kimchy.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Service",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "path",
        "description": "path to the resource",
        "required": true,
        "allowMultiple": false
       }
      ],
      "produces": [
       "*/*"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "string",
      "method": "OPTIONS",
      "summary": "connect OPTIONS requests to proxy of Service",
      "nickname": "connectOptionsNamespacedServiceProxyWithPath",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "path",
        "description": "Path is the part of URLs that include service endpoints, suffixes, and parameters to use for the current proxy request to service. For example, the whole request URL is http://localhost/api/v1/namespaces/kube-system/services/elasticsearch-logging/_search?q=user:kimchy. Path is _search?q=user:kimchy.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Service",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "path",
        "description": "path to the resource",
        "required": true,
        "allowMultiple": false
       }
      ],
      "produces": [
       "*/*"
      ],
      "consumes": [
       "*/*"
      ]
     }
    ]
   },
   {
    "path": "/api/v1/namespaces/{namespace}/services/{name}/status",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.Service",
      "method": "GET",
      "summary": "read status of the specified Service",
      "nickname": "readNamespacedServiceStatus",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Service",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.Service"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "v1.Service",
      "method": "PUT",
      "summary": "replace status of the specified Service",
      "nickname": "replaceNamespacedServiceStatus",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "v1.Service",
        "paramType": "body",
        "name": "body",
        "description": "",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Service",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.Service"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "*/*"
      ]
     },
     {
      "type": "v1.Service",
      "method": "PATCH",
      "summary": "partially update status of the specified Service",
      "nickname": "patchNamespacedServiceStatus",
      "parameters": [
       {
        "type": "string",
        "paramType": "query",
        "name": "pretty",
        "description": "If 'true', then the output is pretty printed.",
        "required": false,
        "allowMultiple": false
       },
       {
        "type": "v1.Patch",
        "paramType": "body",
        "name": "body",
        "description": "",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "namespace",
        "description": "object name and auth scope, such as for teams and projects",
        "required": true,
        "allowMultiple": false
       },
       {
        "type": "string",
        "paramType": "path",
        "name": "name",
        "description": "name of the Service",
        "required": true,
        "allowMultiple": false
       }
      ],
      "responseMessages": [
       {
        "code": 200,
        "message": "OK",
        "responseModel": "v1.Service"
       }
      ],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "application/json-patch+json",
       "application/merge-patch+json",
       "application/strategic-merge-patch+json"
      ]
     }
    ]
   },
   {
    "path": "/api/v1",
    "description": "API at /api/v1",
    "operations": [
     {
      "type": "v1.APIResourceList",
      "method": "GET",
      "summary": "get available resources",
      "nickname": "getAPIResources",
      "parameters": [],
      "produces": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ],
      "consumes": [
       "application/json",
       "application/yaml",
       "application/vnd.kubernetes.protobuf"
      ]
     }
    ]
   }
  ],
  "models": {
   "v1.Binding": {
    "id": "v1.Binding",
    "description": "Binding ties one object to another. For example, a pod is bound to a node by a scheduler.",
    "required": [
     "target"
    ],
    "properties": {
     "kind": {
      "type": "string",
      "description": "Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: http://releases.k8s.io/HEAD/docs/devel/api-conventions.md#types-kinds"
     },
     "apiVersion": {
      "type": "string",
      "description": "APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: http://releases.k8s.io/HEAD/docs/devel/api-conventions.md#resources"
     },
     "metadata": {
      "$ref": "v1.ObjectMeta",
      "description": "Standard object's metadata. More info: https://github.com/kubernetes/community/blob/master/contributors/devel/sig-architecture/api-conventions.md#metadata"
     },
     "target": {
      "$ref": "v1.ObjectReference",
      "description": "The target object that you want to bind to the standard object."
     }
    }
   },
   "v1.ObjectMeta": {
    "id": "v1.ObjectMeta",
    "description": "ObjectMeta is metadata that all persisted resources must have, which includes all objects users must create.",
    "properties": {
     "name": {
      "type": "string",
      "description": "Name must be unique within a namespace. Is required when creating resources, although some resources may allow a client to request the generation of an appropriate name automatically. Name is primarily intended for creation idempotence and configuration definition. Cannot be updated. More info: http://kubernetes.io/docs/user-guide/identifiers#names"
     },
     "generateName": {
      "type": "string",
      "description": "GenerateName is an optional prefix, used by the server, to generate a unique name ONLY IF the Name field has not been provided. If this field is used, the name returned to the client will be different than the name passed. This value will also be combined with a unique suffix. The provided value has the same validation rules as the Name field, and may be truncated by the length of the suffix required to make the value unique on the server.\n\nIf this field is specified and the generated name exists, the server will NOT return a 409 - instead, it will either return 201 Created or 500 with Reason ServerTimeout indicating a unique name could not be found in the time allotted, and the client should retry (optionally after the time indicated in the Retry-After header).\n\nApplied only if Name is not specified. More info: http://releases.k8s.io/HEAD/docs/devel/api-conventions.md#idempotency"
     },
     "namespace": {
      "type": "string",
      "description": "Namespace defines the space within each name must be unique. An empty namespace is equivalent to the \"default\" namespace, but \"default\" is the canonical representation. Not all objects are required to be scoped to a namespace - the value of this field for those objects will be empty.\n\nMust be a DNS_LABEL. Cannot be updated. More info: http://kubernetes.io/docs/user-guide/namespaces"
     },
     "selfLink": {
      "type": "string",
      "description": "SelfLink is a URL representing this object. Populated by the system. Read-only."
     },
     "uid": {
      "type": "string",
      "description": "UID is the unique in time and space value for this object. It is typically generated by the server on successful creation of a resource and is not allowed to change on PUT operations.\n\nPopulated by the system. Read-only. More info: http://kubernetes.io/docs/user-guide/identifiers#uids"
     },
     "resourceVersion": {
      "type": "string",
      "description": "An opaque value that represents the internal version of this object that can be used by clients to determine when objects have changed. May be used for optimistic concurrency, change detection, and the watch operation on a resource or set of resources. Clients must treat these values as opaque and passed unmodified back to the server. They may only be valid for a particular resource or set of resources.\n\nPopulated by the system. Read-only. Value must be treated as opaque by clients and . More info: http://releases.k8s.io/HEAD/docs/devel/api-conventions.md#concurrency-control-and-consistency"
     },
     "generation": {
      "type": "integer",
      "format": "int64",
      "description": "A sequence number representing a specific generation of the desired state. Populated by the system. Read-only."
     },
     "creationTimestamp": {
      "type": "string",
      "description": "CreationTimestamp is a timestamp representing the server time when this object was created. It is not guaranteed to be set in happens-before order across separate operations. Clients may not set this value. It is represented in RFC3339 form and is in UTC.\n\nPopulated by the system. Read-only. Null for lists. More info: http://releases.k8s.io/HEAD/docs/devel/api-conventions.md#metadata"
     },
     "deletionTimestamp": {
      "type": "string",
      "description": "DeletionTimestamp is RFC 3339 date and time at which this resource will be deleted. This field is set by the server when a graceful deletion is requested by the user, and is not directly settable by a client. The resource is expected to be deleted (no longer visible from resource lists, and not reachable by name) after the time in this field. Once set, this value may not be unset or be set further into the future, although it may be shortened or the resource may be deleted prior to this time. For example, a user may request that a pod is deleted in 30 seconds. The Kubelet will react by sending a graceful termination signal to the containers in the pod. After that 30 seconds, the Kubelet will send a hard termination signal (SIGKILL) to the container and after cleanup, remove the pod from the API. In the presence of network partitions, this object may still exist after this timestamp, until an administrator or automated process can determine the resource is fully terminated. If not set, graceful deletion of the object has not been requested.\n\nPopulated by the system when a graceful deletion is requested. Read-only. More info: http://releases.k8s.io/HEAD/docs/devel/api-conventions.md#metadata"
     },
     "deletionGracePeriodSeconds": {
      "type": "integer",
      "format": "int64",
      "description": "Number of seconds allowed for this object to gracefully terminate before it will be removed from the system. Only set when deletionTimestamp is also set. May only be shortened. Read-only."
     },
     "labels": {
      "type": "object",
      "description": "Map of string keys and values that can be used to organize and categorize (scope and select) objects. May match selectors of replication controllers and services. More info: http://kubernetes.io/docs/user-guide/labels"
     },
     "annotations": {
      "type": "object",
      "description": "Annotations is an unstructured key value map stored with a resource that may be set by external tools to store and retrieve arbitrary metadata. They are not queryable and should be preserved when modifying objects. More info: http://kubernetes.io/docs/user-guide/annotations"
     },
     "ownerReferences": {
      "type": "array",
      "items": {
       "$ref": "v1.OwnerReference"
      },
      "description": "List of objects depended by this object. If ALL objects in the list have been deleted, this object will be garbage collected. If this object is managed by a controller, then an entry in this list will point to this controller, with the controller field set to true. There cannot be more than one managing controller."
     },
     "finalizers": {
      "type": "array",
      "items": {
       "type": "string"
      },
      "description": "Must be empty before the object is deleted from the registry. Each entry is an identifier for the responsible component that will remove the entry from the list. If the deletionTimestamp of the object is non-nil, entries in this list can only be removed."
     },
     "clusterName": {
      "type": "string",
      "description": "The name of the cluster which the object belongs to. This is used to distinguish resources with same name and namespace in different clusters. This field is not set anywhere right now and apiserver is going to ignore it if set in create or update request."
     }
    }
   },
   "v1.OwnerReference": {
    "id": "v1.OwnerReference",
    "description": "OwnerReference contains enough information to let you identify an owning object. Currently, an owning object must be in the same namespace, so there is no namespace field.",
    "required": [
     "apiVersion",
     "kind",
     "name",
     "uid"
    ],
    "properties": {
     "apiVersion": {
      "type": "string",
      "description": "API version of the referent."
     },
     "kind": {
      "type": "string",
      "description": "Kind of the referent. More info: http://releases.k8s.io/HEAD/docs/devel/api-conventions.md#types-kinds"
     },
     "name": {
      "type": "string",
      "description": "Name of the referent. More info: http://kubernetes.io/docs/user-guide/identifiers#names"
     },
     "uid": {
      "type": "string",
      "description": "UID of the referent. More info: http://kubernetes.io/docs/user-guide/identifiers#uids"
     },
     "controller": {
      "type": "boolean",
      "description": "If true, this reference points to the managing controller."
     },
     "blockOwnerDeletion": {
      "type": "boolean",
      "description": "If true, AND if the owner has the \"foregroundDeletion\" finalizer, then the owner cannot be deleted from the key-value store until this reference is removed. Defaults to false. To set this field, a user needs \"delete\" permission of the owner, otherwise 422 (Unprocessable Entity) will be returned."
     }
    }
   },
   "v1.ObjectReference": {
    "id": "v1.ObjectReference",
    "description": "ObjectReference contains enough information to let you inspect or modify the referred object.",
    "properties": {
     "kind": {
      "type": "string",
      "description": "Kind of the referent. More info: https://github.com/kubernetes/community/blob/master/contributors/devel/sig-architecture/api-conventions.md#types-kinds"
     },
     "namespace": {
      "type": "string",
      "description": "Namespace of the referent. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/namespaces/"
     },
     "name": {
      "type": "string",
      "description": "Name of the referent. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#names"
     },
     "uid": {
      "type": "string",
      "description": "UID of the referent. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#uids"
     },
     "apiVersion": {
      "type": "string",
      "description": "API version of the referent."
     },
     "resourceVersion": {
      "type": "string",
      "description": "Specific resourceVersion to which this reference is made, if any. More info: https://github.com/kubernetes/community/blob/master/contributors/devel/sig-architecture/api-conventions.md#concurrency-control-and-consistency"
     },
     "fieldPath": {
      "type": "string",
      "description": "If referring to a piece of an object instead of an entire object, this string should contain a valid JSON/Go field access statement, such as desiredState.manifest.containers[2]. For example, if the object reference is to a container within a pod, this would take on a value like: \"spec.containers{name}\" (where \"name\" refers to the name of the container that triggered the event) or if no container name is specified \"spec.containers[2]\" (container with index 2 in this pod). This syntax is chosen only to have some well-defined way of referencing a part of an object."
     }
    }
   },
   "v1.ComponentStatusList": {
    "id": "v1.ComponentStatusList",
    "description": "Status of all the conditions for the component as a list of ComponentStatus objects.",
    "required": [
     "items"
    ],
    "properties": {
     "kind": {
      "type": "string",
      "description": "Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: http://releases.k8s.io/HEAD/docs/devel/api-conventions.md#types-kinds"
     },
     "apiVersion": {
      "type": "string",
      "description": "APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: http://releases.k8s.io/HEAD/docs/devel/api-conventions.md#resources"
     },
     "metadata": {
      "$ref": "v1.ListMeta",
      "description": "Standard list metadata. More info: https://github.com/kubernetes/community/blob/master/contributors/devel/sig-architecture/api-conventions.md#types-kinds"
     },
     "items": {
      "type": "array",
      "items": {
       "$ref": "v1.ComponentStatus"
      },
      "description": "List of ComponentStatus objects."
     }
    }
   },
   "v1.ListMeta": {
    "id": "v1.ListMeta",
    "description": "ListMeta describes metadata that synthetic resources must have, including lists and various status objects. A resource may have only one of {ObjectMeta, ListMeta}.",
    "properties": {
     "selfLink": {
      "type": "string",
      "description": "SelfLink is a URL representing this object. Populated by the system. Read-only."
     },
     "resourceVersion": {
      "type": "string",
      "description": "String that identifies the server's internal version of this object that can be used by clients to determine when objects have changed. Value must be treated as opaque by clients and passed unmodified back to the server. Populated by the system. Read-only. More info: http://releases.k8s.io/HEAD/docs/devel/api-conventions.md#concurrency-control-and-consistency"
     }
    }
   },
   "v1.ComponentStatus": {
    "id": "v1.ComponentStatus",
    "description": "ComponentStatus (and ComponentStatusList) holds the cluster validation info.",
    "properties": {
     "kind": {
      "type": "string",
      "description": "Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: http://releases.k8s.io/HEAD/docs/devel/api-conventions.md#types-kinds"
     },
     "apiVersion": {
      "type": "string",
      "description": "APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: http://releases.k8s.io/HEAD/docs/devel/api-conventions.md#resources"
     },
     "metadata": {
      "$ref": "v1.ObjectMeta",
      "description": "Standard object's metadata. More info: https://github.com/kubernetes/community/blob/master/contributors/devel/sig-architecture/api-conventions.md#metadata"
     },
     "conditions": {
      "type": "array",
      "items": {
       "$ref": "v1.ComponentCondition"
      },
      "description": "List of component conditions observed"
     }
    }
   },
   "v1.ComponentCondition": {
    "id": "v1.ComponentCondition",
    "description": "Information about the condition of a component.",
    "required": [
     "type",
     "status"
    ],
    "properties": {
     "type": {
      "type": "string",
      "description": "Type of condition for a component. Valid value: \"Healthy\""
     },
     "status": {
      "type": "string",
      "description": "Status of the condition for a component. Valid values for \"Healthy\": \"True\", \"False\", or \"Unknown\"."
     },
     "message": {
      "type": "string",
      "description": "Message about the condition for a component. For example, information about a health check."
     },
     "error": {
      "type": "string",
      "description": "Condition error code for a component. For example, a health check error code."
     }
    }
   },
   "v1.ConfigMapList": {
    "id": "v1.ConfigMapList",
    "description": "ConfigMapList is a resource containing a list of ConfigMap objects.",
    "required": [
     "items"
    ],
    "properties": {
     "kind": {
      "type": "string",
      "description": "Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: http://releases.k8s.io/HEAD/docs/devel/api-conventions.md#types-kinds"
     },
     "apiVersion": {
      "type": "string",
      "description": "APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: http://releases.k8s.io/HEAD/docs/devel/api-conventions.md#resources"
     },
     "metadata": {
      "$ref": "v1.ListMeta",
      "description": "More info: https://github.com/kubernetes/community/blob/master/contributors/devel/sig-architecture/api-conventions.md#metadata"
     },
     "items": {
      "type": "array",
      "items": {
       "$ref": "v1.ConfigMap"
      },
      "description": "Items is the list of ConfigMaps."
     }
    }
   },
   "v1.ConfigMap": {
    "id": "v1.ConfigMap",
    "description": "ConfigMap holds configuration data for pods to consume.",
    "properties": {
     "kind": {
      "type": "string",
      "description": "Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: http://releases.k8s.io/HEAD/docs/devel/api-conventions.md#types-kinds"
     },
     "apiVersion": {
      "type": "string",
      "description": "APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: http://releases.k8s.io/HEAD/docs/devel/api-conventions.md#resources"
     },
     "metadata": {
      "$ref": "v1.ObjectMeta",
      "description": "Standard object's metadata. More info: https://github.com/kubernetes/community/blob/master/contributors/devel/sig-architecture/api-conventions.md#metadata"
     },
     "data": {
      "type": "object",
      "description": "Data contains the configuration data. Each key must consist of alphanumeric characters, '-', '_' or '.'."
     }
    }
   },
   "v1.Status": {
    "id": "v1.Status",
    "description": "Status is a return value for calls that don't return other objects.",
    "properties": {
     "kind": {
      "type": "string",
      "description": "Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: http://releases.k8s.io/HEAD/docs/devel/api-conventions.md#types-kinds"
     },
     "apiVersion": {
      "type": "string",
      "description": "APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: http://releases.k8s.io/HEAD/docs/devel/api-conventions.md#resources"
     },
     "metadata": {
      "$ref": "v1.ListMeta",
      "description": "Standard list metadata. More info: http://releases.k8s.io/HEAD/docs/devel/api-conventions.md#types-kinds"
     },
     "status": {
      "type": "string",
      "description": "Status of the operation. One of: \"Success\" or \"Failure\". More info: http://releases.k8s.io/HEAD/docs/devel/api-conventions.md#spec-and-status"
     },
     "message": {
      "type": "string",
      "description": "A human-readable description of the status of this operation."
     },
     "reason": {
      "type": "string",
      "description": "A machine-readable description of why this operation is in the \"Failure\" status. If this value is empty there is no information available. A Reason clarifies an HTTP status code but does not override it."
     },
     "details": {
      "$ref": "v1.StatusDetails",
      "description": "Extended data associated with the reason.  Each reason may define its own extended details. This field is optional and the data returned is not guaranteed to conform to any schema except that defined by the reason type."
     },
     "code": {
      "type": "integer",
      "format": "int32",
      "description": "Suggested HTTP return code for this status, 0 if not set."
     }
    }
   },
   "v1.StatusDetails": {
    "id": "v1.StatusDetails",
    "description": "StatusDetails is a set of additional properties that MAY be set by the server to provide additional information about a response. The Reason field of a Status object defines what attributes will be set. Clients must ignore fields that do not match the defined type of each attribute, and should assume that any attribute may be empty, invalid, or under defined.",
    "properties": {
     "name": {
      "type": "string",
      "description": "The name attribute of the resource associated with the status StatusReason (when there is a single name which can be described)."
     },
     "group": {
      "type": "string",
      "description": "The group attribute of the resource associated with the status StatusReason."
     },
     "kind": {
      "type": "string",
      "description": "The kind attribute of the resource associated with the status StatusReason. On some operations may differ from the requested resource Kind. More info: http://releases.k8s.io/HEAD/docs/devel/api-conventions.md#types-kinds"
     },
     "uid": {
      "type": "string",
      "description": "UID of the resource. (when there is a single resource which can be described). More info: http://kubernetes.io/docs/user-guide/identifiers#uids"
     },
     "causes": {
      "type": "array",
      "items": {
       "$ref": "v1.StatusCause"
      },
      "description": "The Causes array includes more details associated with the StatusReason failure. Not all StatusReasons may provide detailed causes."
     },
     "retryAfterSeconds": {
      "type": "integer",
      "format": "int32",
      "description": "If specified, the time in seconds before the operation should be retried."
     }
    }
   },
   "v1.StatusCause": {
    "id": "v1.StatusCause",
    "description": "StatusCause provides more information about an api.Status failure, including cases when multiple errors are encountered.",
    "properties": {
     "reason": {
      "type": "string",
      "description": "A machine-readable description of the cause of the error. If this value is empty there is no information available."
     },
     "message": {
      "type": "string",
      "description": "A human-readable description of the cause of the error.  This field may be presented as-is to a reader."
     },
     "field": {
      "type": "string",
      "description": "The field of the resource that has caused this error, as named by its JSON serialization. May include dot and postfix notation for nested attributes. Arrays are zero-indexed.  Fields may appear more than once in an array of causes due to fields having multiple errors. Optional.\n\nExamples:\n  \"name\" - the field \"name\" on the current resource\n  \"items[0].name\" - the field \"name\" on the first array entry in \"items\""
     }
    }
   },
   "v1.WatchEvent": {
    "id": "v1.WatchEvent",
    "required": [
     "type",
     "object"
    ],
    "properties": {
     "type": {
      "type": "string"
     },
     "object": {
      "type": "string"
     }
    }
   },
   "v1.Patch": {
    "id": "v1.Patch",
    "description": "Patch is provided to give a concrete name and type to the Kubernetes PATCH request body.",
    "properties": {}
   },
   "v1.DeleteOptions": {
    "id": "v1.DeleteOptions",
    "description": "DeleteOptions may be provided when deleting an API object.",
    "properties": {
     "kind": {
      "type": "string",
      "description": "Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: http://releases.k8s.io/HEAD/docs/devel/api-conventions.md#types-kinds"
     },
     "apiVersion": {
      "type": "string",
      "description": "APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: http://releases.k8s.io/HEAD/docs/devel/api-conventions.md#resources"
     },
     "gracePeriodSeconds": {
      "type": "integer",
      "format": "int64",
      "description": "The duration in seconds before the object should be deleted. Value must be non-negative integer. The value zero indicates delete immediately. If this value is nil, the default grace period for the specified type will be used. Defaults to a per object value if not specified. zero means delete immediately."
     },
     "preconditions": {
      "$ref": "v1.Preconditions",
      "description": "Must be fulfilled before a deletion is carried out. If not possible, a 409 Conflict status will be returned."
     },
     "orphanDependents": {
      "type": "boolean",
      "description": "Deprecated: please use the PropagationPolicy, this field will be deprecated in 1.7. Should the dependent objects be orphaned. If true/false, the \"orphan\" finalizer will be added to/removed from the object's finalizers list. Either this field or PropagationPolicy may be set, but not both."
     },
     "propagationPolicy": {
      "$ref": "v1.DeletionPropagation",
      "description": "Whether and how garbage collection will be performed. Either this field or OrphanDependents may be set, but not both. The default policy is decided by the existing finalizer set in the metadata.finalizers and the resource-specific default policy."
     }
    }
   },
   "v1.Preconditions": {
    "id": "v1.Preconditions",
    "description": "Preconditions must be fulfilled before an operation (update, delete, etc.) is carried out.",
    "properties": {
     "uid": {
      "$ref": "types.UID",
      "description": "Specifies the target UID."
     }
    }
   },
   "types.UID": {
    "id": "types.UID",
    "properties": {}
   },
   "v1.DeletionPropagation": {
    "id": "v1.DeletionPropagation",
    "properties": {}
   },
   "v1.EndpointsList": {
    "id": "v1.EndpointsList",
    "description": "EndpointsList is a list of endpoints.",
    "required": [
     "items"
    ],
    "properties": {
     "kind": {
      "type": "string",
      "description": "Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: http://releases.k8s.io/HEAD/docs/devel/api-conventions.md#types-kinds"
     },
     "apiVersion": {
      "type": "string",
      "description": "APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: http://releases.k8s.io/HEAD/docs/devel/api-conventions.md#resources"
     },
     "metadata": {
      "$ref": "v1.ListMeta",
      "description": "Standard list metadata. More info: https://github.com/kubernetes/community/blob/master/contributors/devel/sig-architecture/api-conventions.md#types-kinds"
     },
     "items": {
      "type": "array",
      "items": {
       "$ref": "v1.Endpoints"
      },
      "description": "List of endpoints."
     }
    }
   },
   "v1.Endpoints": {
    "id": "v1.Endpoints",
    "description": "Endpoints is a collection of endpoints that implement the actual service. Example:\n  Name: \"mysvc\",\n  Subsets: [\n    {\n      Addresses: [{\"ip\": \"10.10.1.1\"}, {\"ip\": \"10.10.2.2\"}],\n      Ports: [{\"name\": \"a\", \"port\": 8675}, {\"name\": \"b\", \"port\": 309}]\n    },\n    {\n      Addresses: [{\"ip\": \"10.10.3.3\"}],\n      Ports: [{\"name\": \"a\", \"port\": 93}, {\"name\": \"b\", \"port\": 76}]\n    },\n ]",
    "required": [
     "subsets"
    ],
    "properties": {
     "kind": {
      "type": "string",
      "description": "Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: http://releases.k8s.io/HEAD/docs/devel/api-conventions.md#types-kinds"
     },
     "apiVersion": {
      "type": "string",
      "description": "APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: http://releases.k8s.io/HEAD/docs/devel/api-conventions.md#resources"
     },
     "metadata": {
      "$ref": "v1.ObjectMeta",
      "description": "Standard object's metadata. More info: https://github.com/kubernetes/community/blob/master/contributors/devel/sig-architecture/api-conventions.md#metadata"
     },
     "subsets": {
      "type": "array",
      "items": {
       "$ref": "v1.EndpointSubset"
      },
      "description": "The set of all endpoints is the union of all subsets. Addresses are placed into subsets according to the IPs they share. A single address with multiple ports, some of which are ready and some of which are not (because they come from different containers) will result in the address being displayed in different subsets for the different ports. No address will appear in both Addresses and NotReadyAddresses in the same subset. Sets of addresses and ports that comprise a service."
     }
    }
   },
   "v1.EndpointSubset": {
    "id": "v1.EndpointSubset",
    "description": "EndpointSubset is a group of addresses with a common set of ports. The expanded set of endpoints is the Cartesian product of Addresses x Ports. For example, given:\n  {\n    Addresses: [{\"ip\": \"10.10.1.1\"}, {\"ip\": \"10.10.2.2\"}],\n    Ports:     [{\"name\": \"a\", \"port\": 8675}, {\"name\": \"b\", \"port\": 309}]\n  }\nThe resulting set of endpoints can be viewed as:\n    a: [ 10.10.1.1:8675, 10.10.2.2:8675 ],\n    b: [ 10.10.1.1:309, 10.10.2.2:309 ]",
    "properties": {
     "addresses": {
      "type": "array",
      "items": {
       "$ref": "v1.EndpointAddress"
      },
      "description": "IP addresses which offer the related ports that are marked as ready. These endpoints should be considered safe for load balancers and clients to utilize."
     },
     "notReadyAddresses": {
      "type": "array",
      "items": {
       "$ref": "v1.EndpointAddress"
      },
      "description": "IP addresses which offer the related ports but are not currently marked as ready because they have not yet finished starting, have recently failed a readiness check, or have recently failed a liveness check."
     },
     "ports": {
      "type": "array",
      "items": {
       "$ref": "v1.EndpointPort"
      },
      "description": "Port numbers available on the related IP addresses."
     }
    }
   },
   "v1.EndpointAddress": {
    "id": "v1.EndpointAddress",
    "description": "EndpointAddress is a tuple that describes single IP address.",
    "required": [
     "ip"
    ],
    "properties": {
     "ip": {
      "type": "string",
      "description": "The IP of this endpoint. May not be loopback (127.0.0.0/8), link-local (169.254.0.0/16), or link-local multicast ((224.0.0.0/24). IPv6 is also accepted but not fully supported on all platforms. Also, certain kubernetes components, like kube-proxy, are not IPv6 ready."
     },
     "hostname": {
      "type": "string",
      "description": "The Hostname of this endpoint"
     },
     "nodeName": {
      "type": "string",
      "description": "Optional: Node hosting this endpoint. This can be used to determine endpoints local to a node."
     },
     "targetRef": {
      "$ref": "v1.ObjectReference",
      "description": "Reference to object providing the endpoint."
     }
    }
   },
   "v1.EndpointPort": {
    "id": "v1.EndpointPort",
    "description": "EndpointPort is a tuple that describes a single port.",
    "required": [
     "port"
    ],
    "properties": {
     "name": {
      "type": "string",
      "description": "The name of this port (corresponds to ServicePort.Name). Must be a DNS_LABEL. Optional only if one port is defined."
     },
     "port": {
      "type": "integer",
      "format": "int32",
      "description": "The port number of the endpoint."
     },
     "protocol": {
      "type": "string",
      "description": "The IP protocol for this port. Must be UDP or TCP. Default is TCP."
     }
    }
   },
   "v1.EventList": {
    "id": "v1.EventList",
    "description": "EventList is a list of events.",
    "required": [
     "items"
    ],
    "properties": {
     "kind": {
      "type": "string",
      "description": "Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: http://releases.k8s.io/HEAD/docs/devel/api-conventions.md#types-kinds"
     },
     "apiVersion": {
      "type": "string",
      "description": "APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: http://releases.k8s.io/HEAD/docs/devel/api-conventions.md#resources"
     },
     "metadata": {
      "$ref": "v1.ListMeta",
      "description": "Standard list metadata. More info: https://github.com/kubernetes/community/blob/master/contributors/devel/sig-architecture/api-conventions.md#types-kinds"
     },
     "items": {
      "type": "array",
      "items": {
       "$ref": "v1.Event"
      },
      "description": "List of events"
     }
    }
   },
   "v1.Event": {
    "id": "v1.Event",
    "description": "Event is a report of an event somewhere in the cluster.",
    "required": [
     "metadata",
     "involvedObject"
    ],
    "properties": {
     "kind": {
      "type": "string",
      "description": "Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: http://releases.k8s.io/HEAD/docs/devel/api-conventions.md#types-kinds"
     },
     "apiVersion": {
      "type": "string",
      "description": "APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: http://releases.k8s.io/HEAD/docs/devel/api-conventions.md#resources"
     },
     "metadata": {
      "$ref": "v1.ObjectMeta",
      "description": "Standard object's metadata. More info: https://github.com/kubernetes/community/blob/master/contributors/devel/sig-architecture/api-conventions.md#metadata"
     },
     "involvedObject": {
      "$ref": "v1.ObjectReference",
      "description": "The object that this event is about."
     },
     "reason": {
      "type": "string",
      "description": "This should be a short, machine understandable string that gives the reason for the transition into the object's current status."
     },
     "message": {
      "type": "string",
      "description": "A human-readable description of the status of this operation."
     },
     "source": {
      "$ref": "v1.EventSource",
      "description": "The component reporting this event. Should be a short machine understandable string."
     },
     "firstTimestamp": {
      "type": "string",
      "description": "The time at which the event was first recorded. (Time of server receipt is in TypeMeta.)"
     },
     "lastTimestamp": {
      "type": "string",
      "description": "The time at which the most recent occurrence of this event was recorded."
     },
     "count": {
      "type": "integer",
      "format": "int32",
      "description": "The number of times this event has occurred."
     },
     "type": {
      "type": "string",
      "description": "Type of this event (Normal, Warning), new types could be added in the future"
     }
    }
   },
   "v1.EventSource": {
    "id": "v1.EventSource",
    "description": "EventSource contains information for an event.",
    "properties": {
     "component": {
      "type": "string",
      "description": "Component from which the event is generated."
     },
     "host": {
      "type": "string",
      "description": "Node name on which the event is generated."
     }
    }
   },
   "v1.LimitRangeList": {
    "id": "v1.LimitRangeList",
    "description": "LimitRangeList is a list of LimitRange items.",
    "required": [
     "items"
    ],
    "properties": {
     "kind": {
      "type": "string",
      "description": "Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: http://releases.k8s.io/HEAD/docs/devel/api-conventions.md#types-kinds"
     },
     "apiVersion": {
      "type": "string",
      "description": "APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: http://releases.k8s.io/HEAD/docs/devel/api-conventions.md#resources"
     },
     "metadata": {
      "$ref": "v1.ListMeta",
      "description": "Standard list metadata. More info: https://github.com/kubernetes/community/blob/master/contributors/devel/sig-architecture/api-conventions.md#types-kinds"
     },
     "items": {
      "type": "array",
      "items": {
       "$ref": "v1.LimitRange"
      },
      "description": "Items is a list of LimitRange objects. More info: https://github.com/kubernetes/community/blob/master/contributors/design-proposals/admission_control_limit_range.md"
     }
    }
   },
   "v1.LimitRange": {
    "id": "v1.LimitRange",
    "description": "LimitRange sets resource usage limits for each kind of resource in a Namespace.",
    "properties": {
     "kind": {
      "type": "string",
      "description": "Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: http://releases.k8s.io/HEAD/docs/devel/api-conventions.md#types-kinds"
     },
     "apiVersion": {
      "type": "string",
      "description": "APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: http://releases.k8s.io/HEAD/docs/devel/api-conventions.md#resources"
     },
     "metadata": {
      "$ref": "v1.ObjectMeta",
      "description": "Standard object's metadata. More info: https://github.com/kubernetes/community/blob/master/contributors/devel/sig-architecture/api-conventions.md#metadata"
     },
     "spec": {
      "$ref": "v1.LimitRangeSpec",
      "description": "Spec defines the limits enforced. More info: https://github.com/kubernetes/community/blob/master/contributors/devel/sig-architecture/api-conventions.md#spec-and-status"
     }
    }
   },
   "v1.LimitRangeSpec": {
    "id": "v1.LimitRangeSpec",
    "description": "LimitRangeSpec defines a min/max usage limit for resources that match on kind.",
    "required": [
     "limits"
    ],
    "properties": {
     "limits": {
      "type": "array",
      "items": {
       "$ref": "v1.LimitRangeItem"
      },
      "description": "Limits is the list of LimitRangeItem objects that are enforced."
     }
    }
   },
   "v1.LimitRangeItem": {
    "id": "v1.LimitRangeItem",
    "description": "LimitRangeItem defines a min/max usage limit for any resource that matches on kind.",
    "properties": {
     "type": {
      "type": "string",
      "description": "Type of resource that this limit applies to."
     },
     "max": {
      "type": "object",
      "description": "Max usage constraints on this kind by resource name."
     },
     "min": {
      "type": "object",
      "description": "Min usage constraints on this kind by resource name."
     },
     "default": {
      "type": "object",
      "description": "Default resource requirement limit value by resource name if resource limit is omitted."
     },
     "defaultRequest": {
      "type": "object",
      "description": "DefaultRequest is the default resource requirement request value by resource name if resource request is omitted."
     },
     "maxLimitRequestRatio": {
      "type": "object",
      "description": "MaxLimitRequestRatio if specified, the named resource must have a request and limit that are both non-zero where limit divided by request is less than or equal to the enumerated value; this represents the max burst for the named resource."
     }
    }
   },
   "v1.NamespaceList": {
    "id": "v1.NamespaceList",
    "description": "NamespaceList is a list of Namespaces.",
    "required": [
     "items"
    ],
    "properties": {
     "kind": {
      "type": "string",
      "description": "Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: http://releases.k8s.io/HEAD/docs/devel/api-conventions.md#types-kinds"
     },
     "apiVersion": {
      "type": "string",
      "description": "APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: http://releases.k8s.io/HEAD/docs/devel/api-conventions.md#resources"
     },
     "metadata": {
      "$ref": "v1.ListMeta",
      "description": "Standard list metadata. More info: https://github.com/kubernetes/community/blob/master/contributors/devel/sig-architecture/api-conventions.md#types-kinds"
     },
     "items": {
      "type": "array",
      "items": {
       "$ref": "v1.Namespace"
      },
      "description": "Items is the list of Namespace objects in the list. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/namespaces/"
     }
    }
   },
   "v1.Namespace": {
    "id": "v1.Namespace",
    "description": "Namespace provides a scope for Names. Use of multiple namespaces is optional.",
    "properties": {
     "kind": {
      "type": "string",
      "description": "Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: http://releases.k8s.io/HEAD/docs/devel/api-conventions.md#types-kinds"
     },
     "apiVersion": {
      "type": "string",
      "description": "APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: http://releases.k8s.io/HEAD/docs/devel/api-conventions.md#resources"
     },
     "metadata": {
      "$ref": "v1.ObjectMeta",
      "description": "Standard object's metadata. More info: https://github.com/kubernetes/community/blob/master/contributors/devel/sig-architecture/api-conventions.md#metadata"
     },
     "spec": {
      "$ref": "v1.NamespaceSpec",
      "description": "Spec defines the behavior of the Namespace. More info: https://github.com/kubernetes/community/blob/master/contributors/devel/sig-architecture/api-conventions.md#spec-and-status"
     },
     "status": {
      "$ref": "v1.NamespaceStatus",
      "description": "Status describes the current status of a Namespace. More info: https://github.com/kubernetes/community/blob/master/contributors/devel/sig-architecture/api-conventions.md#spec-and-status"
     }
    }
   },
   "v1.NamespaceSpec": {
    "id": "v1.NamespaceSpec",
    "description": "NamespaceSpec describes the attributes on a Namespace.",
    "properties": {
     "finalizers": {
      "type": "array",
      "items": {
       "$ref": "v1.FinalizerName"
      },
      "description": "Finalizers is an opaque list of values that must be empty to permanently remove object from storage. More info: https://github.com/kubernetes/community/blob/master/contributors/design-proposals/namespaces.md#finalizers"
     }
    }
   },
   "v1.FinalizerName": {
    "id": "v1.FinalizerName",
    "properties": {}
   },
   "v1.NamespaceStatus": {
    "id": "v1.NamespaceStatus",
    "description": "NamespaceStatus is information about the current status of a Namespace.",
    "properties": {
     "phase": {
      "type": "string",
      "description": "Phase is the current lifecycle phase of the namespace. More info: https://github.com/kubernetes/community/blob/master/contributors/design-proposals/namespaces.md#phases"
     }
    }
   },
   "v1.NodeList": {
    "id": "v1.NodeList",
    "description": "NodeList is the whole list of all Nodes which have been registered with master.",
    "required": [
     "items"
    ],
    "properties": {
     "kind": {
      "type": "string",
      "description": "Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: http://releases.k8s.io/HEAD/docs/devel/api-conventions.md#types-kinds"
     },
     "apiVersion": {
      "type": "string",
      "description": "APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: http://releases.k8s.io/HEAD/docs/devel/api-conventions.md#resources"
     },
     "metadata": {
      "$ref": "v1.ListMeta",
      "description": "Standard list metadata. More info: https://github.com/kubernetes/community/blob/master/contributors/devel/sig-architecture/api-conventions.md#types-kinds"
     },
     "items": {
      "type": "array",
      "items": {
       "$ref": "v1.Node"
      },
      "description": "List of nodes"
     }
    }
   },
   "v1.Node": {
    "id": "v1.Node",
    "description": "Node is a worker node in Kubernetes. Each node will have a unique identifier in the cache (i.e. in etcd).",
    "properties": {
     "kind": {
      "type": "string",
      "description": "Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: http://releases.k8s.io/HEAD/docs/devel/api-conventions.md#types-kinds"
     },
     "apiVersion": {
      "type": "string",
      "description": "APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: http://releases.k8s.io/HEAD/docs/devel/api-conventions.md#resources"
     },
     "metadata": {
      "$ref": "v1.ObjectMeta",
      "description": "Standard object's metadata. More info: https://github.com/kubernetes/community/blob/master/contributors/devel/sig-architecture/api-conventions.md#metadata"
     },
     "spec": {
      "$ref": "v1.NodeSpec",
      "description": "Spec defines the behavior of a node. https://github.com/kubernetes/community/blob/master/contributors/devel/sig-architecture/api-conventions.md#spec-and-status"
     },
     "status": {
      "$ref": "v1.NodeStatus",
      "description": "Most recently observed status of the node. Populated by the system. Read-only. More info: https://github.com/kubernetes/community/blob/master/contributors/devel/sig-architecture/api-conventions.md#spec-and-status"
     }
    }
   },
   "v1.NodeSpec": {
    "id": "v1.NodeSpec",
    "description": "NodeSpec describes the attributes that a node is created with.",
    "properties": {
     "podCIDR": {
      "type": "string",
      "description": "PodCIDR represents the pod IP range assigned to the node."
     },
     "externalID": {
      "type": "string",
      "description": "External ID of the node assigned by some machine database (e.g. a cloud provider). Deprecated."
     },
     "providerID": {
      "type": "string",
      "description": "ID of the node assigned by the cloud provider in the format: \u003cProviderName\u003e://\u003cProviderSpecificNodeID\u003e"
     },
     "unschedulable": {
      "type": "boolean",
      "description": "Unschedulable controls node schedulability of new pods. By default, node is schedulable. More info: https://kubernetes.io/docs/concepts/nodes/node/#manual-node-administration"
     },
     "taints": {
      "type": "array",
      "items": {
       "$ref": "v1.Taint"
      },
      "description": "If specified, the node's taints."
     }
    }
   },
   "v1.Taint": {
    "id": "v1.Taint",
    "description": "The node this Taint is attached to has the effect \"effect\" on any pod that that does not tolerate the Taint.",
    "required": [
     "key",
     "effect"
    ],
    "properties": {
     "key": {
      "type": "string",
      "description": "Required. The taint key to be applied to a node."
     },
     "value": {
      "type": "string",
      "description": "Required. The taint value corresponding to the taint key."
     },
     "effect": {
      "type": "string",
      "description": "Required. The effect of the taint on pods that do not tolerate the taint. Valid effects are NoSchedule, PreferNoSchedule and NoExecute."
     },
     "timeAdded": {
      "type": "string",
      "description": "TimeAdded represents the time at which the taint was added. It is only written for NoExecute taints."
     }
    }
   },
   "v1.NodeStatus": {
    "id": "v1.NodeStatus",
    "description": "NodeStatus is information about the current status of a node.",
    "properties": {
     "capacity": {
      "type": "object",
      "description": "Capacity represents the total resources of a node. More info: https://kubernetes.io/docs/concepts/storage/persistent-volumes#capacity"
     },
     "allocatable": {
      "type": "object",
      "description": "Allocatable represents the resources of a node that are available for scheduling. Defaults to Capacity."
     },
     "phase": {
      "type": "string",
      "description": "NodePhase is the recently observed lifecycle phase of the node. More info: https://kubernetes.io/docs/concepts/nodes/node/#phase The field is never populated, and now is deprecated."
     },
     "conditions": {
      "type": "array",
      "items": {
       "$ref": "v1.NodeCondition"
      },
      "description": "Conditions is an array of current observed node conditions. More info: https://kubernetes.io/docs/concepts/nodes/node/#condition"
     },
     "addresses": {
      "type": "array",
      "items": {
       "$ref": "v1.NodeAddress"
      },
      "description": "List of addresses reachable to the node. Queried from cloud provider, if available. More info: https://kubernetes.io/docs/concepts/nodes/node/#addresses"
     },
     "daemonEndpoints": {
      "$ref": "v1.NodeDaemonEndpoints",
      "description": "Endpoints of daemons running on the Node."
     },
     "nodeInfo": {
      "$ref": "v1.NodeSystemInfo",
      "description": "Set of ids/uuids to uniquely identify the node. More info: https://kubernetes.io/docs/concepts/nodes/node/#info"
     },
     "images": {
      "type": "array",
      "items": {
       "$ref": "v1.ContainerImage"
      },
      "description": "List of container images on this node"
     },
     "volumesInUse": {
      "type": "array",
      "items": {
       "$ref": "v1.UniqueVolumeName"
      },
      "description": "List of attachable volumes in use (mounted) by the node."
     },
     "volumesAttached": {
      "type": "array",
      "items": {
       "$ref": "v1.AttachedVolume"
      },
      "description": "List of volumes that are attached to the node."
     }
    }
   },
   "v1.NodeCondition": {
    "id": "v1.NodeCondition",
    "description": "NodeCondition contains condition information for a node.",
    "required": [
     "type",
     "status"
    ],
    "properties": {
     "type": {
      "type": "string",
      "description": "Type of node condition."
     },
     "status": {
      "type": "string",
      "description": "Status of the condition, one of True, False, Unknown."
     },
     "lastHeartbeatTime": {
      "type": "string",
      "description": "Last time we got an update on a given condition."
     },
     "lastTransitionTime": {
      "type": "string",
      "description": "Last time the condition transit from one status to another."
     },
     "reason": {
      "type": "string",
      "description": "(brief) reason for the condition's last transition."
     },
     "message": {
      "type": "string",
      "description": "Human readable message indicating details about last transition."
     }
    }
   },
   "v1.NodeAddress": {
    "id": "v1.NodeAddress",
    "description": "NodeAddress contains information for the node's address.",
    "required": [
     "type",
     "address"
    ],
    "properties": {
     "type": {
      "type": "string",
      "description": "Node address type, one of Hostname, ExternalIP or InternalIP."
     },
     "address": {
      "type": "string",
      "description": "The node address."
     }
    }
   },
   "v1.NodeDaemonEndpoints": {
    "id": "v1.NodeDaemonEndpoints",
    "description": "NodeDaemonEndpoints lists ports opened by daemons running on the Node.",
    "properties": {
     "kubeletEndpoint": {
      "$ref": "v1.DaemonEndpoint",
      "description": "Endpoint on which Kubelet is listening."
     }
    }
   },
   "v1.DaemonEndpoint": {
    "id": "v1.DaemonEndpoint",
    "description": "DaemonEndpoint contains information about a single Daemon endpoint.",
    "required": [
     "Port"
    ],
    "properties": {
     "Port": {
      "type": "integer",
      "format": "int32",
      "description": "Port number of the given endpoint."
     }
    }
   },
   "v1.NodeSystemInfo": {
    "id": "v1.NodeSystemInfo",
    "description": "NodeSystemInfo is a set of ids/uuids to uniquely identify the node.",
    "required": [
     "machineID",
     "systemUUID",
     "bootID",
     "kernelVersion",
     "osImage",
     "containerRuntimeVersion",
     "kubeletVersion",
     "kubeProxyVersion",
     "operatingSystem",
     "architecture"
    ],
    "properties": {
     "machineID": {
      "type": "string",
      "description": "MachineID reported by the node. For unique machine identification in the cluster this field is prefered. Learn more from man(5) machine-id: http://man7.org/linux/man-pages/man5/machine-id.5.html"
     },
     "systemUUID": {
      "type": "string",
      "description": "SystemUUID reported by the node. For unique machine identification MachineID is prefered. This field is specific to Red Hat hosts https://access.redhat.com/documentation/en-US/Red_Hat_Subscription_Management/1/html/RHSM/getting-system-uuid.html"
     },
     "bootID": {
      "type": "string",
      "description": "Boot ID reported by the node."
     },
     "kernelVersion": {
      "type": "string",
      "description": "Kernel Version reported by the node from 'uname -r' (e.g. 3.16.0-0.bpo.4-amd64)."
     },
     "osImage": {
      "type": "string",
      "description": "OS Image reported by the node from /etc/os-release (e.g. Debian GNU/Linux 7 (wheezy))."
     },
     "containerRuntimeVersion": {
      "type": "string",
      "description": "ContainerRuntime Version reported by the node through runtime remote API (e.g. docker://1.5.0)."
     },
     "kubeletVersion": {
      "type": "string",
      "description": "Kubelet Version reported by the node."
     },
     "kubeProxyVersion": {
      "type": "string",
      "description": "KubeProxy Version reported by the node."
     },
     "operatingSystem": {
      "type": "string",
      "description": "The Operating System reported by the node"
     },
     "architecture": {
      "type": "string",
      "description": "The Architecture reported by the node"
     }
    }
   },
   "v1.ContainerImage": {
    "id": "v1.ContainerImage",
    "description": "Describe a container image",
    "required": [
     "names"
    ],
    "properties": {
     "names": {
      "type": "array",
      "items": {
       "type": "string"
      },
      "description": "Names by which this image is known. e.g. [\"gcr.io/google_containers/hyperkube:v1.0.7\", \"dockerhub.io/google_containers/hyperkube:v1.0.7\"]"
     },
     "sizeBytes": {
      "type": "integer",
      "format": "int64",
      "description": "The size of the image in bytes."
     }
    }
   },
   "v1.UniqueVolumeName": {
    "id": "v1.UniqueVolumeName",
    "properties": {}
   },
   "v1.AttachedVolume": {
    "id": "v1.AttachedVolume",
    "description": "AttachedVolume describes a volume attached to a node",
    "required": [
     "name",
     "devicePath"
    ],
    "properties": {
     "name": {
      "type": "string",
      "description": "Name of the attached volume"
     },
     "devicePath": {
      "type": "string",
      "description": "DevicePath represents the device path where the volume should be available"
     }
    }
   },
   "v1.PersistentVolumeClaimList": {
    "id": "v1.PersistentVolumeClaimList",
    "description": "PersistentVolumeClaimList is a list of PersistentVolumeClaim items.",
    "required": [
     "items"
    ],
    "properties": {
     "kind": {
      "type": "string",
      "description": "Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: http://releases.k8s.io/HEAD/docs/devel/api-conventions.md#types-kinds"
     },
     "apiVersion": {
      "type": "string",
      "description": "APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: http://releases.k8s.io/HEAD/docs/devel/api-conventions.md#resources"
     },
     "metadata": {
      "$ref": "v1.ListMeta",
      "description": "Standard list metadata. More info: https://github.com/kubernetes/community/blob/master/contributors/devel/sig-architecture/api-conventions.md#types-kinds"
     },
     "items": {
      "type": "array",
      "items": {
       "$ref": "v1.PersistentVolumeClaim"
      },
      "description": "A list of persistent volume claims. More info: https://kubernetes.io/docs/concepts/storage/persistent-volumes#persistentvolumeclaims"
     }
    }
   },
   "v1.PersistentVolumeClaim": {
    "id": "v1.PersistentVolumeClaim",
    "description": "PersistentVolumeClaim is a user's request for and claim to a persistent volume",
    "properties": {
     "kind": {
      "type": "string",
      "description": "Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: http://releases.k8s.io/HEAD/docs/devel/api-conventions.md#types-kinds"
     },
     "apiVersion": {
      "type": "string",
      "description": "APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: http://releases.k8s.io/HEAD/docs/devel/api-conventions.md#resources"
     },
     "metadata": {
      "$ref": "v1.ObjectMeta",
      "description": "Standard object's metadata. More info: https://github.com/kubernetes/community/blob/master/contributors/devel/sig-architecture/api-conventions.md#metadata"
     },
     "spec": {
      "$ref": "v1.PersistentVolumeClaimSpec",
      "description": "Spec defines the desired characteristics of a volume requested by a pod author. More info: https://kubernetes.io/docs/concepts/storage/persistent-volumes#persistentvolumeclaims"
     },
     "status": {
      "$ref": "v1.PersistentVolumeClaimStatus",
      "description": "Status represents the current information/status of a persistent volume claim. Read-only. More info: https://kubernetes.io/docs/concepts/storage/persistent-volumes#persistentvolumeclaims"
     }
    }
   },
   "v1.PersistentVolumeClaimSpec": {
    "id": "v1.PersistentVolumeClaimSpec",
    "description": "PersistentVolumeClaimSpec describes the common attributes of storage devices and allows a Source for provider-specific attributes",
    "properties": {
     "accessModes": {
      "type": "array",
      "items": {
       "$ref": "v1.PersistentVolumeAccessMode"
      },
      "description": "AccessModes contains the desired access modes the volume should have. More info: https://kubernetes.io/docs/concepts/storage/persistent-volumes#access-modes-1"
     },
     "selector": {
      "$ref": "v1.LabelSelector",
      "description": "A label query over volumes to consider for binding."
     },
     "resources": {
      "$ref": "v1.ResourceRequirements",
      "description": "Resources represents the minimum resources the volume should have. More info: https://kubernetes.io/docs/concepts/storage/persistent-volumes#resources"
     },
     "volumeName": {
      "type": "string",
      "description": "VolumeName is the binding reference to the PersistentVolume backing this claim."
     },
     "storageClassName": {
      "type": "string",
      "description": "Name of the StorageClass required by the claim. More info: https://kubernetes.io/docs/concepts/storage/persistent-volumes#class-1"
     }
    }
   },
   "v1.PersistentVolumeAccessMode": {
    "id": "v1.PersistentVolumeAccessMode",
    "properties": {}
   },
   "v1.LabelSelector": {
    "id": "v1.LabelSelector",
    "description": "A label selector is a label query over a set of resources. The result of matchLabels and matchExpressions are ANDed. An empty label selector matches all objects. A null label selector matches no objects.",
    "properties": {
     "matchLabels": {
      "type": "object",
      "description": "matchLabels is a map of {key,value} pairs. A single {key,value} in the matchLabels map is equivalent to an element of matchExpressions, whose key field is \"key\", the operator is \"In\", and the values array contains only \"value\". The requirements are ANDed."
     },
     "matchExpressions": {
      "type": "array",
      "items": {
       "$ref": "v1.LabelSelectorRequirement"
      },
      "description": "matchExpressions is a list of label selector requirements. The requirements are ANDed."
     }
    }
   },
   "v1.LabelSelectorRequirement": {
    "id": "v1.LabelSelectorRequirement",
    "description": "A label selector requirement is a selector that contains values, a key, and an operator that relates the key and values.",
    "required": [
     "key",
     "operator"
    ],
    "properties": {
     "key": {
      "type": "string",
      "description": "key is the label key that the selector applies to."
     },
     "operator": {
      "type": "string",
      "description": "operator represents a key's relationship to a set of values. Valid operators ard In, NotIn, Exists and DoesNotExist."
     },
     "values": {
      "type": "array",
      "items": {
       "type": "string"
      },
      "description": "values is an array of string values. If the operator is In or NotIn, the values array must be non-empty. If the operator is Exists or DoesNotExist, the values array must be empty. This array is replaced during a strategic merge patch."
     }
    }
   },
   "v1.ResourceRequirements": {
    "id": "v1.ResourceRequirements",
    "description": "ResourceRequirements describes the compute resource requirements.",
    "properties": {
     "limits": {
      "type": "object",
      "description": "Limits describes the maximum amount of compute resources allowed. More info: https://kubernetes.io/docs/concepts/configuration/manage-compute-resources-container/"
     },
     "requests": {
      "type": "object",
      "description": "Requests describes the minimum amount of compute resources required. If Requests is omitted for a container, it defaults to Limits if that is explicitly specified, otherwise to an implementation-defined value. More info: https://kubernetes.io/docs/concepts/configuration/manage-compute-resources-container/"
     }
    }
   },
   "v1.PersistentVolumeClaimStatus": {
    "id": "v1.PersistentVolumeClaimStatus",
    "description": "PersistentVolumeClaimStatus is the current status of a persistent volume claim.",
    "properties": {
     "phase": {
      "type": "string",
      "description": "Phase represents the current phase of PersistentVolumeClaim."
     },
     "accessModes": {
      "type": "array",
      "items": {
       "$ref": "v1.PersistentVolumeAccessMode"
      },
      "description": "AccessModes contains the actual access modes the volume backing the PVC has. More info: https://kubernetes.io/docs/concepts/storage/persistent-volumes#access-modes-1"
     },
     "capacity": {
      "type": "object",
      "description": "Represents the actual resources of the underlying volume."
     }
    }
   },
   "v1.PersistentVolumeList": {
    "id": "v1.PersistentVolumeList",
    "description": "PersistentVolumeList is a list of PersistentVolume items.",
    "required": [
     "items"
    ],
    "properties": {
     "kind": {
      "type": "string",
      "description": "Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: http://releases.k8s.io/HEAD/docs/devel/api-conventions.md#types-kinds"
     },
     "apiVersion": {
      "type": "string",
      "description": "APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: http://releases.k8s.io/HEAD/docs/devel/api-conventions.md#resources"
     },
     "metadata": {
      "$ref": "v1.ListMeta",
      "description": "Standard list metadata. More info: https://github.com/kubernetes/community/blob/master/contributors/devel/sig-architecture/api-conventions.md#types-kinds"
     },
     "items": {
      "type": "array",
      "items": {
       "$ref": "v1.PersistentVolume"
      },
      "description": "List of persistent volumes. More info: https://kubernetes.io/docs/concepts/storage/persistent-volumes"
     }
    }
   },
   "v1.PersistentVolume": {
    "id": "v1.PersistentVolume",
    "description": "PersistentVolume (PV) is a storage resource provisioned by an administrator. It is analogous to a node. More info: https://kubernetes.io/docs/concepts/storage/persistent-volumes",
    "properties": {
     "kind": {
      "type": "string",
      "description": "Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: http://releases.k8s.io/HEAD/docs/devel/api-conventions.md#types-kinds"
     },
     "apiVersion": {
      "type": "string",
      "description": "APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: http://releases.k8s.io/HEAD/docs/devel/api-conventions.md#resources"
     },
     "metadata": {
      "$ref": "v1.ObjectMeta",
      "description": "Standard object's metadata. More info: https://github.com/kubernetes/community/blob/master/contributors/devel/sig-architecture/api-conventions.md#metadata"
     },
     "spec": {
      "$ref": "v1.PersistentVolumeSpec",
      "description": "Spec defines a specification of a persistent volume owned by the cluster. Provisioned by an administrator. More info: https://kubernetes.io/docs/concepts/storage/persistent-volumes#persistent-volumes"
     },
     "status": {
      "$ref": "v1.PersistentVolumeStatus",
      "description": "Status represents the current information/status for the persistent volume. Populated by the system. Read-only. More info: https://kubernetes.io/docs/concepts/storage/persistent-volumes#persistent-volumes"
     }
    }
   },
   "v1.PersistentVolumeSpec": {
    "id": "v1.PersistentVolumeSpec",
    "description": "PersistentVolumeSpec is the specification of a persistent volume.",
    "properties": {
     "capacity": {
      "type": "object",
      "description": "A description of the persistent volume's resources and capacity. More info: https://kubernetes.io/docs/concepts/storage/persistent-volumes#capacity"
     },
     "gcePersistentDisk": {
      "$ref": "v1.GCEPersistentDiskVolumeSource",
      "description": "GCEPersistentDisk represents a GCE Disk resource that is attached to a kubelet's host machine and then exposed to the pod. Provisioned by an admin. More info: https://kubernetes.io/docs/concepts/storage/volumes#gcepersistentdisk"
     },
     "awsElasticBlockStore": {
      "$ref": "v1.AWSElasticBlockStoreVolumeSource",
      "description": "AWSElasticBlockStore represents an AWS Disk resource that is attached to a kubelet's host machine and then exposed to the pod. More info: https://kubernetes.io/docs/concepts/storage/volumes#awselasticblockstore"
     },
     "hostPath": {
      "$ref": "v1.HostPathVolumeSource",
      "description": "HostPath represents a directory on the host. Provisioned by a developer or tester. This is useful for single-node development and testing only! On-host storage is not supported in any way and WILL NOT WORK in a multi-node cluster. More info: https://kubernetes.io/docs/concepts/storage/volumes#hostpath"
     },
     "glusterfs": {
      "$ref": "v1.GlusterfsVolumeSource",
      "description": "Glusterfs represents a Glusterfs volume that is attached to a host and exposed to the pod. Provisioned by an admin. More info: https://releases.k8s.io/HEAD/examples/volumes/glusterfs/README.md"
     },
     "nfs": {
      "$ref": "v1.NFSVolumeSource",
      "description": "NFS represents an NFS mount on the host. Provisioned by an admin. More info: https://kubernetes.io/docs/concepts/storage/volumes#nfs"
     },
     "rbd": {
      "$ref": "v1.RBDVolumeSource",
      "description": "RBD represents a Rados Block Device mount on the host that shares a pod's lifetime. More info: https://releases.k8s.io/HEAD/examples/volumes/rbd/README.md"
     },
     "iscsi": {
      "$ref": "v1.ISCSIVolumeSource",
      "description": "ISCSI represents an ISCSI Disk resource that is attached to a kubelet's host machine and then exposed to the pod. Provisioned by an admin."
     },
     "cinder": {
      "$ref": "v1.CinderVolumeSource",
      "description": "Cinder represents a cinder volume attached and mounted on kubelets host machine More info: https://releases.k8s.io/HEAD/examples/mysql-cinder-pd/README.md"
     },
     "cephfs": {
      "$ref": "v1.CephFSVolumeSource",
      "description": "CephFS represents a Ceph FS mount on the host that shares a pod's lifetime"
     },
     "fc": {
      "$ref": "v1.FCVolumeSource",
      "description": "FC represents a Fibre Channel resource that is attached to a kubelet's host machine and then exposed to the pod."
     },
     "flocker": {
      "$ref": "v1.FlockerVolumeSource",
      "description": "Flocker represents a Flocker volume attached to a kubelet's host machine and exposed to the pod for its usage. This depends on the Flocker control service being running"
     },
     "flexVolume": {
      "$ref": "v1.FlexVolumeSource",
      "description": "FlexVolume represents a generic volume resource that is provisioned/attached using an exec based plugin. This is an alpha feature and may change in future."
     },
     "azureFile": {
      "$ref": "v1.AzureFileVolumeSource",
      "description": "AzureFile represents an Azure File Service mount on the host and bind mount to the pod."
     },
     "vsphereVolume": {
      "$ref": "v1.VsphereVirtualDiskVolumeSource",
      "description": "VsphereVolume represents a vSphere volume attached and mounted on kubelets host machine"
     },
     "quobyte": {
      "$ref": "v1.QuobyteVolumeSource",
      "description": "Quobyte represents a Quobyte mount on the host that shares a pod's lifetime"
     },
     "azureDisk": {
      "$ref": "v1.AzureDiskVolumeSource",
      "description": "AzureDisk represents an Azure Data Disk mount on the host and bind mount to the pod."
     },
     "photonPersistentDisk": {
      "$ref": "v1.PhotonPersistentDiskVolumeSource",
      "description": "PhotonPersistentDisk represents a PhotonController persistent disk attached and mounted on kubelets host machine"
     },
     "portworxVolume": {
      "$ref": "v1.PortworxVolumeSource",
      "description": "PortworxVolume represents a portworx volume attached and mounted on kubelets host machine"
     },
     "scaleIO": {
      "$ref": "v1.ScaleIOVolumeSource",
      "description": "ScaleIO represents a ScaleIO persistent volume attached and mounted on Kubernetes nodes."
     },
     "accessModes": {
      "type": "array",
      "items": {
       "$ref": "v1.PersistentVolumeAccessMode"
      },
      "description": "AccessModes contains all ways the volume can be mounted. More info: https://kubernetes.io/docs/concepts/storage/persistent-volumes#access-modes"
     },
     "claimRef": {
      "$ref": "v1.ObjectReference",
      "description": "ClaimRef is part of a bi-directional binding between PersistentVolume and PersistentVolumeClaim. Expected to be non-nil when bound. claim.VolumeName is the authoritative bind between PV and PVC. More info: https://kubernetes.io/docs/concepts/storage/persistent-volumes#binding"
     },
     "persistentVolumeReclaimPolicy": {
      "type": "string",
      "description": "What happens to a persistent volume when released from its claim. Valid options are Retain (default) and Recycle. Recycling must be supported by the volume plugin underlying this persistent volume. More info: https://kubernetes.io/docs/concepts/storage/persistent-volumes#reclaiming"
     },
     "storageClassName": {
      "type": "string",
      "description": "Name of StorageClass to which this persistent volume belongs. Empty value means that this volume does not belong to any StorageClass."
     }
    }
   },
   "v1.GCEPersistentDiskVolumeSource": {
    "id": "v1.GCEPersistentDiskVolumeSource",
    "description": "Represents a Persistent Disk resource in Google Compute Engine.\n\nA GCE PD must exist before mounting to a container. The disk must also be in the same GCE project and zone as the kubelet. A GCE PD can only be mounted as read/write once or read-only many times. GCE PDs support ownership management and SELinux relabeling.",
    "required": [
     "pdName"
    ],
    "properties": {
     "pdName": {
      "type": "string",
      "description": "Unique name of the PD resource in GCE. Used to identify the disk in GCE. More info: https://kubernetes.io/docs/concepts/storage/volumes#gcepersistentdisk"
     },
     "fsType": {
      "type": "string",
      "description": "Filesystem type of the volume that you want to mount. Tip: Ensure that the filesystem type is supported by the host operating system. Examples: \"ext4\", \"xfs\", \"ntfs\". Implicitly inferred to be \"ext4\" if unspecified. More info: https://kubernetes.io/docs/concepts/storage/volumes#gcepersistentdisk"
     },
     "partition": {
      "type": "integer",
      "format": "int32",
      "description": "The partition in the volume that you want to mount. If omitted, the default is to mount by volume name. Examples: For volume /dev/sda1, you specify the partition as \"1\". Similarly, the volume partition for /dev/sda is \"0\" (or you can leave the property empty). More info: https://kubernetes.io/docs/concepts/storage/volumes#gcepersistentdisk"
     },
     "readOnly": {
      "type": "boolean",
      "description": "ReadOnly here will force the ReadOnly setting in VolumeMounts. Defaults to false. More info: https://kubernetes.io/docs/concepts/storage/volumes#gcepersistentdisk"
     }
    }
   },
   "v1.AWSElasticBlockStoreVolumeSource": {
    "id": "v1.AWSElasticBlockStoreVolumeSource",
    "description": "Represents a Persistent Disk resource in AWS.\n\nAn AWS EBS disk must exist before mounting to a container. The disk must also be in the same AWS zone as the kubelet. An AWS EBS disk can only be mounted as read/write once. AWS EBS volumes support ownership management and SELinux relabeling.",
    "required": [
     "volumeID"
    ],
    "properties": {
     "volumeID": {
      "type": "string",
      "description": "Unique ID of the persistent disk resource in AWS (Amazon EBS volume). More info: https://kubernetes.io/docs/concepts/storage/volumes#awselasticblockstore"
     },
     "fsType": {
      "type": "string",
      "description": "Filesystem type of the volume that you want to mount. Tip: Ensure that the filesystem type is supported by the host operating system. Examples: \"ext4\", \"xfs\", \"ntfs\". Implicitly inferred to be \"ext4\" if unspecified. More info: https://kubernetes.io/docs/concepts/storage/volumes#awselasticblockstore"
     },
     "partition": {
      "type": "integer",
      "format": "int32",
      "description": "The partition in the volume that you want to mount. If omitted, the default is to mount by volume name. Examples: For volume /dev/sda1, you specify the partition as \"1\". Similarly, the volume partition for /dev/sda is \"0\" (or you can leave the property empty)."
     },
     "readOnly": {
      "type": "boolean",
      "description": "Specify \"true\" to force and set the ReadOnly property in VolumeMounts to \"true\". If omitted, the default is \"false\". More info: https://kubernetes.io/docs/concepts/storage/volumes#awselasticblockstore"
     }
    }
   },
   "v1.HostPathVolumeSource": {
    "id": "v1.HostPathVolumeSource",
    "description": "Represents a host path mapped into a pod. Host path volumes do not support ownership management or SELinux relabeling.",
    "required": [
     "path"
    ],
    "properties": {
     "path": {
      "type": "string",
      "description": "Path of the directory on the host. More info: https://kubernetes.io/docs/concepts/storage/volumes#hostpath"
     }
    }
   },
   "v1.GlusterfsVolumeSource": {
    "id": "v1.GlusterfsVolumeSource",
    "description": "Represents a Glusterfs mount that lasts the lifetime of a pod. Glusterfs volumes do not support ownership management or SELinux relabeling.",
    "required": [
     "endpoints",
     "path"
    ],
    "properties": {
     "endpoints": {
      "type": "string",
      "description": "EndpointsName is the endpoint name that details Glusterfs topology. More info: https://releases.k8s.io/HEAD/examples/volumes/glusterfs/README.md#create-a-pod"
     },
     "path": {
      "type": "string",
      "description": "Path is the Glusterfs volume path. More info: https://releases.k8s.io/HEAD/examples/volumes/glusterfs/README.md#create-a-pod"
     },
     "readOnly": {
      "type": "boolean",
      "description": "ReadOnly here will force the Glusterfs volume to be mounted with read-only permissions. Defaults to false. More info: https://releases.k8s.io/HEAD/examples/volumes/glusterfs/README.md#create-a-pod"
     }
    }
   },
   "v1.NFSVolumeSource": {
    "id": "v1.NFSVolumeSource",
    "description": "Represents an NFS mount that lasts the lifetime of a pod. NFS volumes do not support ownership management or SELinux relabeling.",
    "required": [
     "server",
     "path"
    ],
    "properties": {
     "server": {
      "type": "string",
      "description": "Server is the hostname or IP address of the NFS server. More info: https://kubernetes.io/docs/concepts/storage/volumes#nfs"
     },
     "path": {
      "type": "string",
      "description": "Path that is exported by the NFS server. More info: https://kubernetes.io/docs/concepts/storage/volumes#nfs"
     },
     "readOnly": {
      "type": "boolean",
      "description": "ReadOnly here will force the NFS export to be mounted with read-only permissions. Defaults to false. More info: https://kubernetes.io/docs/concepts/storage/volumes#nfs"
     }
    }
   },
   "v1.RBDVolumeSource": {
    "id": "v1.RBDVolumeSource",
    "description": "Represents a Rados Block Device mount that lasts the lifetime of a pod. RBD volumes support ownership management and SELinux relabeling.",
    "required": [
     "monitors",
     "image"
    ],
    "properties": {
     "monitors": {
      "type": "array",
      "items": {
       "type": "string"
      },
      "description": "A collection of Ceph monitors. More info: https://releases.k8s.io/HEAD/examples/volumes/rbd/README.md#how-to-use-it"
     },
     "image": {
      "type": "string",
      "description": "The rados image name. More info: https://releases.k8s.io/HEAD/examples/volumes/rbd/README.md#how-to-use-it"
     },
     "fsType": {
      "type": "string",
      "description": "Filesystem type of the volume that you want to mount. Tip: Ensure that the filesystem type is supported by the host operating system. Examples: \"ext4\", \"xfs\", \"ntfs\". Implicitly inferred to be \"ext4\" if unspecified. More info: https://kubernetes.io/docs/concepts/storage/volumes#rbd"
     },
     "pool": {
      "type": "string",
      "description": "The rados pool name. Default is rbd. More info: https://releases.k8s.io/HEAD/examples/volumes/rbd/README.md#how-to-use-it"
     },
     "user": {
      "type": "string",
      "description": "The rados user name. Default is admin. More info: https://releases.k8s.io/HEAD/examples/volumes/rbd/README.md#how-to-use-it"
     },
     "keyring": {
      "type": "string",
      "description": "Keyring is the path to key ring for RBDUser. Default is /etc/ceph/keyring. More info: https://releases.k8s.io/HEAD/examples/volumes/rbd/README.md#how-to-use-it"
     },
     "secretRef": {
      "$ref": "v1.LocalObjectReference",
      "description": "SecretRef is name of the authentication secret for RBDUser. If provided overrides keyring. Default is nil. More info: https://releases.k8s.io/HEAD/examples/volumes/rbd/README.md#how-to-use-it"
     },
     "readOnly": {
      "type": "boolean",
      "description": "ReadOnly here will force the ReadOnly setting in VolumeMounts. Defaults to false. More info: https://releases.k8s.io/HEAD/examples/volumes/rbd/README.md#how-to-use-it"
     }
    }
   },
   "v1.LocalObjectReference": {
    "id": "v1.LocalObjectReference",
    "description": "LocalObjectReference contains enough information to let you locate the referenced object inside the same namespace.",
    "properties": {
     "name": {
      "type": "string",
      "description": "Name of the referent. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#names"
     }
    }
   },
   "v1.ISCSIVolumeSource": {
    "id": "v1.ISCSIVolumeSource",
    "description": "Represents an ISCSI disk. ISCSI volumes can only be mounted as read/write once. ISCSI volumes support ownership management and SELinux relabeling.",
    "required": [
     "targetPortal",
     "iqn",
     "lun"
    ],
    "properties": {
     "targetPortal": {
      "type": "string",
      "description": "iSCSI target portal. The portal is either an IP or ip_addr:port if the port is other than default (typically TCP ports 860 and 3260)."
     },
     "iqn": {
      "type": "string",
      "description": "Target iSCSI Qualified Name."
     },
     "lun": {
      "type": "integer",
      "format": "int32",
      "description": "iSCSI target lun number."
     },
     "iscsiInterface": {
      "type": "string",
      "description": "Optional: Defaults to 'default' (tcp). iSCSI interface name that uses an iSCSI transport."
     },
     "fsType": {
      "type": "string",
      "description": "Filesystem type of the volume that you want to mount. Tip: Ensure that the filesystem type is supported by the host operating system. Examples: \"ext4\", \"xfs\", \"ntfs\". Implicitly inferred to be \"ext4\" if unspecified. More info: https://kubernetes.io/docs/concepts/storage/volumes#iscsi"
     },
     "readOnly": {
      "type": "boolean",
      "description": "ReadOnly here will force the ReadOnly setting in VolumeMounts. Defaults to false."
     },
     "portals": {
      "type": "array",
      "items": {
       "type": "string"
      },
      "description": "iSCSI target portal List. The portal is either an IP or ip_addr:port if the port is other than default (typically TCP ports 860 and 3260)."
     },
     "chapAuthDiscovery": {
      "type": "boolean",
      "description": "whether support iSCSI Discovery CHAP authentication"
     },
     "chapAuthSession": {
      "type": "boolean",
      "description": "whether support iSCSI Session CHAP authentication"
     },
     "secretRef": {
      "$ref": "v1.LocalObjectReference",
      "description": "CHAP secret for iSCSI target and initiator authentication"
     }
    }
   },
   "v1.CinderVolumeSource": {
    "id": "v1.CinderVolumeSource",
    "description": "Represents a cinder volume resource in Openstack. A Cinder volume must exist before mounting to a container. The volume must also be in the same region as the kubelet. Cinder volumes support ownership management and SELinux relabeling.",
    "required": [
     "volumeID"
    ],
    "properties": {
     "volumeID": {
      "type": "string",
      "description": "volume id used to identify the volume in cinder More info: https://releases.k8s.io/HEAD/examples/mysql-cinder-pd/README.md"
     },
     "fsType": {
      "type": "string",
      "description": "Filesystem type to mount. Must be a filesystem type supported by the host operating system. Examples: \"ext4\", \"xfs\", \"ntfs\". Implicitly inferred to be \"ext4\" if unspecified. More info: https://releases.k8s.io/HEAD/examples/mysql-cinder-pd/README.md"
     },
     "readOnly": {
      "type": "boolean",
      "description": "Optional: Defaults to false (read/write). ReadOnly here will force the ReadOnly setting in VolumeMounts. More info: https://releases.k8s.io/HEAD/examples/mysql-cinder-pd/README.md"
     }
    }
   },
   "v1.CephFSVolumeSource": {
    "id": "v1.CephFSVolumeSource",
    "description": "Represents a Ceph Filesystem mount that lasts the lifetime of a pod Cephfs volumes do not support ownership management or SELinux relabeling.",
    "required": [
     "monitors"
    ],
    "properties": {
     "monitors": {
      "type": "array",
      "items": {
       "type": "string"
      },
      "description": "Required: Monitors is a collection of Ceph monitors More info: https://releases.k8s.io/HEAD/examples/volumes/cephfs/README.md#how-to-use-it"
     },
     "path": {
      "type": "string",
      "description": "Optional: Used as the mounted root, rather than the full Ceph tree, default is /"
     },
     "user": {
      "type": "string",
      "description": "Optional: User is the rados user name, default is admin More info: https://releases.k8s.io/HEAD/examples/volumes/cephfs/README.md#how-to-use-it"
     },
     "secretFile": {
      "type": "string",
      "description": "Optional: SecretFile is the path to key ring for User, default is /etc/ceph/user.secret More info: https://releases.k8s.io/HEAD/examples/volumes/cephfs/README.md#how-to-use-it"
     },
     "secretRef": {
      "$ref": "v1.LocalObjectReference",
      "description": "Optional: SecretRef is reference to the authentication secret for User, default is empty. More info: https://releases.k8s.io/HEAD/examples/volumes/cephfs/README.md#how-to-use-it"
     },
     "readOnly": {
      "type": "boolean",
      "description": "Optional: Defaults to false (read/write). ReadOnly here will force the ReadOnly setting in VolumeMounts. More info: https://releases.k8s.io/HEAD/examples/volumes/cephfs/README.md#how-to-use-it"
     }
    }
   },
   "v1.FCVolumeSource": {
    "id": "v1.FCVolumeSource",
    "description": "Represents a Fibre Channel volume. Fibre Channel volumes can only be mounted as read/write once. Fibre Channel volumes support ownership management and SELinux relabeling.",
    "required": [
     "targetWWNs",
     "lun"
    ],
    "properties": {
     "targetWWNs": {
      "type": "array",
      "items": {
       "type": "string"
      },
      "description": "Required: FC target worldwide names (WWNs)"
     },
     "lun": {
      "type": "integer",
      "format": "int32",
      "description": "Required: FC target lun number"
     },
     "fsType": {
      "type": "string",
      "description": "Filesystem type to mount. Must be a filesystem type supported by the host operating system. Ex. \"ext4\", \"xfs\", \"ntfs\". Implicitly inferred to be \"ext4\" if unspecified."
     },
     "readOnly": {
      "type": "boolean",
      "description": "Optional: Defaults to false (read/write). ReadOnly here will force the ReadOnly setting in VolumeMounts."
     }
    }
   },
   "v1.FlockerVolumeSource": {
    "id": "v1.FlockerVolumeSource",
    "description": "Represents a Flocker volume mounted by the Flocker agent. One and only one of datasetName and datasetUUID should be set. Flocker volumes do not support ownership management or SELinux relabeling.",
    "properties": {
     "datasetName": {
      "type": "string",
      "description": "Name of the dataset stored as metadata -\u003e name on the dataset for Flocker should be considered as deprecated"
     },
     "datasetUUID": {
      "type": "string",
      "description": "UUID of the dataset. This is unique identifier of a Flocker dataset"
     }
    }
   },
   "v1.FlexVolumeSource": {
    "id": "v1.FlexVolumeSource",
    "description": "FlexVolume represents a generic volume resource that is provisioned/attached using an exec based plugin. This is an alpha feature and may change in future.",
    "required": [
     "driver"
    ],
    "properties": {
     "driver": {
      "type": "string",
      "description": "Driver is the name of the driver to use for this volume."
     },
     "fsType": {
      "type": "string",
      "description": "Filesystem type to mount. Must be a filesystem type supported by the host operating system. Ex. \"ext4\", \"xfs\", \"ntfs\". The default filesystem depends on FlexVolume script."
     },
     "secretRef": {
      "$ref": "v1.LocalObjectReference",
      "description": "Optional: SecretRef is reference to the secret object containing sensitive information to pass to the plugin scripts. This may be empty if no secret object is specified. If the secret object contains more than one secret, all secrets are passed to the plugin scripts."
     },
     "readOnly": {
      "type": "boolean",
      "description": "Optional: Defaults to false (read/write). ReadOnly here will force the ReadOnly setting in VolumeMounts."
     },
     "options": {
      "type": "object",
      "description": "Optional: Extra command options if any."
     }
    }
   },
   "v1.AzureFileVolumeSource": {
    "id": "v1.AzureFileVolumeSource",
    "description": "AzureFile represents an Azure File Service mount on the host and bind mount to the pod.",
    "required": [
     "secretName",
     "shareName"
    ],
    "properties": {
     "secretName": {
      "type": "string",
      "description": "the name of secret that contains Azure Storage Account Name and Key"
     },
     "shareName": {
      "type": "string",
      "description": "Share Name"
     },
     "readOnly": {
      "type": "boolean",
      "description": "Defaults to false (read/write). ReadOnly here will force the ReadOnly setting in VolumeMounts."
     }
    }
   },
   "v1.VsphereVirtualDiskVolumeSource": {
    "id": "v1.VsphereVirtualDiskVolumeSource",
    "description": "Represents a vSphere volume resource.",
    "required": [
     "volumePath"
    ],
    "properties": {
     "volumePath": {
      "type": "string",
      "description": "Path that identifies vSphere volume vmdk"
     },
     "fsType": {
      "type": "string",
      "description": "Filesystem type to mount. Must be a filesystem type supported by the host operating system. Ex. \"ext4\", \"xfs\", \"ntfs\". Implicitly inferred to be \"ext4\" if unspecified."
     }
    }
   },
   "v1.QuobyteVolumeSource": {
    "id": "v1.QuobyteVolumeSource",
    "description": "Represents a Quobyte mount that lasts the lifetime of a pod. Quobyte volumes do not support ownership management or SELinux relabeling.",
    "required": [
     "registry",
     "volume"
    ],
    "properties": {
     "registry": {
      "type": "string",
      "description": "Registry represents a single or multiple Quobyte Registry services specified as a string as host:port pair (multiple entries are separated with commas) which acts as the central registry for volumes"
     },
     "volume": {
      "type": "string",
      "description": "Volume is a string that references an already created Quobyte volume by name."
     },
     "readOnly": {
      "type": "boolean",
      "description": "ReadOnly here will force the Quobyte volume to be mounted with read-only permissions. Defaults to false."
     },
     "user": {
      "type": "string",
      "description": "User to map volume access to Defaults to serivceaccount user"
     },
     "group": {
      "type": "string",
      "description": "Group to map volume access to Default is no group"
     }
    }
   },
   "v1.AzureDiskVolumeSource": {
    "id": "v1.AzureDiskVolumeSource",
    "description": "AzureDisk represents an Azure Data Disk mount on the host and bind mount to the pod.",
    "required": [
     "diskName",
     "diskURI"
    ],
    "properties": {
     "diskName": {
      "type": "string",
      "description": "The Name of the data disk in the blob storage"
     },
     "diskURI": {
      "type": "string",
      "description": "The URI the data disk in the blob storage"
     },
     "cachingMode": {
      "$ref": "v1.AzureDataDiskCachingMode",
      "description": "Host Caching mode: None, Read Only, Read Write."
     },
     "fsType": {
      "type": "string",
      "description": "Filesystem type to mount. Must be a filesystem type supported by the host operating system. Ex. \"ext4\", \"xfs\", \"ntfs\". Implicitly inferred to be \"ext4\" if unspecified."
     },
     "readOnly": {
      "type": "boolean",
      "description": "Defaults to false (read/write). ReadOnly here will force the ReadOnly setting in VolumeMounts."
     }
    }
   },
   "v1.AzureDataDiskCachingMode": {
    "id": "v1.AzureDataDiskCachingMode",
    "properties": {}
   },
   "v1.PhotonPersistentDiskVolumeSource": {
    "id": "v1.PhotonPersistentDiskVolumeSource",
    "description": "Represents a Photon Controller persistent disk resource.",
    "required": [
     "pdID"
    ],
    "properties": {
     "pdID": {
      "type": "string",
      "description": "ID that identifies Photon Controller persistent disk"
     },
     "fsType": {
      "type": "string",
      "description": "Filesystem type to mount. Must be a filesystem type supported by the host operating system. Ex. \"ext4\", \"xfs\", \"ntfs\". Implicitly inferred to be \"ext4\" if unspecified."
     }
    }
   },
   "v1.PortworxVolumeSource": {
    "id": "v1.PortworxVolumeSource",
    "description": "PortworxVolumeSource represents a Portworx volume resource.",
    "required": [
     "volumeID"
    ],
    "properties": {
     "volumeID": {
      "type": "string",
      "description": "VolumeID uniquely identifies a Portworx volume"
     },
     "fsType": {
      "type": "string",
      "description": "FSType represents the filesystem type to mount Must be a filesystem type supported by the host operating system. Ex. \"ext4\", \"xfs\". Implicitly inferred to be \"ext4\" if unspecified."
     },
     "readOnly": {
      "type": "boolean",
      "description": "Defaults to false (read/write). ReadOnly here will force the ReadOnly setting in VolumeMounts."
     }
    }
   },
   "v1.ScaleIOVolumeSource": {
    "id": "v1.ScaleIOVolumeSource",
    "description": "ScaleIOVolumeSource represents a persistent ScaleIO volume",
    "required": [
     "gateway",
     "system",
     "secretRef"
    ],
    "properties": {
     "gateway": {
      "type": "string",
      "description": "The host address of the ScaleIO API Gateway."
     },
     "system": {
      "type": "string",
      "description": "The name of the storage system as configured in ScaleIO."
     },
     "secretRef": {
      "$ref": "v1.LocalObjectReference",
      "description": "SecretRef references to the secret for ScaleIO user and other sensitive information. If this is not provided, Login operation will fail."
     },
     "sslEnabled": {
      "type": "boolean",
      "description": "Flag to enable/disable SSL communication with Gateway, default false"
     },
     "protectionDomain": {
      "type": "string",
      "description": "The name of the Protection Domain for the configured storage (defaults to \"default\")."
     },
     "storagePool": {
      "type": "string",
      "description": "The Storage Pool associated with the protection domain (defaults to \"default\")."
     },
     "storageMode": {
      "type": "string",
      "description": "Indicates whether the storage for a volume should be thick or thin (defaults to \"thin\")."
     },
     "volumeName": {
      "type": "string",
      "description": "The name of a volume already created in the ScaleIO system that is associated with this volume source."
     },
     "fsType": {
      "type": "string",
      "description": "Filesystem type to mount. Must be a filesystem type supported by the host operating system. Ex. \"ext4\", \"xfs\", \"ntfs\". Implicitly inferred to be \"ext4\" if unspecified."
     },
     "readOnly": {
      "type": "boolean",
      "description": "Defaults to false (read/write). ReadOnly here will force the ReadOnly setting in VolumeMounts."
     }
    }
   },
   "v1.PersistentVolumeStatus": {
    "id": "v1.PersistentVolumeStatus",
    "description": "PersistentVolumeStatus is the current status of a persistent volume.",
    "properties": {
     "phase": {
      "type": "string",
      "description": "Phase indicates if a volume is available, bound to a claim, or released by a claim. More info: https://kubernetes.io/docs/concepts/storage/persistent-volumes#phase"
     },
     "message": {
      "type": "string",
      "description": "A human-readable message indicating details about why the volume is in this state."
     },
     "reason": {
      "type": "string",
      "description": "Reason is a brief CamelCase string that describes any failure and is meant for machine parsing and tidy display in the CLI."
     }
    }
   },
   "v1.PodList": {
    "id": "v1.PodList",
    "description": "PodList is a list of Pods.",
    "required": [
     "items"
    ],
    "properties": {
     "kind": {
      "type": "string",
      "description": "Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: http://releases.k8s.io/HEAD/docs/devel/api-conventions.md#types-kinds"
     },
     "apiVersion": {
      "type": "string",
      "description": "APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: http://releases.k8s.io/HEAD/docs/devel/api-conventions.md#resources"
     },
     "metadata": {
      "$ref": "v1.ListMeta",
      "description": "Standard list metadata. More info: https://github.com/kubernetes/community/blob/master/contributors/devel/sig-architecture/api-conventions.md#types-kinds"
     },
     "items": {
      "type": "array",
      "items": {
       "$ref": "v1.Pod"
      },
      "description": "List of pods. More info: https://github.com/kubernetes/community/blob/master/contributors/devel/sig-architecture/api-conventions.md"
     }
    }
   },
   "v1.Pod": {
    "id": "v1.Pod",
    "description": "Pod is a collection of containers that can run on a host. This resource is created by clients and scheduled onto hosts.",
    "properties": {
     "kind": {
      "type": "string",
      "description": "Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: http://releases.k8s.io/HEAD/docs/devel/api-conventions.md#types-kinds"
     },
     "apiVersion": {
      "type": "string",
      "description": "APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: http://releases.k8s.io/HEAD/docs/devel/api-conventions.md#resources"
     },
     "metadata": {
      "$ref": "v1.ObjectMeta",
      "description": "Standard object's metadata. More info: https://github.com/kubernetes/community/blob/master/contributors/devel/sig-architecture/api-conventions.md#metadata"
     },
     "spec": {
      "$ref": "v1.PodSpec",
      "description": "Specification of the desired behavior of the pod. More info: https://github.com/kubernetes/community/blob/master/contributors/devel/sig-architecture/api-conventions.md#spec-and-status"
     },
     "status": {
      "$ref": "v1.PodStatus",
      "description": "Most recently observed status of the pod. This data may not be up to date. Populated by the system. Read-only. More info: https://github.com/kubernetes/community/blob/master/contributors/devel/sig-architecture/api-conventions.md#spec-and-status"
     }
    }
   },
   "v1.PodSpec": {
    "id": "v1.PodSpec",
    "description": "PodSpec is a description of a pod.",
    "required": [
     "containers"
    ],
    "properties": {
     "volumes": {
      "type": "array",
      "items": {
       "$ref": "v1.Volume"
      },
      "description": "List of volumes that can be mounted by containers belonging to the pod. More info: https://kubernetes.io/docs/concepts/storage/volumes"
     },
     "initContainers": {
      "type": "array",
      "items": {
       "$ref": "v1.Container"
      },
      "description": "List of initialization containers belonging to the pod. Init containers are executed in order prior to containers being started. If any init container fails, the pod is considered to have failed and is handled according to its restartPolicy. The name for an init container or normal container must be unique among all containers. Init containers may not have Lifecycle actions, Readiness probes, or Liveness probes. The resourceRequirements of an init container are taken into account during scheduling by finding the highest request/limit for each resource type, and then using the max of of that value or the sum of the normal containers. Limits are applied to init containers in a similar fashion. Init containers cannot currently be added or removed. Cannot be updated. More info: https://kubernetes.io/docs/concepts/workloads/pods/init-containers/"
     },
     "containers": {
      "type": "array",
      "items": {
       "$ref": "v1.Container"
      },
      "description": "List of containers belonging to the pod. Containers cannot currently be added or removed. There must be at least one container in a Pod. Cannot be updated."
     },
     "restartPolicy": {
      "type": "string",
      "description": "Restart policy for all containers within the pod. One of Always, OnFailure, Never. Default to Always. More info: https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/#restart-policy"
     },
     "terminationGracePeriodSeconds": {
      "type": "integer",
      "format": "int64",
      "description": "Optional duration in seconds the pod needs to terminate gracefully. May be decreased in delete request. Value must be non-negative integer. The value zero indicates delete immediately. If this value is nil, the default grace period will be used instead. The grace period is the duration in seconds after the processes running in the pod are sent a termination signal and the time when the processes are forcibly halted with a kill signal. Set this value longer than the expected cleanup time for your process. Defaults to 30 seconds."
     },
     "activeDeadlineSeconds": {
      "type": "integer",
      "format": "int64",
      "description": "Optional duration in seconds the pod may be active on the node relative to StartTime before the system will actively try to mark it failed and kill associated containers. Value must be a positive integer."
     },
     "dnsPolicy": {
      "type": "string",
      "description": "Set DNS policy for containers within the pod. One of 'ClusterFirstWithHostNet', 'ClusterFirst' or 'Default'. Defaults to \"ClusterFirst\". To have DNS options set along with hostNetwork, you have to specify DNS policy explicitly to 'ClusterFirstWithHostNet'."
     },
     "nodeSelector": {
      "type": "object",
      "description": "NodeSelector is a selector which must be true for the pod to fit on a node. Selector which must match a node's labels for the pod to be scheduled on that node. More info: https://kubernetes.io/docs/concepts/configuration/assign-pod-node/"
     },
     "serviceAccountName": {
      "type": "string",
      "description": "ServiceAccountName is the name of the ServiceAccount to use to run this pod. More info: https://kubernetes.io/docs/tasks/configure-pod-container/configure-service-account/"
     },
     "serviceAccount": {
      "type": "string",
      "description": "DeprecatedServiceAccount is a depreciated alias for ServiceAccountName. Deprecated: Use serviceAccountName instead."
     },
     "automountServiceAccountToken": {
      "type": "boolean",
      "description": "AutomountServiceAccountToken indicates whether a service account token should be automatically mounted."
     },
     "nodeName": {
      "type": "string",
      "description": "NodeName is a request to schedule this pod onto a specific node. If it is non-empty, the scheduler simply schedules this pod onto that node, assuming that it fits resource requirements."
     },
     "hostNetwork": {
      "type": "boolean",
      "description": "Host networking requested for this pod. Use the host's network namespace. If this option is set, the ports that will be used must be specified. Default to false."
     },
     "hostPID": {
      "type": "boolean",
      "description": "Use the host's pid namespace. Optional: Default to false."
     },
     "hostIPC": {
      "type": "boolean",
      "description": "Use the host's ipc namespace. Optional: Default to false."
     },
     "securityContext": {
      "$ref": "v1.PodSecurityContext",
      "description": "SecurityContext holds pod-level security attributes and common container settings. Optional: Defaults to empty.  See type description for default values of each field."
     },
     "imagePullSecrets": {
      "type": "array",
      "items": {
       "$ref": "v1.LocalObjectReference"
      },
      "description": "ImagePullSecrets is an optional list of references to secrets in the same namespace to use for pulling any of the images used by this PodSpec. If specified, these secrets will be passed to individual puller implementations for them to use. For example, in the case of docker, only DockerConfig type secrets are honored. More info: https://kubernetes.io/docs/concepts/containers/images#specifying-imagepullsecrets-on-a-pod"
     },
     "hostname": {
      "type": "string",
      "description": "Specifies the hostname of the Pod If not specified, the pod's hostname will be set to a system-defined value."
     },
     "subdomain": {
      "type": "string",
      "description": "If specified, the fully qualified Pod hostname will be \"\u003chostname\u003e.\u003csubdomain\u003e.\u003cpod namespace\u003e.svc.\u003ccluster domain\u003e\". If not specified, the pod will not have a domainname at all."
     },
     "affinity": {
      "$ref": "v1.Affinity",
      "description": "If specified, the pod's scheduling constraints"
     },
     "schedulerName": {
      "type": "string",
      "description": "If specified, the pod will be dispatched by specified scheduler. If not specified, the pod will be dispatched by default scheduler."
     },
     "tolerations": {
      "type": "array",
      "items": {
       "$ref": "v1.Toleration"
      },
      "description": "If specified, the pod's tolerations."
     },
     "hostMappings": {
      "type": "array",
      "items": {
       "$ref": "v1.HostAlias"
      },
      "description": "HostAliases is an optional list of hosts and IPs that will be injected into the pod's hosts file if specified. This is only valid for non-hostNetwork pods."
     }
    }
   },
   "v1.Volume": {
    "id": "v1.Volume",
    "description": "Volume represents a named volume in a pod that may be accessed by any container in the pod.",
    "required": [
     "name"
    ],
    "properties": {
     "name": {
      "type": "string",
      "description": "Volume's name. Must be a DNS_LABEL and unique within the pod. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#names"
     },
     "hostPath": {
      "$ref": "v1.HostPathVolumeSource",
      "description": "HostPath represents a pre-existing file or directory on the host machine that is directly exposed to the container. This is generally used for system agents or other privileged things that are allowed to see the host machine. Most containers will NOT need this. More info: https://kubernetes.io/docs/concepts/storage/volumes#hostpath"
     },
     "emptyDir": {
      "$ref": "v1.EmptyDirVolumeSource",
      "description": "EmptyDir represents a temporary directory that shares a pod's lifetime. More info: https://kubernetes.io/docs/concepts/storage/volumes#emptydir"
     },
     "gcePersistentDisk": {
      "$ref": "v1.GCEPersistentDiskVolumeSource",
      "description": "GCEPersistentDisk represents a GCE Disk resource that is attached to a kubelet's host machine and then exposed to the pod. More info: https://kubernetes.io/docs/concepts/storage/volumes#gcepersistentdisk"
     },
     "awsElasticBlockStore": {
      "$ref": "v1.AWSElasticBlockStoreVolumeSource",
      "description": "AWSElasticBlockStore represents an AWS Disk resource that is attached to a kubelet's host machine and then exposed to the pod. More info: https://kubernetes.io/docs/concepts/storage/volumes#awselasticblockstore"
     },
     "gitRepo": {
      "$ref": "v1.GitRepoVolumeSource",
      "description": "GitRepo represents a git repository at a particular revision. Warning: this feature is deprecated."
     },
     "secret": {
      "$ref": "v1.SecretVolumeSource",
      "description": "Secret represents a secret that should populate this volume. More info: https://kubernetes.io/docs/concepts/storage/volumes#secret"
     },
     "nfs": {
      "$ref": "v1.NFSVolumeSource",
      "description": "NFS represents an NFS mount on the host that shares a pod's lifetime More info: https://kubernetes.io/docs/concepts/storage/volumes#nfs"
     },
     "iscsi": {
      "$ref": "v1.ISCSIVolumeSource",
      "description": "ISCSI represents an ISCSI Disk resource that is attached to a kubelet's host machine and then exposed to the pod. More info: https://kubernetes.io/docs/concepts/storage/volumes/#iscsi"
     },
     "glusterfs": {
      "$ref": "v1.GlusterfsVolumeSource",
      "description": "Glusterfs represents a Glusterfs mount on the host that shares a pod's lifetime. More info: https://kubernetes.io/docs/concepts/storage/volumes/#glusterfs"
     },
     "persistentVolumeClaim": {
      "$ref": "v1.PersistentVolumeClaimVolumeSource",
      "description": "PersistentVolumeClaimVolumeSource represents a reference to a PersistentVolumeClaim in the same namespace. More info: https://kubernetes.io/docs/concepts/storage/persistent-volumes#persistentvolumeclaims"
     },
     "rbd": {
      "$ref": "v1.RBDVolumeSource",
      "description": "RBD represents a Rados Block Device mount on the host that shares a pod's lifetime. More info: https://kubernetes.io/docs/concepts/storage/volumes/#rbd"
     },
     "flexVolume": {
      "$ref": "v1.FlexVolumeSource",
      "description": "FlexVolume represents a generic volume resource that is provisioned/attached using an exec based plugin. This feature is deprecated."
     },
     "cinder": {
      "$ref": "v1.CinderVolumeSource",
      "description": "Cinder represents a cinder volume attached and mounted on kubelets host machine More info: https://releases.k8s.io/HEAD/examples/mysql-cinder-pd/README.md"
     },
     "cephfs": {
      "$ref": "v1.CephFSVolumeSource",
      "description": "CephFS represents a Ceph FS mount on the host that shares a pod's lifetime. More info: https://kubernetes.io/docs/concepts/storage/volumes/#cephfs"
     },
     "flocker": {
      "$ref": "v1.FlockerVolumeSource",
      "description": "Flocker represents a Flocker volume attached to a kubelet's host machine. This depends on the Flocker control service being running. Warning: this feature is deprecated. More info: https://kubernetes.io/docs/concepts/storage/volumes/#flocker"
     },
     "downwardAPI": {
      "$ref": "v1.DownwardAPIVolumeSource",
      "description": "DownwardAPI represents downward API about the pod that should populate this volume. More info: https://kubernetes.io/docs/concepts/storage/volumes/#downwardapi"
     },
     "fc": {
      "$ref": "v1.FCVolumeSource",
      "description": "FC represents a Fibre Channel resource that is attached to a kubelet's host machine and then exposed to the pod."
     },
     "azureFile": {
      "$ref": "v1.AzureFileVolumeSource",
      "description": "AzureFile represents an Azure File Service mount on the host and bind mount to the pod. More info: https://github.com/kubernetes/examples/blob/master/staging/volumes/azure_file/README.md"
     },
     "configMap": {
      "$ref": "v1.ConfigMapVolumeSource",
      "description": "ConfigMap represents a configMap that should populate this volume. More info: https://kubernetes.io/docs/concepts/storage/volumes/#configmap"
     },
     "vsphereVolume": {
      "$ref": "v1.VsphereVirtualDiskVolumeSource",
      "description": "VsphereVolume represents a vSphere volume attached and mounted on kubelets host machine. More info: https://kubernetes.io/docs/concepts/storage/volumes/#vspherevolume"
     },
     "quobyte": {
      "$ref": "v1.QuobyteVolumeSource",
      "description": "Quobyte represents a Quobyte mount on the host that shares a pod's lifetime. Warning: this feature is deprecated."
     },
     "azureDisk": {
      "$ref": "v1.AzureDiskVolumeSource",
      "description": "AzureDisk represents an Azure Data Disk mount on the host and bind mount to the pod. More info: https://github.com/kubernetes/examples/blob/master/staging/volumes/azure_disk/README.md"
     },
     "photonPersistentDisk": {
      "$ref": "v1.PhotonPersistentDiskVolumeSource",
      "description": "PhotonPersistentDisk represents a PhotonController persistent disk attached and mounted on kubelets host machine"
     },
     "projected": {
      "$ref": "v1.ProjectedVolumeSource",
      "description": "Items for all in one resources secrets, configmaps, and downward API"
     },
     "portworxVolume": {
      "$ref": "v1.PortworxVolumeSource",
      "description": "PortworxVolume represents a portworx volume attached and mounted on kubelets host machine"
     },
     "scaleIO": {
      "$ref": "v1.ScaleIOVolumeSource",
      "description": "ScaleIO represents a ScaleIO persistent volume attached and mounted on Kubernetes nodes."
     }
    }
   },
   "v1.EmptyDirVolumeSource": {
    "id": "v1.EmptyDirVolumeSource",
    "description": "Represents an empty directory for a pod. Empty directory volumes support ownership management and SELinux relabeling.",
    "properties": {
     "medium": {
      "type": "string",
      "description": "What type of storage medium should back this directory. The default is \"\" which means to use the node's default medium. Must be an empty string (default) or Memory. More info: https://kubernetes.io/docs/concepts/storage/volumes#emptydir"
     }
    }
   },
   "v1.GitRepoVolumeSource": {
    "id": "v1.GitRepoVolumeSource",
    "description": "Represents a volume that is populated with the contents of a git repository. Git repo volumes do not support ownership management. Git repo volumes support SELinux relabeling.",
    "required": [
     "repository"
    ],
    "properties": {
     "repository": {
      "type": "string",
      "description": "Repository URL"
     },
     "revision": {
      "type": "string",
      "description": "Commit hash for the specified revision."
     },
     "directory": {
      "type": "string",
      "description": "Target directory name. Must not contain or start with '..'.  If '.' is supplied, the volume directory will be the git repository.  Otherwise, if specified, the volume will contain the git repository in the subdirectory with the given name."
     }
    }
   },
   "v1.SecretVolumeSource": {
    "id": "v1.SecretVolumeSource",
    "description": "Adapts a Secret into a volume.\n\nThe contents of the target Secret's Data field will be presented in a volume as files using the keys in the Data field as the file names. Secret volumes support ownership management and SELinux relabeling.",
    "properties": {
     "secretName": {
      "type": "string",
      "description": "Name of the secret in the pod's namespace to use. More info: https://kubernetes.io/docs/concepts/storage/volumes#secret"
     },
     "items": {
      "type": "array",
      "items": {
       "$ref": "v1.KeyToPath"
      },
      "description": "If unspecified, each key-value pair in the Data field of the referenced Secret will be projected into the volume as a file whose name is the key and content is the value. If specified, the listed keys will be projected into the specified paths, and unlisted keys will not be present. If a key is specified which is not present in the Secret, the volume setup will error unless it is marked optional. Paths must be relative and may not contain the '..' path or start with '..'."
     },
     "defaultMode": {
      "type": "integer",
      "format": "int32",
      "description": "Optional: mode bits to use on created files by default. Must be a value between 0 and 0777. Defaults to 0644. Directories within the path are not affected by this setting. This might be in conflict with other options that affect the file mode, like fsGroup, and the result can be other mode bits set."
     },
     "optional": {
      "type": "boolean",
      "description": "Specify whether the Secret or it's keys must be defined"
     }
    }
   },
   "v1.KeyToPath": {
    "id": "v1.KeyToPath",
    "description": "Maps a string key to a path within a volume.",
    "required": [
     "key",
     "path"
    ],
    "properties": {
     "key": {
      "type": "string",
      "description": "The key to project."
     },
     "path": {
      "type": "string",
      "description": "The relative path of the file to map the key to. May not be an absolute path. May not contain the path element '..'. May not start with the string '..'."
     },
     "mode": {
      "type": "integer",
      "format": "int32",
      "description": "Optional: mode bits to use on this file, must be a value between 0 and 0777. If not specified, the volume defaultMode will be used. This might be in conflict with other options that affect the file mode, like fsGroup, and the result can be other mode bits set."
     }
    }
   },
   "v1.PersistentVolumeClaimVolumeSource": {
    "id": "v1.PersistentVolumeClaimVolumeSource",
    "description": "PersistentVolumeClaimVolumeSource references the user's PVC in the same namespace. This volume finds the bound PV and mounts that volume for the pod. A PersistentVolumeClaimVolumeSource is, essentially, a wrapper around another type of volume that is owned by someone else (the system).",
    "required": [
     "claimName"
    ],
    "properties": {
     "claimName": {
      "type": "string",
      "description": "ClaimName is the name of a PersistentVolumeClaim in the same namespace as the pod using this volume. More info: https://kubernetes.io/docs/concepts/storage/persistent-volumes#persistentvolumeclaims"
     },
     "readOnly": {
      "type": "boolean",
      "description": "Will force the ReadOnly setting in VolumeMounts. Default false."
     }
    }
   },
   "v1.DownwardAPIVolumeSource": {
    "id": "v1.DownwardAPIVolumeSource",
    "description": "DownwardAPIVolumeSource represents a volume containing downward API info. Downward API volumes support ownership management and SELinux relabeling.",
    "properties": {
     "items": {
      "type": "array",
      "items": {
       "$ref": "v1.DownwardAPIVolumeFile"
      },
      "description": "Items is a list of downward API volume file"
     },
     "defaultMode": {
      "type": "integer",
      "format": "int32",
      "description": "Optional: mode bits to use on created files by default. Must be a value between 0 and 0777. Defaults to 0644. Directories within the path are not affected by this setting. This might be in conflict with other options that affect the file mode, like fsGroup, and the result can be other mode bits set."
     }
    }
   },
   "v1.DownwardAPIVolumeFile": {
    "id": "v1.DownwardAPIVolumeFile",
    "description": "DownwardAPIVolumeFile represents information to create the file containing the pod field",
    "required": [
     "path"
    ],
    "properties": {
     "path": {
      "type": "string",
      "description": "Required: Path is  the relative path name of the file to be created. Must not be absolute or contain the '..' path. Must be utf-8 encoded. The first item of the relative path must not start with '..'"
     },
     "fieldRef": {
      "$ref": "v1.ObjectFieldSelector",
      "description": "Required: Selects a field of the pod: only annotations, labels, name and namespace are supported."
     },
     "resourceFieldRef": {
      "$ref": "v1.ResourceFieldSelector",
      "description": "Selects a resource of the container: only resources limits and requests (limits.cpu, limits.memory, requests.cpu and requests.memory) are currently supported."
     },
     "mode": {
      "type": "integer",
      "format": "int32",
      "description": "Optional: mode bits to use on this file, must be a value between 0 and 0777. If not specified, the volume defaultMode will be used. This might be in conflict with other options that affect the file mode, like fsGroup, and the result can be other mode bits set."
     }
    }
   },
   "v1.ObjectFieldSelector": {
    "id": "v1.ObjectFieldSelector",
    "description": "ObjectFieldSelector selects an APIVersioned field of an object.",
    "required": [
     "fieldPath"
    ],
    "properties": {
     "apiVersion": {
      "type": "string",
      "description": "Version of the schema the FieldPath is written in terms of, defaults to \"v1\"."
     },
     "fieldPath": {
      "type": "string",
      "description": "Path of the field to select in the specified API version."
     }
    }
   },
   "v1.ResourceFieldSelector": {
    "id": "v1.ResourceFieldSelector",
    "description": "ResourceFieldSelector represents container resources (cpu, memory) and their output format",
    "required": [
     "resource"
    ],
    "properties": {
     "containerName": {
      "type": "string",
      "description": "Container name: required for volumes, optional for env vars"
     },
     "resource": {
      "type": "string",
      "description": "Required: resource to select"
     },
     "divisor": {
      "type": "string",
      "description": "Specifies the output format of the exposed resources, defaults to \"1\""
     }
    }
   },
   "v1.ConfigMapVolumeSource": {
    "id": "v1.ConfigMapVolumeSource",
    "description": "Adapts a ConfigMap into a volume.\n\nThe contents of the target ConfigMap's Data field will be presented in a volume as files using the keys in the Data field as the file names, unless the items element is populated with specific mappings of keys to paths. ConfigMap volumes support ownership management and SELinux relabeling.",
    "properties": {
     "name": {
      "type": "string",
      "description": "Name of the referent. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#names"
     },
     "items": {
      "type": "array",
      "items": {
       "$ref": "v1.KeyToPath"
      },
      "description": "If unspecified, each key-value pair in the Data field of the referenced ConfigMap will be projected into the volume as a file whose name is the key and content is the value. If specified, the listed keys will be projected into the specified paths, and unlisted keys will not be present. If a key is specified which is not present in the ConfigMap, the volume setup will error unless it is marked optional. Paths must be relative and may not contain the '..' path or start with '..'."
     },
     "defaultMode": {
      "type": "integer",
      "format": "int32",
      "description": "Optional: mode bits to use on created files by default. Must be a value between 0 and 0777. Defaults to 0644. Directories within the path are not affected by this setting. This might be in conflict with other options that affect the file mode, like fsGroup, and the result can be other mode bits set."
     },
     "optional": {
      "type": "boolean",
      "description": "Specify whether the ConfigMap or it's keys must be defined"
     }
    }
   },
   "v1.ProjectedVolumeSource": {
    "id": "v1.ProjectedVolumeSource",
    "description": "Represents a projected volume source",
    "required": [
     "sources"
    ],
    "properties": {
     "sources": {
      "type": "array",
      "items": {
       "$ref": "v1.VolumeProjection"
      },
      "description": "list of volume projections"
     },
     "defaultMode": {
      "type": "integer",
      "format": "int32",
      "description": "Mode bits to use on created files by default. Must be a value between 0 and 0777. Directories within the path are not affected by this setting. This might be in conflict with other options that affect the file mode, like fsGroup, and the result can be other mode bits set."
     }
    }
   },
   "v1.VolumeProjection": {
    "id": "v1.VolumeProjection",
    "description": "Projection that may be projected along with other supported volume types",
    "properties": {
     "secret": {
      "$ref": "v1.SecretProjection",
      "description": "information about the secret data to project"
     },
     "downwardAPI": {
      "$ref": "v1.DownwardAPIProjection",
      "description": "information about the downwardAPI data to project"
     },
     "configMap": {
      "$ref": "v1.ConfigMapProjection",
      "description": "information about the configMap data to project"
     }
    }
   },
   "v1.SecretProjection": {
    "id": "v1.SecretProjection",
    "description": "Adapts a secret into a projected volume.\n\nThe contents of the target Secret's Data field will be presented in a projected volume as files using the keys in the Data field as the file names. Note that this is identical to a secret volume source without the default mode.",
    "properties": {
     "name": {
      "type": "string",
      "description": "Name of the referent. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#names"
     },
     "items": {
      "type": "array",
      "items": {
       "$ref": "v1.KeyToPath"
      },
      "description": "If unspecified, each key-value pair in the Data field of the referenced Secret will be projected into the volume as a file whose name is the key and content is the value. If specified, the listed keys will be projected into the specified paths, and unlisted keys will not be present. If a key is specified which is not present in the Secret, the volume setup will error unless it is marked optional. Paths must be relative and may not contain the '..' path or start with '..'."
     },
     "optional": {
      "type": "boolean",
      "description": "Specify whether the Secret or its key must be defined"
     }
    }
   },
   "v1.DownwardAPIProjection": {
    "id": "v1.DownwardAPIProjection",
    "description": "Represents downward API info for projecting into a projected volume. Note that this is identical to a downwardAPI volume source without the default mode.",
    "properties": {
     "items": {
      "type": "array",
      "items": {
       "$ref": "v1.DownwardAPIVolumeFile"
      },
      "description": "Items is a list of DownwardAPIVolume file"
     }
    }
   },
   "v1.ConfigMapProjection": {
    "id": "v1.ConfigMapProjection",
    "description": "Adapts a ConfigMap into a projected volume.\n\nThe contents of the target ConfigMap's Data field will be presented in a projected volume as files using the keys in the Data field as the file names, unless the items element is populated with specific mappings of keys to paths. Note that this is identical to a configmap volume source without the default mode.",
    "properties": {
     "name": {
      "type": "string",
      "description": "Name of the referent. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#names"
     },
     "items": {
      "type": "array",
      "items": {
       "$ref": "v1.KeyToPath"
      },
      "description": "If unspecified, each key-value pair in the Data field of the referenced ConfigMap will be projected into the volume as a file whose name is the key and content is the value. If specified, the listed keys will be projected into the specified paths, and unlisted keys will not be present. If a key is specified which is not present in the ConfigMap, the volume setup will error unless it is marked optional. Paths must be relative and may not contain the '..' path or start with '..'."
     },
     "optional": {
      "type": "boolean",
      "description": "Specify whether the ConfigMap or it's keys must be defined"
     }
    }
   },
   "v1.Container": {
    "id": "v1.Container",
    "description": "A single application container that you want to run within a pod.",
    "required": [
     "name"
    ],
    "properties": {
     "name": {
      "type": "string",
      "description": "Name of the container specified as a DNS_LABEL. Each container in a pod must have a unique name (DNS_LABEL). Cannot be updated."
     },
     "image": {
      "type": "string",
      "description": "Docker image name. More info: https://kubernetes.io/docs/concepts/containers/images"
     },
     "command": {
      "type": "array",
      "items": {
       "type": "string"
      },
      "description": "Entrypoint array. Not executed within a shell. The docker image's ENTRYPOINT is used if this is not provided. Variable references $(VAR_NAME) are expanded using the container's environment. If a variable cannot be resolved, the reference in the input string will be unchanged. The $(VAR_NAME) syntax can be escaped with a double $$, ie: $$(VAR_NAME). Escaped references will never be expanded, regardless of whether the variable exists or not. Cannot be updated. More info: https://kubernetes.io/docs/tasks/inject-data-application/define-command-argument-container/#running-a-command-in-a-shell"
     },
     "args": {
      "type": "array",
      "items": {
       "type": "string"
      },
      "description": "Arguments to the entrypoint. The docker image's CMD is used if this is not provided. Variable references $(VAR_NAME) are expanded using the container's environment. If a variable cannot be resolved, the reference in the input string will be unchanged. The $(VAR_NAME) syntax can be escaped with a double $$, ie: $$(VAR_NAME). Escaped references will never be expanded, regardless of whether the variable exists or not. Cannot be updated. More info: https://kubernetes.io/docs/tasks/inject-data-application/define-command-argument-container/#running-a-command-in-a-shell"
     },
     "workingDir": {
      "type": "string",
      "description": "Container's working directory. If not specified, the container runtime's default will be used, which might be configured in the container image. Cannot be updated."
     },
     "ports": {
      "type": "array",
      "items": {
       "$ref": "v1.ContainerPort"
      },
      "description": "List of ports to expose from the container. Exposing a port here gives the system additional information about the network connections a container uses, but is primarily informational. Not specifying a port here DOES NOT prevent that port from being exposed. Any port which is listening on the default \"0.0.0.0\" address inside a container will be accessible from the network. Cannot be updated."
     },
     "envFrom": {
      "type": "array",
      "items": {
       "$ref": "v1.EnvFromSource"
      },
      "description": "List of sources to populate environment variables in the container. The keys defined within a source must be a C_IDENTIFIER. All invalid keys will be reported as an event when the container is starting. When a key exists in multiple sources, the value associated with the last source will take precedence. Values defined by an Env with a duplicate key will take precedence. Cannot be updated."
     },
     "env": {
      "type": "array",
      "items": {
       "$ref": "v1.EnvVar"
      },
      "description": "List of environment variables to set in the container. Cannot be updated."
     },
     "resources": {
      "$ref": "v1.ResourceRequirements",
      "description": "Compute Resources required by this container. Cannot be updated. More info: https://kubernetes.io/docs/concepts/storage/persistent-volumes#resources"
     },
     "volumeMounts": {
      "type": "array",
      "items": {
       "$ref": "v1.VolumeMount"
      },
      "description": "Pod volumes to mount into the container's filesystem. Cannot be updated."
     },
     "livenessProbe": {
      "$ref": "v1.Probe",
      "description": "Periodic probe of container liveness. Container will be restarted if the probe fails. Cannot be updated. More info: https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle#container-probes"
     },
     "readinessProbe": {
      "$ref": "v1.Probe",
      "description": "Periodic probe of container service readiness. Container will be removed from service endpoints if the probe fails. Cannot be updated. More info: https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle#container-probes"
     },
     "lifecycle": {
      "$ref": "v1.Lifecycle",
      "description": "Actions that the management system should take in response to container lifecycle events. Cannot be updated."
     },
     "terminationMessagePath": {
      "type": "string",
      "description": "Optional: Path at which the file to which the container's termination message will be written is mounted into the container's filesystem. Message written is intended to be brief final status, such as an assertion failure message. Will be truncated by the node if greater than 4096 bytes. The total message length across all containers will be limited to 12kb. Defaults to /dev/termination-log. Cannot be updated."
     },
     "terminationMessagePolicy": {
      "type": "string",
      "description": "Indicate how the termination message should be populated. File will use the contents of terminationMessagePath to populate the container status message on both success and failure. FallbackToLogsOnError will use the last chunk of container log output if the termination message file is empty and the container exited with an error. The log output is limited to 2048 bytes or 80 lines, whichever is smaller. Defaults to File. Cannot be updated."
     },
     "imagePullPolicy": {
      "type": "string",
      "description": "Image pull policy. One of Always, Never, IfNotPresent. Defaults to Always if :latest tag is specified, or IfNotPresent otherwise. Cannot be updated. More info: https://kubernetes.io/docs/concepts/containers/images#updating-images"
     },
     "securityContext": {
      "$ref": "v1.SecurityContext",
      "description": "Security options the pod should run with. More info: https://kubernetes.io/docs/concepts/policy/security-context/ More info: https://github.com/kubernetes/community/blob/master/contributors/design-proposals/security_context.md"
     },
     "stdin": {
      "type": "boolean",
      "description": "Whether this container should allocate a buffer for stdin in the container runtime. If this is not set, reads from stdin in the container will always result in EOF. Default is false."
     },
     "stdinOnce": {
      "type": "boolean",
      "description": "Whether the container runtime should close the stdin channel after it has been opened by a single attach. When stdin is true the stdin stream will remain open across multiple attach sessions. If stdinOnce is set to true, stdin is opened on container start, is empty until the first client attaches to stdin, and then remains open and accepts data until the client disconnects, at which time stdin is closed and remains closed until the container is restarted. If this flag is false, a container processes that reads from stdin will never receive an EOF. Default is false"
     },
     "tty": {
      "type": "boolean",
      "description": "Whether this container should allocate a TTY for itself, also requires 'stdin' to be true. Default is false."
     }
    }
   },
   "v1.ContainerPort": {
    "id": "v1.ContainerPort",
    "description": "ContainerPort represents a network port in a single container.",
    "required": [
     "containerPort"
    ],
    "properties": {
     "name": {
      "type": "string",
      "description": "If specified, this must be an IANA_SVC_NAME and unique within the pod. Each named port in a pod must have a unique name. Name for the port that can be referred to by services."
     },
     "hostPort": {
      "type": "integer",
      "format": "int32",
      "description": "Number of port to expose on the host. If specified, this must be a valid port number, 0 \u003c x \u003c 65536. If HostNetwork is specified, this must match ContainerPort. Most containers do not need this."
     },
     "containerPort": {
      "type": "integer",
      "format": "int32",
      "description": "Number of port to expose on the pod's IP address. This must be a valid port number, 0 \u003c x \u003c 65536."
     },
     "protocol": {
      "type": "string",
      "description": "Protocol for port. Must be UDP or TCP. Defaults to \"TCP\"."
     },
     "hostIP": {
      "type": "string",
      "description": "What host IP to bind the external port to."
     }
    }
   },
   "v1.EnvFromSource": {
    "id": "v1.EnvFromSource",
    "description": "EnvFromSource represents the source of a set of ConfigMaps",
    "properties": {
     "prefix": {
      "type": "string",
      "description": "An optional identifer to prepend to each key in the ConfigMap. Must be a C_IDENTIFIER."
     },
     "configMapRef": {
      "$ref": "v1.ConfigMapEnvSource",
      "description": "The ConfigMap to select from"
     },
     "secretRef": {
      "$ref": "v1.SecretEnvSource",
      "description": "The Secret to select from"
     }
    }
   },
   "v1.ConfigMapEnvSource": {
    "id": "v1.ConfigMapEnvSource",
    "description": "ConfigMapEnvSource selects a ConfigMap to populate the environment variables with.\n\nThe contents of the target ConfigMap's Data field will represent the key-value pairs as environment variables.",
    "properties": {
     "name": {
      "type": "string",
      "description": "Name of the referent. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#names"
     },
     "optional": {
      "type": "boolean",
      "description": "Specify whether the ConfigMap must be defined"
     }
    }
   },
   "v1.SecretEnvSource": {
    "id": "v1.SecretEnvSource",
    "description": "SecretEnvSource selects a Secret to populate the environment variables with.\n\nThe contents of the target Secret's Data field will represent the key-value pairs as environment variables.",
    "properties": {
     "name": {
      "type": "string",
      "description": "Name of the referent. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#names"
     },
     "optional": {
      "type": "boolean",
      "description": "Specify whether the Secret must be defined"
     }
    }
   },
   "v1.EnvVar": {
    "id": "v1.EnvVar",
    "description": "EnvVar represents an environment variable present in a Container.",
    "required": [
     "name"
    ],
    "properties": {
     "name": {
      "type": "string",
      "description": "Name of the environment variable. Must be a C_IDENTIFIER."
     },
     "value": {
      "type": "string",
      "description": "Variable references $(VAR_NAME) are expanded using the previous defined environment variables in the container and any service environment variables. If a variable cannot be resolved, the reference in the input string will be unchanged. The $(VAR_NAME) syntax can be escaped with a double $$, ie: $$(VAR_NAME). Escaped references will never be expanded, regardless of whether the variable exists or not. Defaults to \"\"."
     },
     "valueFrom": {
      "$ref": "v1.EnvVarSource",
      "description": "Source for the environment variable's value. Cannot be used if value is not empty."
     }
    }
   },
   "v1.EnvVarSource": {
    "id": "v1.EnvVarSource",
    "description": "EnvVarSource represents a source for the value of an EnvVar.",
    "properties": {
     "fieldRef": {
      "$ref": "v1.ObjectFieldSelector",
      "description": "Selects a field of the pod: supports metadata.name, metadata.namespace, metadata.labels, metadata.annotations, spec.nodeName, spec.serviceAccountName, status.hostIP, status.podIP."
     },
     "resourceFieldRef": {
      "$ref": "v1.ResourceFieldSelector",
      "description": "Selects a resource of the container: only resources limits and requests (limits.cpu, limits.memory, requests.cpu and requests.memory) are currently supported."
     },
     "configMapKeyRef": {
      "$ref": "v1.ConfigMapKeySelector",
      "description": "Selects a key of a ConfigMap."
     },
     "secretKeyRef": {
      "$ref": "v1.SecretKeySelector",
      "description": "Selects a key of a secret in the pod's namespace"
     }
    }
   },
   "v1.ConfigMapKeySelector": {
    "id": "v1.ConfigMapKeySelector",
    "description": "Selects a key from a ConfigMap.",
    "required": [
     "key"
    ],
    "properties": {
     "name": {
      "type": "string",
      "description": "Name of the referent. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#names"
     },
     "key": {
      "type": "string",
      "description": "The key to select."
     },
     "optional": {
      "type": "boolean",
      "description": "Specify whether the ConfigMap or it's key must be defined"
     }
    }
   },
   "v1.SecretKeySelector": {
    "id": "v1.SecretKeySelector",
    "description": "SecretKeySelector selects a key of a Secret.",
    "required": [
     "key"
    ],
    "properties": {
     "name": {
      "type": "string",
      "description": "Name of the referent. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#names"
     },
     "key": {
      "type": "string",
      "description": "The key of the secret to select from.  Must be a valid secret key."
     },
     "optional": {
      "type": "boolean",
      "description": "Specify whether the Secret or it's key must be defined"
     }
    }
   },
   "v1.VolumeMount": {
    "id": "v1.VolumeMount",
    "description": "VolumeMount describes a mounting of a Volume within a container.",
    "required": [
     "name",
     "mountPath"
    ],
    "properties": {
     "name": {
      "type": "string",
      "description": "This must match the Name of a Volume."
     },
     "readOnly": {
      "type": "boolean",
      "description": "Mounted read-only if true, read-write otherwise (false or unspecified). Defaults to false."
     },
     "mountPath": {
      "type": "string",
      "description": "Path within the container at which the volume should be mounted.  Must not contain ':'."
     },
     "subPath": {
      "type": "string",
      "description": "Path within the volume from which the container's volume should be mounted. Defaults to \"\" (volume's root)."
     }
    }
   },
   "v1.Probe": {
    "id": "v1.Probe",
    "description": "Probe describes a health check to be performed against a container to determine whether it is alive or ready to receive traffic.",
    "properties": {
     "exec": {
      "$ref": "v1.ExecAction",
      "description": "One and only one of the following should be specified. Exec specifies the action to take."
     },
     "httpGet": {
      "$ref": "v1.HTTPGetAction",
      "description": "HTTPGet specifies the http request to perform."
     },
     "tcpSocket": {
      "$ref": "v1.TCPSocketAction",
      "description": "TCPSocket specifies an action involving a TCP port. TCP hooks not yet supported"
     },
     "initialDelaySeconds": {
      "type": "integer",
      "format": "int32",
      "description": "Number of seconds after the container has started before liveness probes are initiated. More info: https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle#container-probes"
     },
     "timeoutSeconds": {
      "type": "integer",
      "format": "int32",
      "description": "Number of seconds after which the probe times out. Defaults to 1 second. Minimum value is 1. More info: https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle#container-probes"
     },
     "periodSeconds": {
      "type": "integer",
      "format": "int32",
      "description": "How often (in seconds) to perform the probe. Default to 10 seconds. Minimum value is 1."
     },
     "successThreshold": {
      "type": "integer",
      "format": "int32",
      "description": "Minimum consecutive successes for the probe to be considered successful after having failed. Defaults to 1. Must be 1 for liveness. Minimum value is 1."
     },
     "failureThreshold": {
      "type": "integer",
      "format": "int32",
      "description": "Minimum consecutive failures for the probe to be considered failed after having succeeded. Defaults to 3. Minimum value is 1."
     }
    }
   },
   "v1.ExecAction": {
    "id": "v1.ExecAction",
    "description": "ExecAction describes a \"run in container\" action.",
    "properties": {
     "command": {
      "type": "array",
      "items": {
       "type": "string"
      },
      "description": "Command is the command line to execute inside the container, the working directory for the command  is root ('/') in the container's filesystem. The command is simply exec'd, it is not run inside a shell, so traditional shell instructions ('|', etc) won't work. To use a shell, you need to explicitly call out to that shell. Exit status of 0 is treated as live/healthy and non-zero is unhealthy."
     }
    }
   },
   "v1.HTTPGetAction": {
    "id": "v1.HTTPGetAction",
    "description": "HTTPGetAction describes an action based on HTTP Get requests.",
    "required": [
     "port"
    ],
    "properties": {
     "path": {
      "type": "string",
      "description": "Path to access on the HTTP server."
     },
     "port": {
      "type": "string",
      "description": "Name or number of the port to access on the container. Number must be in the range 1 to 65535. Name must be an IANA_SVC_NAME."
     },
     "host": {
      "type": "string",
      "description": "Host name to connect to, defaults to the pod IP. You probably want to set \"Host\" in httpHeaders instead."
     },
     "scheme": {
      "type": "string",
      "description": "Scheme to use for connecting to the host. Defaults to HTTP."
     },
     "httpHeaders": {
      "type": "array",
      "items": {
       "$ref": "v1.HTTPHeader"
      },
      "description": "Custom headers to set in the request. HTTP allows repeated headers."
     }
    }
   },
   "v1.HTTPHeader": {
    "id": "v1.HTTPHeader",
    "description": "HTTPHeader describes a custom header to be used in HTTP probes",
    "required": [
     "name",
     "value"
    ],
    "properties": {
     "name": {
      "type": "string",
      "description": "The header field name"
     },
     "value": {
      "type": "string",
      "description": "The header field value"
     }
    }
   },
   "v1.TCPSocketAction": {
    "id": "v1.TCPSocketAction",
    "description": "TCPSocketAction describes an action based on opening a socket",
    "required": [
     "port"
    ],
    "properties": {
     "port": {
      "type": "string",
      "description": "Number or name of the port to access on the container. Number must be in the range 1 to 65535. Name must be an IANA_SVC_NAME."
     },
     "host": {
      "type": "string",
      "description": "Optional: Host name to connect to, defaults to the pod IP."
     }
    }
   },
   "v1.Lifecycle": {
    "id": "v1.Lifecycle",
    "description": "Lifecycle describes actions that the management system should take in response to container lifecycle events. For the PostStart and PreStop lifecycle handlers, management of the container blocks until the action is complete, unless the container process fails, in which case the handler is aborted.",
    "properties": {
     "postStart": {
      "$ref": "v1.Handler",
      "description": "PostStart is called immediately after a container is created. If the handler fails, the container is terminated and restarted according to its restart policy. Other management of the container blocks until the hook completes. More info: https://kubernetes.io/docs/concepts/containers/container-lifecycle-hooks/#container-hooks"
     },
     "preStop": {
      "$ref": "v1.Handler",
      "description": "PreStop is called immediately before a container is terminated. The container is terminated after the handler completes. The reason for termination is passed to the handler. Regardless of the outcome of the handler, the container is eventually terminated. Other management of the container blocks until the hook completes. More info: https://kubernetes.io/docs/concepts/containers/container-lifecycle-hooks/#container-hooks"
     }
    }
   },
   "v1.Handler": {
    "id": "v1.Handler",
    "description": "Handler defines a specific action that should be taken",
    "properties": {
     "exec": {
      "$ref": "v1.ExecAction",
      "description": "One and only one of the following should be specified. Exec specifies the action to take."
     },
     "httpGet": {
      "$ref": "v1.HTTPGetAction",
      "description": "HTTPGet specifies the http request to perform."
     },
     "tcpSocket": {
      "$ref": "v1.TCPSocketAction",
      "description": "TCPSocket specifies an action involving a TCP port. TCP hooks not yet supported"
     }
    }
   },
   "v1.SecurityContext": {
    "id": "v1.SecurityContext",
    "description": "SecurityContext holds security configuration that will be applied to a container. Some fields are present in both SecurityContext and PodSecurityContext.  When both are set, the values in SecurityContext take precedence.",
    "properties": {
     "capabilities": {
      "$ref": "v1.Capabilities",
      "description": "The capabilities to add/drop when running containers. Defaults to the default set of capabilities granted by the container runtime."
     },
     "privileged": {
      "type": "boolean",
      "description": "Run container in privileged mode. Processes in privileged containers are essentially equivalent to root on the host. Defaults to false."
     },
     "seLinuxOptions": {
      "$ref": "v1.SELinuxOptions",
      "description": "The SELinux context to be applied to the container. If unspecified, the container runtime will allocate a random SELinux context for each container.  May also be set in PodSecurityContext.  If set in both SecurityContext and PodSecurityContext, the value specified in SecurityContext takes precedence."
     },
     "runAsUser": {
      "$ref": "types.UnixUserID",
      "description": "The UID to run the entrypoint of the container process. Defaults to user specified in image metadata if unspecified. May also be set in PodSecurityContext.  If set in both SecurityContext and PodSecurityContext, the value specified in SecurityContext takes precedence."
     },
     "runAsNonRoot": {
      "type": "boolean",
      "description": "Indicates that the container must run as a non-root user. If true, the Kubelet will validate the image at runtime to ensure that it does not run as UID 0 (root) and fail to start the container if it does. If unset or false, no such validation will be performed. May also be set in PodSecurityContext.  If set in both SecurityContext and PodSecurityContext, the value specified in SecurityContext takes precedence."
     },
     "readOnlyRootFilesystem": {
      "type": "boolean",
      "description": "Whether this container has a read-only root filesystem. Default is false."
     }
    }
   },
   "v1.Capabilities": {
    "id": "v1.Capabilities",
    "description": "Adds and removes POSIX capabilities from running containers.",
    "properties": {
     "add": {
      "type": "array",
      "items": {
       "$ref": "v1.Capability"
      },
      "description": "Added capabilities"
     },
     "drop": {
      "type": "array",
      "items": {
       "$ref": "v1.Capability"
      },
      "description": "Removed capabilities"
     }
    }
   },
   "v1.Capability": {
    "id": "v1.Capability",
    "properties": {}
   },
   "v1.SELinuxOptions": {
    "id": "v1.SELinuxOptions",
    "description": "SELinuxOptions are the labels to be applied to the container",
    "properties": {
     "user": {
      "type": "string",
      "description": "User is a SELinux user label that applies to the container."
     },
     "role": {
      "type": "string",
      "description": "Role is a SELinux role label that applies to the container."
     },
     "type": {
      "type": "string",
      "description": "Type is a SELinux type label that applies to the container."
     },
     "level": {
      "type": "string",
      "description": "Level is SELinux level label that applies to the container."
     }
    }
   },
   "types.UnixUserID": {
    "id": "types.UnixUserID",
    "properties": {}
   },
   "v1.PodSecurityContext": {
    "id": "v1.PodSecurityContext",
    "description": "PodSecurityContext holds pod-level security attributes and common container settings. Some fields are also present in container.securityContext.  Field values of container.securityContext take precedence over field values of PodSecurityContext.",
    "properties": {
     "seLinuxOptions": {
      "$ref": "v1.SELinuxOptions",
      "description": "The SELinux context to be applied to all containers. If unspecified, the container runtime will allocate a random SELinux context for each container.  May also be set in SecurityContext.  If set in both SecurityContext and PodSecurityContext, the value specified in SecurityContext takes precedence for that container."
     },
     "runAsUser": {
      "$ref": "types.UnixUserID",
      "description": "The UID to run the entrypoint of the container process. Defaults to user specified in image metadata if unspecified. May also be set in SecurityContext.  If set in both SecurityContext and PodSecurityContext, the value specified in SecurityContext takes precedence for that container."
     },
     "runAsNonRoot": {
      "type": "boolean",
      "description": "Indicates that the container must run as a non-root user. If true, the Kubelet will validate the image at runtime to ensure that it does not run as UID 0 (root) and fail to start the container if it does. If unset or false, no such validation will be performed. May also be set in SecurityContext.  If set in both SecurityContext and PodSecurityContext, the value specified in SecurityContext takes precedence."
     },
     "supplementalGroups": {
      "type": "array",
      "items": {
       "$ref": "types.UnixGroupID"
      },
      "description": "A list of groups applied to the first process run in each container, in addition to the container's primary GID.  If unspecified, no groups will be added to any container."
     },
     "fsGroup": {
      "$ref": "types.UnixGroupID",
      "description": "A special supplemental group that applies to all containers in a pod. Some volume types allow the Kubelet to change the ownership of that volume to be owned by the pod:\n\n1. The owning GID will be the FSGroup 2. The setgid bit is set (new files created in the volume will be owned by FSGroup) 3. The permission bits are OR'd with rw-rw "
     }
    }
   },
   "types.UnixGroupID": {
    "id": "types.UnixGroupID",
    "properties": {}
   },
   "v1.Affinity": {
    "id": "v1.Affinity",
    "description": "Affinity is a group of affinity scheduling rules.",
    "properties": {
     "nodeAffinity": {
      "$ref": "v1.NodeAffinity",
      "description": "Describes node affinity scheduling rules for the pod."
     },
     "podAffinity": {
      "$ref": "v1.PodAffinity",
      "description": "Describes pod affinity scheduling rules (e.g. co-locate this pod in the same node, zone, etc. as some other pod(s))."
     },
     "podAntiAffinity": {
      "$ref": "v1.PodAntiAffinity",
      "description": "Describes pod anti-affinity scheduling rules (e.g. avoid putting this pod in the same node, zone, etc. as some other pod(s))."
     }
    }
   },
   "v1.NodeAffinity": {
    "id": "v1.NodeAffinity",
    "description": "Node affinity is a group of node affinity scheduling rules.",
    "properties": {
     "requiredDuringSchedulingIgnoredDuringExecution": {
      "$ref": "v1.NodeSelector",
      "description": "If the affinity requirements specified by this field are not met at scheduling time, the pod will not be scheduled onto the node. If the affinity requirements specified by this field cease to be met at some point during pod execution (e.g. due to an update), the system may or may not try to eventually evict the pod from its node."
     },
     "preferredDuringSchedulingIgnoredDuringExecution": {
      "type": "array",
      "items": {
       "$ref": "v1.PreferredSchedulingTerm"
      },
      "description": "The scheduler will prefer to schedule pods to nodes that satisfy the affinity expressions specified by this field, but it may choose a node that violates one or more of the expressions. The node that is most preferred is the one with the greatest sum of weights, i.e. for each node that meets all of the scheduling requirements (resource request, requiredDuringScheduling affinity expressions, etc.), compute a sum by iterating through the elements of this field and adding \"weight\" to the sum if the node matches the corresponding matchExpressions; the node(s) with the highest sum are the most preferred."
     }
    }
   },
   "v1.NodeSelector": {
    "id": "v1.NodeSelector",
    "description": "A node selector represents the union of the results of one or more label queries over a set of nodes; that is, it represents the OR of the selectors represented by the node selector terms.",
    "required": [
     "nodeSelectorTerms"
    ],
    "properties": {
     "nodeSelectorTerms": {
      "type": "array",
      "items": {
       "$ref": "v1.NodeSelectorTerm"
      },
      "description": "Required. A list of node selector terms. The terms are ORed."
     }
    }
   },
   "v1.NodeSelectorTerm": {
    "id": "v1.NodeSelectorTerm",
    "description": "A null or empty node selector term matches no objects.",
    "required": [
     "matchExpressions"
    ],
    "properties": {
     "matchExpressions": {
      "type": "array",
      "items": {
       "$ref": "v1.NodeSelectorRequirement"
      },
      "description": "Required. A list of node selector requirements. The requirements are ANDed."
     }
    }
   },
   "v1.NodeSelectorRequirement": {
    "id": "v1.NodeSelectorRequirement",
    "description": "A node selector requirement is a selector that contains values, a key, and an operator that relates the key and values.",
    "required": [
     "key",
     "operator"
    ],
    "properties": {
     "key": {
      "type": "string",
      "description": "The label key that the selector applies to."
     },
     "operator": {
      "type": "string",
      "description": "Represents a key's relationship to a set of values. Valid operators are In, NotIn, Exists, DoesNotExist. Gt, and Lt."
     },
     "values": {
      "type": "array",
      "items": {
       "type": "string"
      },
      "description": "An array of string values. If the operator is In or NotIn, the values array must be non-empty. If the operator is Exists or DoesNotExist, the values array must be empty. If the operator is Gt or Lt, the values array must have a single element, which will be interpreted as an integer. This array is replaced during a strategic merge patch."
     }
    }
   },
   "v1.PreferredSchedulingTerm": {
    "id": "v1.PreferredSchedulingTerm",
    "description": "An empty preferred scheduling term matches all objects with implicit weight 0 (i.e. it's a no-op). A null preferred scheduling term matches no objects (i.e. is also a no-op).",
    "required": [
     "weight",
     "preference"
    ],
    "properties": {
     "weight": {
      "type": "integer",
      "format": "int32",
      "description": "Weight associated with matching the corresponding nodeSelectorTerm, in the range 1-100."
     },
     "preference": {
      "$ref": "v1.NodeSelectorTerm",
      "description": "A node selector term, associated with the corresponding weight."
     }
    }
   },
   "v1.PodAffinity": {
    "id": "v1.PodAffinity",
    "description": "Pod affinity is a group of inter pod affinity scheduling rules.",
    "properties": {
     "requiredDuringSchedulingIgnoredDuringExecution": {
      "type": "array",
      "items": {
       "$ref": "v1.PodAffinityTerm"
      },
      "description": "NOT YET IMPLEMENTED. TODO: Uncomment field once it is implemented. If the affinity requirements specified by this field are not met at scheduling time, the pod will not be scheduled onto the node. If the affinity requirements specified by this field cease to be met at some point during pod execution (e.g. due to a pod label update), the system will try to eventually evict the pod from its node. When there are multiple elements, the lists of nodes corresponding to each podAffinityTerm are intersected, i.e. all terms must be satisfied. RequiredDuringSchedulingRequiredDuringExecution []PodAffinityTerm  `json:\"requiredDuringSchedulingRequiredDuringExecution,omitempty\"` If the affinity requirements specified by this field are not met at scheduling time, the pod will not be scheduled onto the node. If the affinity requirements specified by this field cease to be met at some point during pod execution (e.g. due to a pod label update), the system may or may not try to eventually evict the pod from its node. When there are multiple elements, the lists of nodes corresponding to each podAffinityTerm are intersected, i.e. all terms must be satisfied."
     },
     "preferredDuringSchedulingIgnoredDuringExecution": {
      "type": "array",
      "items": {
       "$ref": "v1.WeightedPodAffinityTerm"
      },
      "description": "The scheduler will prefer to schedule pods to nodes that satisfy the affinity expressions specified by this field, but it may choose a node that violates one or more of the expressions. The node that is most preferred is the one with the greatest sum of weights, i.e. for each node that meets all of the scheduling requirements (resource request, requiredDuringScheduling affinity expressions, etc.), compute a sum by iterating through the elements of this field and adding \"weight\" to the sum if the node has pods which matches the corresponding podAffinityTerm; the node(s) with the highest sum are the most preferred."
     }
    }
   },
   "v1.PodAffinityTerm": {
    "id": "v1.PodAffinityTerm",
    "description": "Defines a set of pods (namely those matching the labelSelector relative to the given namespace(s)) that this pod should be co-located (affinity) or not co-located (anti-affinity) with, where co-located is defined as running on a node whose value of the label with key \u003ctopologyKey\u003e tches that of any node on which a pod of the set of pods is running",
    "properties": {
     "labelSelector": {
      "$ref": "v1.LabelSelector",
      "description": "A label query over a set of resources, in this case pods."
     },
     "namespaces": {
      "type": "array",
      "items": {
       "type": "string"
      },
      "description": "namespaces specifies which namespaces the labelSelector applies to (matches against); null or empty list means \"this pod's namespace\""
     },
     "topologyKey": {
      "type": "string",
      "description": "This pod should be co-located (affinity) or not co-located (anti-affinity) with the pods matching the labelSelector in the specified namespaces, where co-located is defined as running on a node whose value of the label with key topologyKey matches that of any node on which any of the selected pods is running. For PreferredDuringScheduling pod anti-affinity, empty topologyKey is interpreted as \"all topologies\" (\"all topologies\" here means all the topologyKeys indicated by scheduler command-line argument --failure-domains); for affinity and for RequiredDuringScheduling pod anti-affinity, empty topologyKey is not allowed."
     }
    }
   },
   "v1.WeightedPodAffinityTerm": {
    "id": "v1.WeightedPodAffinityTerm",
    "description": "The weights of all of the matched WeightedPodAffinityTerm fields are added per-node to find the most preferred node(s)",
    "required": [
     "weight",
     "podAffinityTerm"
    ],
    "properties": {
     "weight": {
      "type": "integer",
      "format": "int32",
      "description": "weight associated with matching the corresponding podAffinityTerm, in the range 1-100."
     },
     "podAffinityTerm": {
      "$ref": "v1.PodAffinityTerm",
      "description": "Required. A pod affinity term, associated with the corresponding weight."
     }
    }
   },
   "v1.PodAntiAffinity": {
    "id": "v1.PodAntiAffinity",
    "description": "Pod anti affinity is a group of inter pod anti affinity scheduling rules.",
    "properties": {
     "requiredDuringSchedulingIgnoredDuringExecution": {
      "type": "array",
      "items": {
       "$ref": "v1.PodAffinityTerm"
      },
      "description": "NOT YET IMPLEMENTED. TODO: Uncomment field once it is implemented. If the anti-affinity requirements specified by this field are not met at scheduling time, the pod will not be scheduled onto the node. If the anti-affinity requirements specified by this field cease to be met at some point during pod execution (e.g. due to a pod label update), the system will try to eventually evict the pod from its node. When there are multiple elements, the lists of nodes corresponding to each podAffinityTerm are intersected, i.e. all terms must be satisfied. RequiredDuringSchedulingRequiredDuringExecution []PodAffinityTerm  `json:\"requiredDuringSchedulingRequiredDuringExecution,omitempty\"` If the anti-affinity requirements specified by this field are not met at scheduling time, the pod will not be scheduled onto the node. If the anti-affinity requirements specified by this field cease to be met at some point during pod execution (e.g. due to a pod label update), the system may or may not try to eventually evict the pod from its node. When there are multiple elements, the lists of nodes corresponding to each podAffinityTerm are intersected, i.e. all terms must be satisfied."
     },
     "preferredDuringSchedulingIgnoredDuringExecution": {
      "type": "array",
      "items": {
       "$ref": "v1.WeightedPodAffinityTerm"
      },
      "description": "The scheduler will prefer to schedule pods to nodes that satisfy the anti-affinity expressions specified by this field, but it may choose a node that violates one or more of the expressions. The node that is most preferred is the one with the greatest sum of weights, i.e. for each node that meets all of the scheduling requirements (resource request, requiredDuringScheduling anti-affinity expressions, etc.), compute a sum by iterating through the elements of this field and adding \"weight\" to the sum if the node has pods which matches the corresponding podAffinityTerm; the node(s) with the highest sum are the most preferred."
     }
    }
   },
   "v1.Toleration": {
    "id": "v1.Toleration",
    "description": "The pod this Toleration is attached to tolerates any taint that matches the triple \u003ckey,value,effect\u003e using the matching operator \u003coperator\u003e.",
    "properties": {
     "key": {
      "type": "string",
      "description": "Key is the taint key that the toleration applies to. Empty means match all taint keys. If the key is empty, operator must be Exists; this combination means to match all values and all keys."
     },
     "operator": {
      "type": "string",
      "description": "Operator represents a key's relationship to the value. Valid operators are Exists and Equal. Defaults to Equal. Exists is equivalent to wildcard for value, so that a pod can tolerate all taints of a particular category."
     },
     "value": {
      "type": "string",
      "description": "Value is the taint value the toleration matches to. If the operator is Exists, the value should be empty, otherwise just a regular string."
     },
     "effect": {
      "type": "string",
      "description": "Effect indicates the taint effect to match. Empty means match all taint effects. When specified, allowed values are NoSchedule, PreferNoSchedule and NoExecute."
     },
     "tolerationSeconds": {
      "type": "integer",
      "format": "int64",
      "description": "TolerationSeconds represents the period of time the toleration (which must be of effect NoExecute, otherwise this field is ignored) tolerates the taint. By default, it is not set, which means tolerate the taint forever (do not evict). Zero and negative values will be treated as 0 (evict immediately) by the system."
     }
    }
   },
   "v1.HostAlias": {
    "id": "v1.HostAlias",
    "description": "HostAlias holds the mapping between IP and hostnames that will be injected as an entry in the pod's hosts file.",
    "properties": {
     "ip": {
      "type": "string",
      "description": "IP address of the host file entry."
     },
     "hostnames": {
      "type": "array",
      "items": {
       "type": "string"
      },
      "description": "Hostnames for the the above IP address."
     }
    }
   },
   "v1.PodStatus": {
    "id": "v1.PodStatus",
    "description": "PodStatus represents information about the status of a pod. Status may trail the actual state of a system.",
    "properties": {
     "phase": {
      "type": "string",
      "description": "Current condition of the pod. More info: https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle#pod-phase"
     },
     "conditions": {
      "type": "array",
      "items": {
       "$ref": "v1.PodCondition"
      },
      "description": "Current service state of pod. More info: https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle#pod-conditions"
     },
     "message": {
      "type": "string",
      "description": "A human readable message indicating details about why the pod is in this condition."
     },
     "reason": {
      "type": "string",
      "description": "A brief CamelCase message indicating details about why the pod is in this state. e.g. 'OutOfDisk'"
     },
     "hostIP": {
      "type": "string",
      "description": "IP address of the host to which the pod is assigned. Empty if not yet scheduled."
     },
     "podIP": {
      "type": "string",
      "description": "IP address allocated to the pod. Routable at least within the cluster. Empty if not yet allocated."
     },
     "startTime": {
      "type": "string",
      "description": "RFC 3339 date and time at which the object was acknowledged by the Kubelet. This is before the Kubelet pulled the container image(s) for the pod."
     },
     "initContainerStatuses": {
      "type": "array",
      "items": {
       "$ref": "v1.ContainerStatus"
      },
      "description": "The list has one entry per init container in the manifest. The most recent successful init container will have ready = true, the most recently started container will have startTime set. More info: https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle#pod-and-container-status"
     },
     "containerStatuses": {
      "type": "array",
      "items": {
       "$ref": "v1.ContainerStatus"
      },
      "description": "The list has one entry per container in the manifest. Each entry is currently the output of `docker inspect`. More info: https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle#pod-and-container-status"
     },
     "qosClass": {
      "type": "string",
      "description": "The Quality of Service (QOS) classification assigned to the pod based on resource requirements See PodQOSClass type for available QOS classes More info: https://github.com/kubernetes/kubernetes/blob/master/docs/design/resource-qos.md"
     }
    }
   },
   "v1.PodCondition": {
    "id": "v1.PodCondition",
    "description": "PodCondition contains details for the current condition of this pod.",
    "required": [
     "type",
     "status"
    ],
    "properties": {
     "type": {
      "type": "string",
      "description": "Type is the type of the condition. Currently only Ready. More info: https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle#pod-conditions"
     },
     "status": {
      "type": "string",
      "description": "Status is the status of the condition. Can be True, False, Unknown. More info: https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle#pod-conditions"
     },
     "lastProbeTime": {
      "type": "string",
      "description": "Last time we probed the condition."
     },
     "lastTransitionTime": {
      "type": "string",
      "description": "Last time the condition transitioned from one status to another."
     },
     "reason": {
      "type": "string",
      "description": "Unique, one-word, CamelCase reason for the condition's last transition."
     },
     "message": {
      "type": "string",
      "description": "Human-readable message indicating details about last transition."
     }
    }
   },
   "v1.ContainerStatus": {
    "id": "v1.ContainerStatus",
    "description": "ContainerStatus contains details for the current status of this container.",
    "required": [
     "name",
     "ready",
     "restartCount",
     "image",
     "imageID"
    ],
    "properties": {
     "name": {
      "type": "string",
      "description": "This must be a DNS_LABEL. Each container in a pod must have a unique name. Cannot be updated."
     },
     "state": {
      "$ref": "v1.ContainerState",
      "description": "Details about the container's current condition."
     },
     "lastState": {
      "$ref": "v1.ContainerState",
      "description": "Details about the container's last termination condition."
     },
     "ready": {
      "type": "boolean",
      "description": "Specifies whether the container has passed its readiness probe."
     },
     "restartCount": {
      "type": "integer",
      "format": "int32",
      "description": "The number of times the container has been restarted, currently based on the number of dead containers that have not yet been removed. Note that this is calculated from dead containers. But those containers are subject to garbage collection. This value will get capped at 5 by GC."
     },
     "image": {
      "type": "string",
      "description": "The image the container is running. More info: https://kubernetes.io/docs/concepts/containers/images"
     },
     "imageID": {
      "type": "string",
      "description": "ImageID of the container's image."
     },
     "containerID": {
      "type": "string",
      "description": "Container's ID in the format 'docker://\u003ccontainer_id\u003e'."
     }
    }
   },
   "v1.ContainerState": {
    "id": "v1.ContainerState",
    "description": "ContainerState holds a possible state of container. Only one of its members may be specified. If none of them is specified, the default one is ContainerStateWaiting.",
    "properties": {
     "waiting": {
      "$ref": "v1.ContainerStateWaiting",
      "description": "Details about a waiting container"
     },
     "running": {
      "$ref": "v1.ContainerStateRunning",
      "description": "Details about a running container"
     },
     "terminated": {
      "$ref": "v1.ContainerStateTerminated",
      "description": "Details about a terminated container"
     }
    }
   },
   "v1.ContainerStateWaiting": {
    "id": "v1.ContainerStateWaiting",
    "description": "ContainerStateWaiting is a waiting state of a container.",
    "properties": {
     "reason": {
      "type": "string",
      "description": "(brief) reason the container is not yet running."
     },
     "message": {
      "type": "string",
      "description": "Message regarding why the container is not yet running."
     }
    }
   },
   "v1.ContainerStateRunning": {
    "id": "v1.ContainerStateRunning",
    "description": "ContainerStateRunning is a running state of a container.",
    "properties": {
     "startedAt": {
      "type": "string",
      "description": "Time at which the container was last (re-)started"
     }
    }
   },
   "v1.ContainerStateTerminated": {
    "id": "v1.ContainerStateTerminated",
    "description": "ContainerStateTerminated is a terminated state of a container.",
    "required": [
     "exitCode"
    ],
    "properties": {
     "exitCode": {
      "type": "integer",
      "format": "int32",
      "description": "Exit status from the last termination of the container"
     },
     "signal": {
      "type": "integer",
      "format": "int32",
      "description": "Signal from the last termination of the container"
     },
     "reason": {
      "type": "string",
      "description": "(brief) reason from the last termination of the container"
     },
     "message": {
      "type": "string",
      "description": "Message regarding the last termination of the container"
     },
     "startedAt": {
      "type": "string",
      "description": "Time at which previous execution of the container started"
     },
     "finishedAt": {
      "type": "string",
      "description": "Time at which the container last terminated"
     },
     "containerID": {
      "type": "string",
      "description": "Container's ID in the format 'docker://\u003ccontainer_id\u003e'"
     }
    }
   },
   "v1beta1.Eviction": {
    "id": "v1beta1.Eviction",
    "description": "Eviction evicts a pod from its node subject to certain policies and safety constraints. This is a subresource of Pod.  A request to cause such an eviction is created by POSTing to .../pods/\u003cpod name\u003e/evictions.",
    "properties": {
     "kind": {
      "type": "string",
      "description": "Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: http://releases.k8s.io/HEAD/docs/devel/api-conventions.md#types-kinds"
     },
     "apiVersion": {
      "type": "string",
      "description": "APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: http://releases.k8s.io/HEAD/docs/devel/api-conventions.md#resources"
     },
     "metadata": {
      "$ref": "v1.ObjectMeta",
      "description": "ObjectMeta describes the pod that is being evicted."
     },
     "deleteOptions": {
      "$ref": "v1.DeleteOptions",
      "description": "DeleteOptions may be provided"
     }
    }
   },
   "v1.PodTemplateList": {
    "id": "v1.PodTemplateList",
    "description": "PodTemplateList is a list of PodTemplates.",
    "required": [
     "items"
    ],
    "properties": {
     "kind": {
      "type": "string",
      "description": "Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: http://releases.k8s.io/HEAD/docs/devel/api-conventions.md#types-kinds"
     },
     "apiVersion": {
      "type": "string",
      "description": "APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: http://releases.k8s.io/HEAD/docs/devel/api-conventions.md#resources"
     },
     "metadata": {
      "$ref": "v1.ListMeta",
      "description": "Standard list metadata. More info: https://github.com/kubernetes/community/blob/master/contributors/devel/sig-architecture/api-conventions.md#types-kinds"
     },
     "items": {
      "type": "array",
      "items": {
       "$ref": "v1.PodTemplate"
      },
      "description": "List of pod templates"
     }
    }
   },
   "v1.PodTemplate": {
    "id": "v1.PodTemplate",
    "description": "PodTemplate describes a template for creating copies of a predefined pod.",
    "properties": {
     "kind": {
      "type": "string",
      "description": "Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: http://releases.k8s.io/HEAD/docs/devel/api-conventions.md#types-kinds"
     },
     "apiVersion": {
      "type": "string",
      "description": "APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: http://releases.k8s.io/HEAD/docs/devel/api-conventions.md#resources"
     },
     "metadata": {
      "$ref": "v1.ObjectMeta",
      "description": "Standard object's metadata. More info: https://github.com/kubernetes/community/blob/master/contributors/devel/sig-architecture/api-conventions.md#metadata"
     },
     "template": {
      "$ref": "v1.PodTemplateSpec",
      "description": "Template defines the pods that will be created from this pod template. https://github.com/kubernetes/community/blob/master/contributors/devel/sig-architecture/api-conventions.md#spec-and-status"
     }
    }
   },
   "v1.PodTemplateSpec": {
    "id": "v1.PodTemplateSpec",
    "description": "PodTemplateSpec describes the data a pod should have when created from a template",
    "properties": {
     "metadata": {
      "$ref": "v1.ObjectMeta",
      "description": "Standard object's metadata. More info: https://github.com/kubernetes/community/blob/master/contributors/devel/sig-architecture/api-conventions.md#metadata"
     },
     "spec": {
      "$ref": "v1.PodSpec",
      "description": "Specification of the desired behavior of the pod. More info: https://github.com/kubernetes/community/blob/master/contributors/devel/sig-architecture/api-conventions.md#spec-and-status"
     }
    }
   },
   "v1.ReplicationControllerList": {
    "id": "v1.ReplicationControllerList",
    "description": "ReplicationControllerList is a collection of replication controllers.",
    "required": [
     "items"
    ],
    "properties": {
     "kind": {
      "type": "string",
      "description": "Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: http://releases.k8s.io/HEAD/docs/devel/api-conventions.md#types-kinds"
     },
     "apiVersion": {
      "type": "string",
      "description": "APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: http://releases.k8s.io/HEAD/docs/devel/api-conventions.md#resources"
     },
     "metadata": {
      "$ref": "v1.ListMeta",
      "description": "Standard list metadata. More info: https://github.com/kubernetes/community/blob/master/contributors/devel/sig-architecture/api-conventions.md#types-kinds"
     },
     "items": {
      "type": "array",
      "items": {
       "$ref": "v1.ReplicationController"
      },
      "description": "List of replication controllers. More info: https://kubernetes.io/docs/concepts/workloads/controllers/replicationcontroller"
     }
    }
   },
   "v1.ReplicationController": {
    "id": "v1.ReplicationController",
    "description": "ReplicationController represents the configuration of a replication controller.",
    "properties": {
     "kind": {
      "type": "string",
      "description": "Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: http://releases.k8s.io/HEAD/docs/devel/api-conventions.md#types-kinds"
     },
     "apiVersion": {
      "type": "string",
      "description": "APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: http://releases.k8s.io/HEAD/docs/devel/api-conventions.md#resources"
     },
     "metadata": {
      "$ref": "v1.ObjectMeta",
      "description": "If the Labels of a ReplicationController are empty, they are defaulted to be the same as the Pod(s) that the replication controller manages. Standard object's metadata. More info: https://github.com/kubernetes/community/blob/master/contributors/devel/sig-architecture/api-conventions.md#metadata"
     },
     "spec": {
      "$ref": "v1.ReplicationControllerSpec",
      "description": "Spec defines the specification of the desired behavior of the replication controller. More info: https://github.com/kubernetes/community/blob/master/contributors/devel/sig-architecture/api-conventions.md#spec-and-status"
     },
     "status": {
      "$ref": "v1.ReplicationControllerStatus",
      "description": "Status is the most recently observed status of the replication controller. This data may be out of date by some window of time. Populated by the system. Read-only. More info: https://github.com/kubernetes/community/blob/master/contributors/devel/sig-architecture/api-conventions.md#spec-and-status"
     }
    }
   },
   "v1.ReplicationControllerSpec": {
    "id": "v1.ReplicationControllerSpec",
    "description": "ReplicationControllerSpec is the specification of a replication controller.",
    "properties": {
     "replicas": {
      "type": "integer",
      "format": "int32",
      "description": "Replicas is the number of desired replicas. This is a pointer to distinguish between explicit zero and unspecified. Defaults to 1. More info: https://kubernetes.io/docs/concepts/workloads/controllers/replicationcontroller#what-is-a-replicationcontroller"
     },
     "minReadySeconds": {
      "type": "integer",
      "format": "int32",
      "description": "Minimum number of seconds for which a newly created pod should be ready without any of its container crashing, for it to be considered available. Defaults to 0 (pod will be considered available as soon as it is ready)"
     },
     "selector": {
      "type": "object",
      "description": "Selector is a label query over pods that should match the Replicas count. If Selector is empty, it is defaulted to the labels present on the Pod template. Label keys and values that must match in order to be controlled by this replication controller, if empty defaulted to labels on Pod template. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/labels/#label-selectors"
     },
     "template": {
      "$ref": "v1.PodTemplateSpec",
      "description": "Template is the object that describes the pod that will be created if insufficient replicas are detected. This takes precedence over a TemplateRef. More info: https://kubernetes.io/docs/concepts/workloads/controllers/replicationcontroller#pod-template"
     }
    }
   },
   "v1.ReplicationControllerStatus": {
    "id": "v1.ReplicationControllerStatus",
    "description": "ReplicationControllerStatus represents the current status of a replication controller.",
    "required": [
     "replicas"
    ],
    "properties": {
     "replicas": {
      "type": "integer",
      "format": "int32",
      "description": "Replicas is the most recently oberved number of replicas. More info: https://kubernetes.io/docs/concepts/workloads/controllers/replicationcontroller#what-is-a-replicationcontroller"
     },
     "fullyLabeledReplicas": {
      "type": "integer",
      "format": "int32",
      "description": "The number of pods that have labels matching the labels of the pod template of the replication controller."
     },
     "readyReplicas": {
      "type": "integer",
      "format": "int32",
      "description": "The number of ready replicas for this replication controller."
     },
     "availableReplicas": {
      "type": "integer",
      "format": "int32",
      "description": "The number of available replicas (ready for at least minReadySeconds) for this replication controller."
     },
     "observedGeneration": {
      "type": "integer",
      "format": "int64",
      "description": "ObservedGeneration reflects the generation of the most recently observed replication controller."
     },
     "conditions": {
      "type": "array",
      "items": {
       "$ref": "v1.ReplicationControllerCondition"
      },
      "description": "Represents the latest available observations of a replication controller's current state."
     }
    }
   },
   "v1.ReplicationControllerCondition": {
    "id": "v1.ReplicationControllerCondition",
    "description": "ReplicationControllerCondition describes the state of a replication controller at a certain point.",
    "required": [
     "type",
     "status"
    ],
    "properties": {
     "type": {
      "type": "string",
      "description": "Type of replication controller condition."
     },
     "status": {
      "type": "string",
      "description": "Status of the condition, one of True, False, Unknown."
     },
     "lastTransitionTime": {
      "type": "string",
      "description": "The last time the condition transitioned from one status to another."
     },
     "reason": {
      "type": "string",
      "description": "The reason for the condition's last transition."
     },
     "message": {
      "type": "string",
      "description": "A human readable message indicating details about the transition."
     }
    }
   },
   "v1.Scale": {
    "id": "v1.Scale",
    "description": "Scale represents a scaling request for a resource.",
    "properties": {
     "kind": {
      "type": "string",
      "description": "Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: http://releases.k8s.io/HEAD/docs/devel/api-conventions.md#types-kinds"
     },
     "apiVersion": {
      "type": "string",
      "description": "APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: http://releases.k8s.io/HEAD/docs/devel/api-conventions.md#resources"
     },
     "metadata": {
      "$ref": "v1.ObjectMeta",
      "description": "Standard object metadata; More info: http://releases.k8s.io/HEAD/docs/devel/api-conventions.md#metadata."
     },
     "spec": {
      "$ref": "v1.ScaleSpec",
      "description": "defines the behavior of the scale. More info: http://releases.k8s.io/HEAD/docs/devel/api-conventions.md#spec-and-status."
     },
     "status": {
      "$ref": "v1.ScaleStatus",
      "description": "current status of the scale. More info: http://releases.k8s.io/HEAD/docs/devel/api-conventions.md#spec-and-status. Read-only."
     }
    }
   },
   "v1.ScaleSpec": {
    "id": "v1.ScaleSpec",
    "description": "ScaleSpec describes the attributes of a scale subresource.",
    "properties": {
     "replicas": {
      "type": "integer",
      "format": "int32",
      "description": "desired number of instances for the scaled object."
     }
    }
   },
   "v1.ScaleStatus": {
    "id": "v1.ScaleStatus",
    "description": "ScaleStatus represents the current status of a scale subresource.",
    "required": [
     "replicas"
    ],
    "properties": {
     "replicas": {
      "type": "integer",
      "format": "int32",
      "description": "actual number of observed instances of the scaled object."
     },
     "selector": {
      "type": "string",
      "description": "label query over pods that should match the replicas count. This is same as the label selector but in the string format to avoid introspection by clients. The string will be in the same format as the query-param syntax. More info about label selectors: http://kubernetes.io/docs/user-guide/labels#label-selectors"
     }
    }
   },
   "v1.ResourceQuotaList": {
    "id": "v1.ResourceQuotaList",
    "description": "ResourceQuotaList is a list of ResourceQuota items.",
    "required": [
     "items"
    ],
    "properties": {
     "kind": {
      "type": "string",
      "description": "Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: http://releases.k8s.io/HEAD/docs/devel/api-conventions.md#types-kinds"
     },
     "apiVersion": {
      "type": "string",
      "description": "APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: http://releases.k8s.io/HEAD/docs/devel/api-conventions.md#resources"
     },
     "metadata": {
      "$ref": "v1.ListMeta",
      "description": "Standard list metadata. More info: https://github.com/kubernetes/community/blob/master/contributors/devel/sig-architecture/api-conventions.md#types-kinds"
     },
     "items": {
      "type": "array",
      "items": {
       "$ref": "v1.ResourceQuota"
      },
      "description": "Items is a list of ResourceQuota objects. More info: https://github.com/kubernetes/community/blob/master/contributors/design-proposals/admission_control_resource_quota.md"
     }
    }
   },
   "v1.ResourceQuota": {
    "id": "v1.ResourceQuota",
    "description": "ResourceQuota sets aggregate quota restrictions enforced per namespace",
    "properties": {
     "kind": {
      "type": "string",
      "description": "Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: http://releases.k8s.io/HEAD/docs/devel/api-conventions.md#types-kinds"
     },
     "apiVersion": {
      "type": "string",
      "description": "APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: http://releases.k8s.io/HEAD/docs/devel/api-conventions.md#resources"
     },
     "metadata": {
      "$ref": "v1.ObjectMeta",
      "description": "Standard object's metadata. More info: https://github.com/kubernetes/community/blob/master/contributors/devel/sig-architecture/api-conventions.md#metadata"
     },
     "spec": {
      "$ref": "v1.ResourceQuotaSpec",
      "description": "Spec defines the desired quota. https://github.com/kubernetes/community/blob/master/contributors/devel/sig-architecture/api-conventions.md#spec-and-status"
     },
     "status": {
      "$ref": "v1.ResourceQuotaStatus",
      "description": "Status defines the actual enforced quota and its current usage. https://github.com/kubernetes/community/blob/master/contributors/devel/sig-architecture/api-conventions.md#spec-and-status"
     }
    }
   },
   "v1.ResourceQuotaSpec": {
    "id": "v1.ResourceQuotaSpec",
    "description": "ResourceQuotaSpec defines the desired hard limits to enforce for Quota.",
    "properties": {
     "hard": {
      "type": "object",
      "description": "Hard is the set of desired hard limits for each named resource. More info: https://github.com/kubernetes/community/blob/master/contributors/design-proposals/admission_control_resource_quota.md"
     },
     "scopes": {
      "type": "array",
      "items": {
       "$ref": "v1.ResourceQuotaScope"
      },
      "description": "A collection of filters that must match each object tracked by a quota. If not specified, the quota matches all objects."
     }
    }
   },
   "v1.ResourceQuotaScope": {
    "id": "v1.ResourceQuotaScope",
    "properties": {}
   },
   "v1.ResourceQuotaStatus": {
    "id": "v1.ResourceQuotaStatus",
    "description": "ResourceQuotaStatus defines the enforced hard limits and observed use.",
    "properties": {
     "hard": {
      "type": "object",
      "description": "Hard is the set of enforced hard limits for each named resource. More info: https://github.com/kubernetes/community/blob/master/contributors/design-proposals/admission_control_resource_quota.md"
     },
     "used": {
      "type": "object",
      "description": "Used is the current observed total usage of the resource in the namespace."
     }
    }
   },
   "v1.SecretList": {
    "id": "v1.SecretList",
    "description": "SecretList is a list of Secret.",
    "required": [
     "items"
    ],
    "properties": {
     "kind": {
      "type": "string",
      "description": "Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: http://releases.k8s.io/HEAD/docs/devel/api-conventions.md#types-kinds"
     },
     "apiVersion": {
      "type": "string",
      "description": "APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: http://releases.k8s.io/HEAD/docs/devel/api-conventions.md#resources"
     },
     "metadata": {
      "$ref": "v1.ListMeta",
      "description": "Standard list metadata. More info: https://github.com/kubernetes/community/blob/master/contributors/devel/sig-architecture/api-conventions.md#types-kinds"
     },
     "items": {
      "type": "array",
      "items": {
       "$ref": "v1.Secret"
      },
      "description": "Items is a list of secret objects. More info: https://kubernetes.io/docs/concepts/configuration/secret"
     }
    }
   },
   "v1.Secret": {
    "id": "v1.Secret",
    "description": "Secret holds secret data of a certain type. The total bytes of the values in the Data field must be less than MaxSecretSize bytes.",
    "properties": {
     "kind": {
      "type": "string",
      "description": "Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: http://releases.k8s.io/HEAD/docs/devel/api-conventions.md#types-kinds"
     },
     "apiVersion": {
      "type": "string",
      "description": "APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: http://releases.k8s.io/HEAD/docs/devel/api-conventions.md#resources"
     },
     "metadata": {
      "$ref": "v1.ObjectMeta",
      "description": "Standard object's metadata. More info: https://github.com/kubernetes/community/blob/master/contributors/devel/sig-architecture/api-conventions.md#metadata"
     },
     "data": {
      "type": "object",
      "description": "Data contains the secret data. Each key must consist of alphanumeric characters, '-', '_' or '.'. The serialized form of the secret data is a base64 encoded string, representing the arbitrary (possibly non-string) data value here. Described in https://tools.ietf.org/html/rfc4648#section-4"
     },
     "stringData": {
      "type": "object",
      "description": "stringData allows specifying non-binary secret data in string form. It is provided as a write-only convenience method. All keys and values are merged into the data field on write, overwriting any existing values. It is never output when reading from the API."
     },
     "type": {
      "type": "string",
      "description": "Used to facilitate programmatic handling of secret data."
     }
    }
   },
   "v1.ServiceAccountList": {
    "id": "v1.ServiceAccountList",
    "description": "ServiceAccountList is a list of ServiceAccount objects",
    "required": [
     "items"
    ],
    "properties": {
     "kind": {
      "type": "string",
      "description": "Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: http://releases.k8s.io/HEAD/docs/devel/api-conventions.md#types-kinds"
     },
     "apiVersion": {
      "type": "string",
      "description": "APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: http://releases.k8s.io/HEAD/docs/devel/api-conventions.md#resources"
     },
     "metadata": {
      "$ref": "v1.ListMeta",
      "description": "Standard list metadata. More info: https://github.com/kubernetes/community/blob/master/contributors/devel/sig-architecture/api-conventions.md#types-kinds"
     },
     "items": {
      "type": "array",
      "items": {
       "$ref": "v1.ServiceAccount"
      },
      "description": "List of ServiceAccounts. More info: https://kubernetes.io/docs/tasks/configure-pod-container/configure-service-account/"
     }
    }
   },
   "v1.ServiceAccount": {
    "id": "v1.ServiceAccount",
    "description": "ServiceAccount binds together: * a name, understood by users, and perhaps by peripheral systems, for an identity * a principal that can be authenticated and authorized * a set of secrets",
    "properties": {
     "kind": {
      "type": "string",
      "description": "Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: http://releases.k8s.io/HEAD/docs/devel/api-conventions.md#types-kinds"
     },
     "apiVersion": {
      "type": "string",
      "description": "APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: http://releases.k8s.io/HEAD/docs/devel/api-conventions.md#resources"
     },
     "metadata": {
      "$ref": "v1.ObjectMeta",
      "description": "Standard object's metadata. More info: https://github.com/kubernetes/community/blob/master/contributors/devel/sig-architecture/api-conventions.md#metadata"
     },
     "secrets": {
      "type": "array",
      "items": {
       "$ref": "v1.ObjectReference"
      },
      "description": "Secrets is the list of secrets allowed to be used by pods running using this ServiceAccount. More info: https://kubernetes.io/docs/concepts/configuration/secret"
     },
     "imagePullSecrets": {
      "type": "array",
      "items": {
       "$ref": "v1.LocalObjectReference"
      },
      "description": "ImagePullSecrets is a list of references to secrets in the same namespace to use for pulling any images in pods that reference this ServiceAccount. ImagePullSecrets are distinct from Secrets because Secrets can be mounted in the pod, but ImagePullSecrets are only accessed by the kubelet. More info: https://kubernetes.io/docs/concepts/containers/images/#specifying-imagepullsecrets-on-a-pod"
     },
     "automountServiceAccountToken": {
      "type": "boolean",
      "description": "AutomountServiceAccountToken indicates whether pods running as this service account should have an API token automatically mounted. Can be overridden at the pod level."
     }
    }
   },
   "v1.ServiceList": {
    "id": "v1.ServiceList",
    "description": "ServiceList holds a list of services.",
    "required": [
     "items"
    ],
    "properties": {
     "kind": {
      "type": "string",
      "description": "Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: http://releases.k8s.io/HEAD/docs/devel/api-conventions.md#types-kinds"
     },
     "apiVersion": {
      "type": "string",
      "description": "APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: http://releases.k8s.io/HEAD/docs/devel/api-conventions.md#resources"
     },
     "metadata": {
      "$ref": "v1.ListMeta",
      "description": "Standard list metadata. More info: https://github.com/kubernetes/community/blob/master/contributors/devel/sig-architecture/api-conventions.md#types-kinds"
     },
     "items": {
      "type": "array",
      "items": {
       "$ref": "v1.Service"
      },
      "description": "List of services"
     }
    }
   },
   "v1.Service": {
    "id": "v1.Service",
    "description": "Service is a named abstraction of software service (for example, mysql) consisting of local port (for example 3306) that the proxy listens on, and the selector that determines which pods will answer requests sent through the proxy.",
    "properties": {
     "kind": {
      "type": "string",
      "description": "Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: http://releases.k8s.io/HEAD/docs/devel/api-conventions.md#types-kinds"
     },
     "apiVersion": {
      "type": "string",
      "description": "APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: http://releases.k8s.io/HEAD/docs/devel/api-conventions.md#resources"
     },
     "metadata": {
      "$ref": "v1.ObjectMeta",
      "description": "Standard object's metadata. More info: https://github.com/kubernetes/community/blob/master/contributors/devel/sig-architecture/api-conventions.md#metadata"
     },
     "spec": {
      "$ref": "v1.ServiceSpec",
      "description": "Spec defines the behavior of a service. https://github.com/kubernetes/community/blob/master/contributors/devel/sig-architecture/api-conventions.md#spec-and-status"
     },
     "status": {
      "$ref": "v1.ServiceStatus",
      "description": "Most recently observed status of the service. Populated by the system. Read-only. More info: https://github.com/kubernetes/community/blob/master/contributors/devel/sig-architecture/api-conventions.md#spec-and-status"
     }
    }
   },
   "v1.ServiceSpec": {
    "id": "v1.ServiceSpec",
    "description": "ServiceSpec describes the attributes that a user creates on a service.",
    "properties": {
     "ports": {
      "type": "array",
      "items": {
       "$ref": "v1.ServicePort"
      },
      "description": "The list of ports that are exposed by this service. More info: https://kubernetes.io/docs/concepts/services-networking/service/#virtual-ips-and-service-proxies"
     },
     "selector": {
      "type": "object",
      "description": "Route service traffic to pods with label keys and values matching this selector. If empty or not present, the service is assumed to have an external process managing its endpoints, which Kubernetes will not modify. Only applies to types ClusterIP, NodePort, and LoadBalancer. Ignored if type is ExternalName. More info: https://kubernetes.io/docs/concepts/services-networking/service/"
     },
     "clusterIP": {
      "type": "string",
      "description": "clusterIP is the IP address of the service and is usually assigned randomly by the master. If an address is specified manually and is not in use by others, it will be allocated to the service; otherwise, creation of the service will fail. This field can not be changed through updates. Valid values are \"None\", empty string (\"\"), or a valid IP address. \"None\" can be specified for headless services when proxying is not required. Only applies to types ClusterIP, NodePort, and LoadBalancer. Ignored if type is ExternalName. More info: https://kubernetes.io/docs/concepts/services-networking/service/#virtual-ips-and-service-proxies"
     },
     "type": {
      "type": "string",
      "description": "type determines how the Service is exposed. Defaults to ClusterIP. Valid options are ExternalName, ClusterIP, NodePort, and LoadBalancer. \"ExternalName\" maps to the specified externalName. \"ClusterIP\" allocates a cluster-internal IP address for load-balancing to endpoints. Endpoints are determined by the selector or if that is not specified, by manual construction of an Endpoints object. If clusterIP is \"None\", no virtual IP is allocated and the endpoints are published as a set of endpoints rather than a stable IP. \"NodePort\" builds on ClusterIP and allocates a port on every node which routes to the clusterIP. \"LoadBalancer\" builds on NodePort and creates an external load-balancer (if supported in the current cloud) which routes to the clusterIP. More info: https://kubernetes.io/docs/concepts/services-networking/service/#publishing-services "
     },
     "externalIPs": {
      "type": "array",
      "items": {
       "type": "string"
      },
      "description": "externalIPs is a list of IP addresses for which nodes in the cluster will also accept traffic for this service.  These IPs are not managed by Kubernetes.  The user is responsible for ensuring that traffic arrives at a node with this IP.  A common example is external load-balancers that are not part of the Kubernetes system."
     },
     "sessionAffinity": {
      "type": "string",
      "description": "Supports \"ClientIP\" and \"None\". Used to maintain session affinity. Enable client IP based session affinity. Must be ClientIP or None. Defaults to None. More info: https://kubernetes.io/docs/concepts/services-networking/service/#virtual-ips-and-service-proxies"
     },
     "loadBalancerIP": {
      "type": "string",
      "description": "Only applies to Service Type: LoadBalancer LoadBalancer will get created with the IP specified in this field. This feature depends on whether the underlying cloud-provider supports specifying the loadBalancerIP when a load balancer is created. This field will be ignored if the cloud-provider does not support the feature."
     },
     "loadBalancerSourceRanges": {
      "type": "array",
      "items": {
       "type": "string"
      },
      "description": "If specified and supported by the platform, this will restrict traffic through the cloud-provider load-balancer will be restricted to the specified client IPs. This field will be ignored if the cloud-provider does not support the feature.\" More info: https://kubernetes.io/docs/tasks/access-application-cluster/configure-cloud-provider-firewall/"
     },
     "externalName": {
      "type": "string",
      "description": "externalName is the external reference that kubedns or equivalent will return as a CNAME record for this service. No proxying will be involved. Must be a valid DNS name and requires Type to be ExternalName."
     },
     "externalTrafficPolicy": {
      "type": "string",
      "description": "externalTrafficPolicy denotes if this Service desires to route external traffic to local endpoints only. This preserves Source IP and avoids a second hop for LoadBalancer and Nodeport type services."
     },
     "healthCheckNodePort": {
      "type": "integer",
      "format": "int32",
      "description": "healthCheckNodePort specifies the healthcheck nodePort for the service. If not specified, HealthCheckNodePort is created by the service api backend with the allocated nodePort. Will use user-specified nodePort value if specified by the client. Only effects when Type is set to LoadBalancer and ExternalTrafficPolicy is set to Local."
     }
    }
   },
   "v1.ServicePort": {
    "id": "v1.ServicePort",
    "description": "ServicePort contains information on service's port.",
    "required": [
     "port"
    ],
    "properties": {
     "name": {
      "type": "string",
      "description": "The name of this port within the service. This must be a DNS_LABEL. All ports within a ServiceSpec must have unique names. This maps to the 'Name' field in EndpointPort objects. Optional if only one ServicePort is defined on this service."
     },
     "protocol": {
      "type": "string",
      "description": "The IP protocol for this port. Supports \"TCP\" and \"UDP\". Default is TCP."
     },
     "port": {
      "type": "integer",
      "format": "int32",
      "description": "The port that will be exposed by this service."
     },
     "targetPort": {
      "type": "string",
      "description": "Number or name of the port to access on the pods targeted by the service. Number must be in the range 1 to 65535. Name must be an IANA_SVC_NAME. If this is a string, it will be looked up as a named port in the target Pod's container ports. If this is not specified, the value of the 'port' field is used (an identity map). This field is ignored for services with clusterIP=None, and should be omitted or set equal to the 'port' field. More info: https://kubernetes.io/docs/concepts/services-networking/service/#defining-a-service"
     },
     "nodePort": {
      "type": "integer",
      "format": "int32",
      "description": "The port on each node on which this service is exposed when type=NodePort or LoadBalancer. Usually assigned by the system. If specified, it will be allocated to the service if unused or else creation of the service will fail. Default is to auto-allocate a port if the ServiceType of this Service requires one. More info: https://kubernetes.io/docs/concepts/services-networking/service/#type-nodeport"
     }
    }
   },
   "v1.ServiceStatus": {
    "id": "v1.ServiceStatus",
    "description": "ServiceStatus represents the current status of a service.",
    "properties": {
     "loadBalancer": {
      "$ref": "v1.LoadBalancerStatus",
      "description": "LoadBalancer contains the current status of the load-balancer, if one is present."
     }
    }
   },
   "v1.LoadBalancerStatus": {
    "id": "v1.LoadBalancerStatus",
    "description": "LoadBalancerStatus represents the status of a load-balancer.",
    "properties": {
     "ingress": {
      "type": "array",
      "items": {
       "$ref": "v1.LoadBalancerIngress"
      },
      "description": "Ingress is a list containing ingress points for the load-balancer. Traffic intended for the service should be sent to these ingress points."
     }
    }
   },
   "v1.LoadBalancerIngress": {
    "id": "v1.LoadBalancerIngress",
    "description": "LoadBalancerIngress represents the status of a load-balancer ingress point: traffic intended for the service should be sent to an ingress point.",
    "properties": {
     "ip": {
      "type": "string",
      "description": "IP is set for load-balancer ingress points that are IP based (typically GCE or OpenStack load-balancers)"
     },
     "hostname": {
      "type": "string",
      "description": "Hostname is set for load-balancer ingress points that are DNS based (typically AWS load-balancers)"
     }
    }
   },
   "v1.APIResourceList": {
    "id": "v1.APIResourceList",
    "description": "APIResourceList is a list of APIResource, it is used to expose the name of the resources supported in a specific group and version, and if the resource is namespaced.",
    "required": [
     "groupVersion",
     "resources"
    ],
    "properties": {
     "kind": {
      "type": "string",
      "description": "Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: http://releases.k8s.io/HEAD/docs/devel/api-conventions.md#types-kinds"
     },
     "apiVersion": {
      "type": "string",
      "description": "APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: http://releases.k8s.io/HEAD/docs/devel/api-conventions.md#resources"
     },
     "groupVersion": {
      "type": "string",
      "description": "groupVersion is the group and version this APIResourceList is for."
     },
     "resources": {
      "type": "array",
      "items": {
       "$ref": "v1.APIResource"
      },
      "description": "resources contains the name of the resources and if they are namespaced."
     }
    }
   },
   "v1.APIResource": {
    "id": "v1.APIResource",
    "description": "APIResource specifies the name of a resource and whether it is namespaced.",
    "required": [
     "name",
     "singularName",
     "namespaced",
     "kind",
     "verbs"
    ],
    "properties": {
     "name": {
      "type": "string",
      "description": "name is the plural name of the resource."
     },
     "singularName": {
      "type": "string",
      "description": "singularName is the singular name of the resource.  This allows clients to handle plural and singular opaquely. The singularName is more correct for reporting status on a single item and both singular and plural are allowed from the kubectl CLI interface."
     },
     "namespaced": {
      "type": "boolean",
      "description": "namespaced indicates if a resource is namespaced or not."
     },
     "kind": {
      "type": "string",
      "description": "kind is the kind for the resource (e.g. 'Foo' is the kind for a resource 'foo')"
     },
     "verbs": {
      "type": "array",
      "items": {
       "type": "string"
      },
      "description": "verbs is a list of supported kube verbs (this includes get, list, watch, create, update, patch, delete, deletecollection, and proxy)"
     },
     "shortNames": {
      "type": "array",
      "items": {
       "type": "string"
      },
      "description": "shortNames is a list of suggested short names of the resource."
     }
    }
   }
  }
 }
