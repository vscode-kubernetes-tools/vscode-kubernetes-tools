// a typed schema in JSON-schema, see document at https://spacetelescope.github.io/understanding-json-schema/about.html
export interface Typed {
    readonly type? : string;
    readonly items? : Typed;
    readonly $ref : string;
}

// get type description defined in JSON-schema
export function formatType(p : Typed): string {
    const baseType = p.type || 'object';
    if (baseType == 'array') {
        return formatType(p.items) + '[]';
    }
    return baseType;
}

// format a simple property schema into user readable description, with the style of ${name} ${type} ${description}
export function formatOne(name : string, type : string, description : string): string {
    return `**${name}** (${type})\n\n${description}`;
}

// format a complex object schema into user readable description with its own description and its properties
export function formatComplex(name : string, description : string, typeDescription : string | undefined, children : any): string {
    let ph = '';
    // we need to sort on keys when generating documents
    for (const p of Object.keys(children).sort()) {
        ph = ph + `**${p}** (${formatType(children[p])})\n\n${children[p].description}\n\n`;
    }
    let typeDescriptionPara = '';
    if (typeDescription) {
        typeDescriptionPara = `\n\n${typeDescription}`;
    }
    return `${name}: ${description}${typeDescriptionPara}\n\n${ph}`;
}
