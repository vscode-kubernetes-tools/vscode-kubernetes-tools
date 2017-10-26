export function sanitiseTag(name : string) {
    // Name components may contain lowercase letters, digits and separators.
    // A separator is defined as a period, one or two underscores, or one or
    // more dashes. A name component may not start or end with a separator.
    // https://docs.docker.com/engine/reference/commandline/tag/#extended-description

    return name.toLowerCase().replace(/[^a-z0-9._-]/g, '-');
}