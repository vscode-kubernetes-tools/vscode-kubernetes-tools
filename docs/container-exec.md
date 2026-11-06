# Container commands and terminals

**Kubernetes: Exec** runs a command in the selected container and keeps its output
visible in a process terminal. **Kubernetes: Terminal** also enables kubectl's
interactive stdin and TTY options (`-it`). Both use the selected pod's namespace.

Enter an executable followed by its arguments. Single and double quotes group
arguments containing spaces; `""` passes an empty argument. For example:

```text
echo "hello world"
python -c "print(123)"
"C:\Program Files\Tools\tool.exe" "C:\data\input.txt"
```

Backslashes remain literal except immediately before a double quote: pairs produce
one backslash, and an odd remaining backslash escapes the quote. Double a trailing
backslash before a closing double quote, or use single quotes to keep it literal:

```text
echo "C:\Program Files\\" next
echo '\\server\share\' next
```

Both examples keep `next` as a separate argument. Ordinary Windows/UNC separators
are preserved, and `\"` inside double quotes passes a literal quote.

Commands are passed directly to the container. The local shell does not expand
variables, substitutions, wildcards, pipelines, or redirections. `$HOME`, `%PATH%`,
and `${env:NAME}` remain literal argument values. Unquoted shell operators are
rejected to avoid interpreting a pipeline as an ordinary executable argument.

To use shell features, explicitly start a shell **inside the container** and quote
its script as one argument:

```text
sh -c 'echo "$HOME" | cat'
cmd.exe /c "echo %PATH% & dir"
```

The command-palette Terminal prompt accepts an explicit executable, including one
for a Windows or shell-less container. Opening Terminal from an Explorer pod keeps
the existing automatic bash suggestion with a sh fallback.

Cancelling a command or container picker does not launch a command. Closing the
terminal ends the local execution; completed output remains visible. Terminal
launches are owned by the kubectl instance and are cancelled when its execution
configuration changes or the extension is disposed.
