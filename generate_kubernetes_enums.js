const fs = require('fs');
const _ = require('lodash');
const download = require('download');

const COMMENT_REGEX = /(\/\*([\s\S]*?)\*\/)|(\/\/(.*)$)/gm;

function parse_protocol_buf(field) {
    const parts = field.split(' ');

    const index = _.findIndex(parts, l => l.includes('`'));
    let name = parts[0];
    let type = index === 2 ? parts[1] : '';
    const value = eval(parts.slice(index).join(' '));

    const m = /protobuf:"(.+)"/g.exec(value);
    if (!m) {
        return {field: name, type: type};
    }
    const values = m[1].split(',');
    let jsonProp;
    let jsonType;
    _.each(values, v => {
        if (v.includes('=')) {
            let cs = v.split('=');
            if (cs[0] === 'name') {
                jsonProp = cs[1].trim();
            } else if (cs[0] === 'casttype') {
                jsonType = cs[1].trim();
            }
        }
    });
    return {type: jsonType || type, name: jsonProp, field: name};
}

function parse_enum_types(types_go, swagger_json) {
    const enumTypes = [];
    const enumTypeList = {};
    const typeList = {};

    const fileData = types_go.replace(COMMENT_REGEX, '');
    const lines = _.compact(_.map(fileData.split('\n'), _.trim));
    for (let i = 0; i < lines.length; i++) {
        let l = lines[i];
        const m  = /type\s+(\w+)\s+string/g.exec(l.trim());
        if (m) {
            enumTypes.push(m[1]);
            continue;
        }
        const type =  /type\s+(\w+)\s+struct\s{/g.exec(l);
        if (type) {
            i++;
            typeList[type[1]] = [];
            while (lines[i] !== '}') {
                if (lines[i].includes('}')) {
                    throw new Error('unexpected quote' + lines[i]);
                }
                const field = parse_protocol_buf(lines[i]);
                if ((!field || !field.name) && lines[i] !== 'metav1.TypeMeta `json:",inline"`') {
                    throw new Error(`invalid line ${lines[i]}`)
                } else {
                    if (enumTypes.indexOf(field.type) >= 0) {
                       typeList[type[1]].push(field);
                    }
                }

                i++;
            }
            continue;
        }
        if (/const\s+\(/g.exec(l)) {
            i++;
            while (lines[i] !== ')') {
                if (lines[i].includes(')')) {
                    throw new Error('unexpected quote' + lines[i]);
                }
                const n = /(\w+)\s+(\w+)\s+=\s+"(\w+)"/.exec(lines[i]);
                if (n) {
                    const typeName = n[2];
                    if (typeName !== 'string') {
                        if (enumTypes.indexOf(typeName)<0)  {
                            throw new Error(`invalid type ${typeName}`);
                        }
                        if (!enumTypeList[typeName]) {
                            enumTypeList[typeName] = [n[3]];
                        } else {
                            enumTypeList[typeName].push(n[3]);
                        }
                    }

                } else {
                    // ignore
                }
                i++;
            }
        }
    }
    const json = JSON.parse(swagger_json);
    const map = {};

    _.each(Object.keys(typeList), key => {
        let t = typeList[key];
        _.each(t, field => {
            if (enumTypeList[field.type]) {
                // console.log('Got:', key, field.name, enumTypeList[field.type].join('|'))
                map[key + '!' + field.name] = {
                    enums: enumTypeList[field.type]
                }
            }
        });
    });
    let current;
    const enums = {};
    _.each(json.definitions, (definitions, key) => {
        current = key.split('.').slice(-1)[0];
        enums[key] = {};
        _.each(definitions.properties, (propValue, propKey) => {
            if (map[current + '!' + propKey]) {
                if (!propValue.enum) {
                    propValue.enum = map[current + '!' + propKey].enums;
                    enums[key][propKey] = propValue.enum;
                }
            }
        });
        if (Object.keys(enums[key]).length === 0) {
            delete enums[key];
        }
    });
    return enums;
}

function download_to_memory(_url) {
    return download(_url).then(buf => buf.toString('utf-8'));
}

function generate_kubernetes_enums(targetFile) {
    const type_go_url = 'https://raw.githubusercontent.com/kubernetes/kubernetes/master/staging/src/k8s.io/api/core/v1/types.go';
    const swagger_json_url = 'https://raw.githubusercontent.com/kubernetes/kubernetes/master/api/openapi-spec/swagger.json';
    download_to_memory(type_go_url).then(type => {
        return download_to_memory(swagger_json_url).then(swagger => {
          fs.writeFileSync(targetFile, JSON.stringify(parse_enum_types(type, swagger), null ,4));
        });
    });
}

exports.generate_kubernetes_enums = generate_kubernetes_enums;