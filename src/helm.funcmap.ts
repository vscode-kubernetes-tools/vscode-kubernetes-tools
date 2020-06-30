/* tslint:disable:object-literal-key-quotes */
/* tslint:disable:semicolon */

import * as vscode from 'vscode';

export class FuncMap {

    public all(): vscode.CompletionItem[] {
        return this.sprigFuncs().concat(this.builtinFuncs()).concat(this.helmFuncs());
    }

    public helmVals(): vscode.CompletionItem[] {
        return [
            this.v("Values", ".Values", `The values made available through values.yaml, --set and -f.`),
            this.v("Chart", ".Chart", "Chart metadata"),
            this.v("Files", ".Files.Get $str", "access non-template files within the chart"),
            this.v("Capabilities", ".Capabilities.KubeVersion ", "access capabilities of Kubernetes"),
            this.v("Release", ".Release", `Built-in release values. Attributes include:
- .Release.Name: Name of the release
- .Release.Time: Time release was executed
- .Release.Namespace: Namespace into which release will be placed (if not overridden)
- .Release.Service: The service that produced this release. Usually Tiller.
- .Release.IsUpgrade: True if this is an upgrade
- .Release.IsInstall: True if this is an install
- .Release.Revision: The revision number
`),
        ];
    }
    public releaseVals(): vscode.CompletionItem[] {
        return [
            this.v("Name", ".Release.Name", "Name of the release"),
            this.v("Time", ".Release.Time", "Time of the release"),
            this.v("Namespace", ".Release.Namespace", "Default namespace of the release"),
            this.v("ServiceName", ".Release.Service", "Name of the service that produced the release (almost always Tiller)"),
            this.v("IsUpgrade", ".Release.IsUpgrade", "True if this is an upgrade operation"),
            this.v("IsInstall", ".Release.IsInstall", "True if this is an install operation"),
            this.v("Revision", ".Release.Revision", "Release revision number (starts at 1)"),
        ];
    }

    public filesVals(): vscode.CompletionItem[] {
        return [
            this.f("Get", ".Files.Get $path", "Get file contents. Path is relative to chart."),
            this.f("GetBytes", ".Files.GetBytes $path", "Get file contents as a byte array. Path is relative to chart.")
        ];
    }

    public capabilitiesVals(): vscode.CompletionItem[] {
        return [
            this.v("KubeVersion", ".Capabilities.KubeVersion", "Kubernetes version"),
            this.v("TillerVersion", ".Capabilities.TillerVersion", "Tiller version"),
            this.f("ApiVersions.Has", `.Capabilities.ApiVersions.Has "batch/v1"`, "Returns true if the given Kubernetes API/version is present on the cluster")
        ];
    }

    public chartVals(): vscode.CompletionItem[] {
        return [
            this.v("Name", ".Chart.Name", "Name of the chart"),
            this.v("Version", ".Chart.Version", "Version of the chart"),
            this.v("Description", ".Chart.Description", "Chart description"),
            this.v("Keywords", ".Chart.Keywords", "A list of keywords (as strings)"),
            this.v("Home", ".Chart.Home", "The chart homepage URL"),
            this.v("Sources", ".Chart.Sources", "A list of chart download URLs"),
            this.v("Maintainers", ".Chart.Maintainers", "list of maintainer objects"),
            this.v("Icon", ".Chart.Icon", "The URL to the chart's icon file"),
            this.v("AppVersion", ".Chart.AppVersion", "The version of the main app contained in this chart"),
            this.v("Deprecated", ".Chart.Deprecated", "If true, this chart is no longer maintained"),
            this.v("TillerVersion", ".Chart.TillerVersion", "The version (range) if Tiller that this chart can run on."),
        ];
    }

    public helmFuncs(): vscode.CompletionItem[] {
        return [
            this.f("include", "include $str $ctx", "(chainable) include the named template with the given context."),
            this.f("toYaml", "toYaml $var", "convert $var to YAML"),
            this.f("toJson", "toJson $var", "convert $var to JSON"),
            this.f("toToml", "toToml $var", "convert $var to TOML"),
            this.f("fromYaml", "fromYaml $str", "parse YAML into a dict or list"),
            this.f("fromJson", "fromJson $str", "parse JSON $str into a dict or list"),
            this.f("required", "required $val", "fail template if $val is not provided or is empty"),
        ];
    }

    public builtinFuncs(): vscode.CompletionItem[] {
        return [
            this.f("template", "template $str $ctx", "render the template at location $str"),
            this.f("define", "define $str", "define a template with the name $str"),
            this.f("and", "and $a $b ...", "if $a then $b else $a"),
            this.f("call", "call $func $arg $arg2 ...", "call a $func with all $arg(s)"),
            this.f("html", "html $str", "escape $str for injection into HTML"),
            this.f("index", "index $collection $key $key2 ...", "get item out of (nested) collection"),
            this.f("js", "js $str", "encode $str for embedding in JavaScript"),
            this.f("len", "len $countable", "get the length of a $countable object (list, string, etc)"),
            this.f("not", "not $x", "negate the boolean value of $x"),
            this.f("or", "or $a $b", "if $a then $a else $b"),
            this.f("print", "print $val", "print value"),
            this.f("printf", "printf $format $val ...", "print $format, injecting values. Follows Sprintf conventions."),
            this.f("println", "println $val", "print $val followed by newline"),
            this.f("urlquery", "urlquery $val", "escape value for injecting into a URL query string"),
            this.f("ne", "ne $a $b", "returns true if $a != $b"),
            this.f("eq", "eq $a $b ...", "returns true if $a == $b (== ...)"),
            this.f("lt", "lt $a $b", "returns true if $a < $b"),
            this.f("gt", "gt $a $b", "returns true if $a > $b"),
            this.f("le", "le $a $b", "returns true if $a <= $b"),
            this.f("ge", "ge $a $b", "returns true if $a >= $b"),
        ];
    }

    public sprigFuncs(): vscode.CompletionItem[] {
        return [
            // 2.12.0
            this.f("snakecase", "snakecase $str", "Convert $str to snake_case"),
            this.f("camelcase", "camelcase $str", "convert string to camelCase"),
            this.f("shuffle", "shuffle $str", "randomize a string"),
            this.f("fail", `fail $msg`, "cause the template render to fail with a message $msg."),

            // String
            this.f("trim", "trim $str", "remove space from either side of string"),
            this.f("trimAll", "trimAll $trim $str", "remove $trim from either side of $str"),
            this.f("trimSuffix", "trimSuffix $suf $str", "trim suffix from string"),
            this.f("trimPrefix", "trimPrefix $pre $str", "trim prefix from string"),
            this.f("upper", "upper $str", "convert string to uppercase"),
            this.f("lower", "lower $str", "convert string to lowercase"),
            this.f("title", "title $str", "convert string to title case"),
            this.f("untitle", "untitle $str", "convert string from title case"),
            this.f("substr", "substr $start $len $string", "get a substring of $string, starting at $start and reading $len characters"),
            this.f("repeat", "repeat $count $str", "repeat $str $count times"),
            this.f("nospace", "nospace $str", "remove space from inside a string"),
            this.f("trunc", "trunc $max $str", "truncate $str at $max characters"),
            this.f("abbrev", "abbrev $max $str", "truncate $str with elipses at max length $max"),
            this.f("abbrevboth", "abbrevboth $left $right $str", "abbreviate both $left and $right sides of $string"),
            this.f("initials", "initials $str", "create a string of first characters of each word in $str"),
            this.f("randAscii", "randAscii", "generate a random string of ASCII characters"),
            this.f("randNumeric", "randNumeric", "generate a random string of numeric characters"),
            this.f("randAlpha", "randAlpha", "generate a random string of alphabetic ASCII characters"),
            this.f("randAlphaNum", "randAlphaNum", "generate a random string of ASCII alphabetic and numeric characters"),
            this.f("wrap", "wrap $col $str", "wrap $str text at $col columns"),
            this.f("wrapWith", "wrapWith $col $wrap $str", "wrap $str with $wrap ending each line at $col columns"),
            this.f("contains", "contains $needle $haystack", "returns true if string $needle is present in $haystack"),
            this.f("hasPrefix", "hasPrefix $pre $str", "returns true if $str begins with $pre"),
            this.f("hasSuffix", "hasSuffix $suf $str", "returns true if $str ends with $suf"),
            this.f("quote", "quote $str", "surround $str with double quotes (\")"),
            this.f("squote", "squote $str", "surround $str with single quotes (')"),
            this.f("cat", "cat $str1 $str2 ...", "concatenate all given strings into one, separated by spaces"),
            this.f("indent", "indent $count $str", "indent $str with $count space chars on the left"),
            this.f("nindent", "nindent $count $str", "indent $str with $count space chars on the left and prepend a new line to $str"),
            this.f("replace", "replace $find $replace $str", "find $find and replace with $replace"),

            // String list
            this.f("plural", "plural $singular $plural $count", "if $count is 1, return $singular, else return $plural"),
            this.f("join", "join $sep $str1 $str2 ...", "concatenate all given strings into one, separated by $sep"),
            this.f("splitList", "splitList $sep $str", "split $str into a list of strings, separating at $sep"),
            this.f("split", "split $sep $str", "split $str on $sep and store results in a dictionary"),
            this.f("sortAlpha", "sortAlpha $strings", "sort a list of strings into alphabetical order"),
            // Math
            this.f("add", "add $a $b $c", "add two or more numbers"),
            this.f("add1", "add1 $a", "increment $a by 1"),
            this.f("sub", "sub $a $b", "subtract $a from $b"),
            this.f("div", "div $a $b", "divide $b by $a"),
            this.f("mod", "mod $a $b", "modulo $b by $a"),
            this.f("mul", "mult $a $b", "multiply $b by $a"),
            this.f("max", "max $a $b ...", "return max integer"),
            this.f("min", "min $a $b ...", "return min integer"),
            // Integer list
            this.f("until", "until $count", "return a list of integers beginning with 0 and ending with $until - 1"),
            this.f("untilStep", "untilStep $start $max $step", "start with $start, and add $step until reaching $max"),
            // Date
            this.f("now", "now", "current date/time"),
            this.f("date", "date $format $date", "Format a $date with format string $format"),
            this.f("dateInZone", "date $format $date $tz", "Format $date with $format in timezone $tz"),
            this.f("dateModify", "dateModify $mod $date", "Modify $day by string $mod"),
            this.f("htmlDate", "htmlDate $date", "format $date accodring to HTML5 date format"),
            this.f("htmlDateInZone", "$htmlDate $date $tz", "format $date in $tz for HTML5 date fields"),
            // Defaults
            this.f("default", "default $default $optional", "if $optional is not set, use $default"),
            this.f("empty", "empty $val", "if $value is empty, return true. Otherwise return false"),
            this.f("coalesce", "coalesce $val1 $val2 ...", "for a list of values, return the first non-empty one"),
            this.f("ternary", "ternary $then $else $condition", "if $condition is true, return $then. Otherwise return $else"),
            // Encoding
            this.f("b64enc", "b64enc $str", "encode $str with base64 encoding"),
            this.f("b64dec", "b64dec $str", "decode $str with base64 decoder"),
            this.f("b32enc", "b32enc $str", "encode $str with base32 encoder"),
            this.f("b32dec", "b32dec $str", "decode $str with base32 decoder"),
            // Lists
            this.f("list", "list $a $b ...", "create a list from all args"),
            this.f("first", "first $list", "return the first item in a $list"),
            this.f("rest", "rest $list", "return all but the first of $list"),
            this.f("last", "last $list", "return last item in $list"),
            this.f("initial", "initial $list", "return all but last in $list"),
            this.f("append", "append $list $item", "append $item to $list"),
            this.f("prepend", "prepend $list $item", "prepend $item to $list"),
            this.f("reverse", "reverse $list", "reverse $list item order"),
            this.f("uniq", "uniq $list", "remove duplicates from list"),
            this.f("without", "without $list $item ...", "return $list with $item(s) removed"),
            this.f("has", "has $item $list", "return true if $item is in $list"),
            // Dictionaries
            this.f("dict", "dict $key $val $key2 $val2 ...", "create dictionary with $key/$val pairs"),
            this.f("set", "set $dict $key $val", "set $key=$val in $dict (mutates dict)"),
            this.f("unset", "unset $dict $key", "remove $key from $dict"),
            this.f("hasKey", "hasKey $dict $key", "returns true if $key is in $dict"),
            this.f("pluck", "pluck $key $dict1 $dict2 ...", "Get same $key from all $dict(s)"),
            this.f("merge", "merge $dest $src", "deeply merge $src into $dest"),
            this.f("keys", "keys $dict", "get list of all keys in dict. Keys are not ordered."),
            this.f("pick", "pick $dict $key1 $key2 ...", "extract $key(s) from $dict and create new dict with just those key/val pairs"),
            this.f("omit", "omit $dict $key1 $key2...", "return new dict with $key(s) removed from $dict"),
            // Type Conversion
            this.f("atoi", "atoi $str", "convert $str to integer. Zero if conversion fails."),
            this.f("float64", "float64 $val", "convert $val to float64"),
            this.f("int", "int $val", "convert $val to int"),
            this.f("int64", "int64 $val", "convert $val to int64"),
            this.f("toString", "toString $val", "convert $val to string"),
            this.f("toStrings", "toStrings $list", "convert every item in $list to string, return list of strings"),
            // File Path
            this.f("base", "base $path", "return base name (last element) of $path"),
            this.f("dir", "dir $path", "return all but base name of path (return next dir up)"),
            this.f("clean", "clean $path", "clean up the $path"),
            this.f("ext", "ext $path", "return the file extension (or empty string) of last item on $path"),
            this.f("isAbs", "isAps $path", "return true if $path is absolute"),
            // UUID
            this.f("uuidv4", "uuidv4", "generate a UUID v4 (random universally unique ID"),
            // OS
            this.f("env", "env $var", "(UNSUPPORTED IN HELM) get env var"),
            this.f("expandenv", "expandenv $str", "(UNSUPPORTED IN HELM) expand env vars in string"),
            // SemVer
            this.f("semver", "semver $version", "parse a SemVer string (1.2.3-alpha.4+1234). [Reference](http://masterminds.github.io/sprig/semver.html)"),
            this.f("semverCompare", "semverCompare $ver1 $ver2", "Compare $ver1 and $ver2. $ver1 can be a [SemVer range]((http://masterminds.github.io/sprig/semver.html)."),
            // Reflection
            this.f("kindOf", "kindOf $val", "return the Go kind (primitive type) of a value"),
            this.f("kindIs", "kindIs $kind $val", "returns true if $val is of kind $kind"),
            this.f("typeOf", "typeOf $val", "returns a string indicate the type of $val"),
            this.f("typeIs", "typeIs $type $val", "returns true if $val is of type $type"),
            this.f("typeIsLike", "typeIsLike $substr $val", "returns true if $substr is found in $val's type"),
            // Crypto
            this.f("sha1sum", "sha1sum $str", "generate a SHA-1 sum of $str"),
            this.f("sha256sum", "sha256sum $str", "generate a SHA-256 sum of $str"),
            this.f("derivePassword", "derivePassword $counter $long $pass $user $domain", "generate a password from [Master Password](http://masterpasswordapp.com/algorithm.html) spec"),
            this.f("generatePrivateKey", "generatePrivateKey 'ecdsa'", "generate private PEM key (takes dsa, rsa, or ecdsa)"),
        ];
    }

    public f(name: string, args: string, doc: string): vscode.CompletionItem {
        const i = new vscode.CompletionItem(name, vscode.CompletionItemKind.Function);
        i.detail = args;
        i.documentation = doc;
        return i;
    }

    public v(name: string, use: string, doc: string): vscode.CompletionItem {
        const i = new vscode.CompletionItem(name, vscode.CompletionItemKind.Constant);
        i.detail = use;
        i.documentation = doc;
        return i;
    }
}
