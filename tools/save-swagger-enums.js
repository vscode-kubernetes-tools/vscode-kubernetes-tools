const fs = require('fs');
const download = require('download');
const _ = require('lodash');

const LATEST_SWAGGER_URL = 'https://raw.githubusercontent.com/kubernetes/kubernetes/master/api/openapi-spec/swagger.json';  // TODO: master is not necessarily stable
const LATEST_API_TYPES_GO_URL = 'https://raw.githubusercontent.com/kubernetes/kubernetes/master/staging/src/k8s.io/api/core/v1/types.go';

const ENUMS_FILE = './schema/schema_enums.json';

const GO_COMMENT_REGEX = /(\/\*([\s\S]*?)\*\/)|(\/\/(.*)$)/m;
const GO_STRING_ALIAS_REGEX = /type\s+(\w+)\s+string/;
const GO_STRUCT_DECL_REGEX = /type\s+(\w+)\s+struct\s{/;
const GO_CONSTS_DECL_REGEX = /const\s+\(/;

// goTypes[Full] is a Go source file ith declarations such as:
//
// type PersistentVolumeClaimVolumeSource struct {
//     ClaimName string `json:"claimName" protobuf:"bytes,1,opt,name=claimName"`
//     ReadOnly bool `json:"readOnly,omitempty" protobuf:"varint,2,opt,name=readOnly"`
// }
//
// We are interested in constructs such as the following:
//
// type AzureDataDiskCachingMode string
// type AzureDataDiskKind string

// const (
//     AzureDataDiskCachingNone      AzureDataDiskCachingMode = "None"
//     AzureDataDiskCachingReadOnly  AzureDataDiskCachingMode = "ReadOnly"
//     AzureDataDiskCachingReadWrite AzureDataDiskCachingMode = "ReadWrite"

//     AzureSharedBlobDisk    AzureDataDiskKind = "Shared"
//     AzureDedicatedBlobDisk AzureDataDiskKind = "Dedicated"
//     AzureManagedDisk       AzureDataDiskKind = "Managed"
// )

// type AzureDiskVolumeSource struct {
//     CachingMode *AzureDataDiskCachingMode `json:"cachingMode,omitempty" protobuf:"bytes,3,opt,name=cachingMode,casttype=AzureDataDiskCachingMode"`
//     Kind *AzureDataDiskKind `json:"kind,omitempty" protobuf:"bytes,6,opt,name=kind,casttype=AzureDataDiskKind"`
// }
//
// Note the `... protobuf:"...casttype=SOMETHING"` - this is our sign of an enum.  We can then
// chase the SOMETHING to consts of the form VALUE_NAME SOMETHING = "VALUE".  For each of these,
// VALUE is a legitimate value of the enum.

function captureEnumValues(goTypesFull, swagger) {
    const goTypes = goTypesFull.replace(GO_COMMENT_REGEX, '');
    const goLines = goTypes.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    return captureEnumValuesFrom(goLines, swagger);
}

function captureEnumValuesFrom(goLines, swaggerText) {
    const possibleEnumTypes = [];
    const enumValues = {};
    const structEnumFields = {};

    for (const cb of toCodeBlocks(goLines)) {
        switch (cb.blockType) {
            case 'possible-enum':
                const aliasName = (GO_STRING_ALIAS_REGEX.exec(cb.content[0]))[1];
                possibleEnumTypes.push(aliasName);
                enumValues[aliasName] = [];
                break;
            case 'struct':
                const structName = (GO_STRUCT_DECL_REGEX.exec(cb.content[0]))[1];
                structEnumFields[structName] = parseEnumFields(cb.content, possibleEnumTypes);
                break;
            case 'consts':
                parseEnumValues(cb.content, enumValues);
                break;
        }
    }

    const flattenedMap = keyByStructNameAndFieldSchemaName(structEnumFields, enumValues);

    const enums = associateEnumValuesToSwaggerTypesAndProperties(swaggerText, flattenedMap);

    return enums;
}

function keyByStructNameAndFieldSchemaName(structEnumFields, enumValues) {
    const flattenedMap = {};

    for (const structName of Object.keys(structEnumFields)) {
        const enumFields = structEnumFields[structName];
        for (const field of enumFields) {
            if (isFieldOfEnumType(field, enumValues)) {
                flattenedMap[flatKeyOf(structName, field.schemaName)] = {
                    enums: enumValues[field.type]
                };
            }
        }
    }

    return flattenedMap;
}

function flatKeyOf(structName, fieldSchemaName) {
    return `${structName}!${fieldSchemaName}`;
}

function isFieldOfEnumType(field, enumValues) {
    return enumValues[field.type] && enumValues[field.type].length > 0;
}

function associateEnumValuesToSwaggerTypesAndProperties(swaggerText, map) {
    const swaggerObj = JSON.parse(swaggerText);

    // The following map will eventually be of the form:
    //
    // {
    //   "io.k8s.api.core.v1.Widget": {  // k8s schema type name
    //     "foo": [                      // property name that should be enum but isn't in the Swagger
    //       "None",                     // permitted values of the property
    //       "ReadOnly",
    //       "ReadWrite"
    //     ],
    //     "bar": [                      // another property within the same type
    //       "Shared",
    //       "Dedicated"
    //     ]
    //   },
    //   "io.k8s.api.core.v1.Gadget": {  // and now another type
    //     "status": [
    //       "True",
    //       "False"
    //     ]
    //   }...
    //
    // This is our destination JSON format which the YAML schematiser will munge with the cluster's
    // Swagger document to produce an enumified Swagger document.

    const enums = {};

    _.each(swaggerObj.definitions, (definitions, qualifiedTypeName) => {
        const shortTypeName = qualifiedTypeName.split('.').slice(-1)[0];
        enums[qualifiedTypeName] = {};
        _.each(definitions.properties, (propertySchema, propertyName) => {
            propertyKey = flatKeyOf(shortTypeName, propertyName);
            if (map[propertyKey]) {
                if (!propertySchema.enum) {
                    propertySchema.enum = map[propertyKey].enums;
                    enums[qualifiedTypeName][propertyName] = propertySchema.enum;
                }
            }
        });
        if (Object.keys(enums[qualifiedTypeName]).length === 0) {
            delete enums[qualifiedTypeName];
        }
    });

    return enums;
}

function* toCodeBlocks(goLines) {
    for (let i = 0; i < goLines.length; ++i) {
        const line = goLines[i];

        if (isPossibleEnumType(line)) {
            yield { blockType: 'possible-enum', content: [line] };
            continue;
        }

        if (isStructStart(line)) {
            const { endIndex, content } = readToStructEnd(goLines, i);
            i = endIndex;
            yield { blockType: 'struct', content };
            continue;
        }

        if (isConstBlockStart(line)) {
            const { endIndex, content } = readToConstBlockEnd(goLines, i);
            i = endIndex;
            yield { blockType: 'consts', content };
            continue;
        }
    }
}

function isPossibleEnumType(goLine) {
    const m = GO_STRING_ALIAS_REGEX.exec(goLine.trim());
    if (m && m.length > 1) {
        return true;
    }
    return false;
}

function isStructStart(goLine) {
    return GO_STRUCT_DECL_REGEX.test(goLine);
}

function isConstBlockStart(goLine) {
    return GO_CONSTS_DECL_REGEX.test(goLine);
}

function readToStructEnd(goLines, startIndex) {
    const content = [];
    for (let i = startIndex; i < goLines.length; ++i) {
        const line = goLines[i];
        content.push(line);
        if (line === '}') {
            return { endIndex: i, content };
        }
    }
    return { endIndex: 9999999, content };  // TODO: less ugly
}

// TODO: deduplicate
function readToConstBlockEnd(goLines, startIndex) {
    const content = [];
    for (let i = startIndex; i < goLines.length; ++i) {
        const line = goLines[i];
        content.push(line);
        if (line === ')') {
            return { endIndex: i, content };
        }
    }
    return { endIndex: 9999999, content };  // TODO: less ugly
}

function parseEnumFields(structLines, knownEnumTypes) {
    const enumFields = [];
    for (const line of structLines.slice(1, structLines.length - 1)) {
        if (line.indexOf('metav1.TypeMeta') >= 0) {
            continue;
        }
        const field = parseFieldInfo(line);
        if (knownEnumTypes.indexOf(field.type) >= 0) {
            enumFields.push(field);
        }
    }
    return enumFields;
}

function parseFieldInfo(structLine) {
    const bits = structLine.split(' ').filter((s) => s && s.length > 0);  // [ NAME, *TYPE, `ATTR1, ATTR2 ... ATTRn` ]
    const firstAttrIndex = bits.findIndex((s) => s.startsWith('`'));
    const fieldName = bits[0];
    const fieldType = firstAttrIndex === 2 ? bits[1] : undefined;
    const attrsQ = structLine.substring(structLine.indexOf('`')).trim();
    const attrs = attrsQ.substr(1, attrsQ.length - 2);
    const attrBits = attrs.split(' ');
    const protobufAttr = attrBits.find((s) => s.startsWith('protobuf:'));
    if (!protobufAttr) {
        return { fieldName, schemaName: undefined, type: fieldType };
    }
    const protobufValueQ = protobufAttr.substring(protobufAttr.indexOf(':') + 1);  // of the form '"bytes,6,opt,name=kind,casttype=AzureDataDiskKind"' (note the double quotes!)
    const protobufValue = protobufValueQ.substr(1, protobufValueQ.length - 2);
    const pbBits = protobufValue.split(',');
    const schemaName = getProtobufMetadata(pbBits, 'name');
    const schemaType = getProtobufMetadata(pbBits, 'casttype');
    return {
        fieldName,
        schemaName,
        type: schemaType || fieldType
    };
}

function getProtobufMetadata(pbBits, key) {
    const prefix = `${key}=`;
    const bit = pbBits.find((s) => s.startsWith(prefix));
    if (!bit) {
        return undefined;
    }
    const value = bit.substring(prefix.length);
    return value;
}

const GO_ENUM_VALUE_CONST_REGEX = /(\w+)\s+(\w+)\s+=\s+"(\w+)"/;

function parseEnumValues(constsLines, enumValues) {
    for (const line of constsLines.slice(1, constsLines.length - 2)) {
        // of the form 'AzureSharedBlobDisk    AzureDataDiskKind = "Shared"'
        const bits = GO_ENUM_VALUE_CONST_REGEX.exec(line);
        if (!bits || bits.length < 4) {
            continue;
        }
        const typeName = bits[2];
        const enumValue = bits[3];
        if (typeName === 'string') {
            continue;
        }
        enumValues[typeName].push(enumValue);
    }
}

function downloadToMemory(url) {
    return download(url).then(buf => buf.toString('utf-8'));
}

function saveSwaggerEnumsFrom(goTypes, swagger) {
    const enumTypes = captureEnumValues(goTypes, swagger);
    const enumTypesJSONText = JSON.stringify(enumTypes, null, 2);
    fs.writeFileSync(ENUMS_FILE, enumTypesJSONText);
}

function saveSwaggerEnums() {
    return downloadToMemory(LATEST_API_TYPES_GO_URL).then(
        (goTypes) => downloadToMemory(LATEST_SWAGGER_URL).then(
            (swagger) => saveSwaggerEnumsFrom(goTypes, swagger)
        )
    );
}

console.log('Saving all the things...');
saveSwaggerEnums().then(() => {
    console.log('Saved');
});
