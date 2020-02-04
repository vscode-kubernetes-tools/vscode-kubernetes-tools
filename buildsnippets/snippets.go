package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

// Snippet represents a VS Code snippet.
type Snippet struct {
	Prefix      string   `json:"prefix"`
	Body        []string `json:"body"`
	Description string   `json:"description"`
}

var snippets = map[string]Snippet{
	"Secret": {
		Prefix:      "kindSecret",
		Body:        load("secret.yaml"),
		Description: "Create a Secret manifest",
	},
	"Pod": {
		Prefix:      "kindPod",
		Description: "Create a Pod manifest",
		Body:        load("pod.yaml"),
	},
	"ConfigMap": {
		Prefix:      "kindConfigMap",
		Description: "Create a ConfigMap manifest",
		Body:        load("configmap.yaml"),
	},
	"Deployment": {
		Prefix:      "kindDeployment",
		Description: "Create a Deployment manifest",
		Body:        load("deployment.yaml"),
	},
	"Service": {
		Prefix:      "kindService",
		Description: "Create a Service manifest",
		Body:        load("service.yaml"),
	},
	"Ingress": {
		Prefix:      "kindIngress",
		Description: "Create a Ingress manifest",
		Body:        load("ingress.yaml"),
	},
	"Chart.yaml": {
		Prefix:      "Chart.yaml",
		Description: "Create a Chart.yaml file",
		Body:        load("Chart.yaml"),
	},
	"requirements.yaml": {
		Prefix:      "requirements.yaml",
		Description: "Create a Helm requirements.yaml",
		Body:        load("requirements.yaml"),
	},

	// Template language
	"range-list": {
		Prefix:      "rangeList",
		Description: "Loop over a list",
		Body:        load("range-list.tpl"),
	},
	"range-map": {
		Prefix:      "rangeDict",
		Description: "Loop over a dict or map",
		Body:        load("range-map.tpl"),
	},
	"range-until": {
		Prefix:      "rangeUntil",
		Description: "Loop a fixed number of times.",
		Body:        load("range-until.tpl"),
	},
	"if": {
		Prefix:      "if",
		Description: "Create a conditional",
		Body:        load("if.tpl"),
	},
	"ifelse": {
		Prefix:      "ifElse",
		Description: "Create a conditional with else if, else",
		Body:        load("ifelse.tpl"),
	},
	"with": {
		Prefix:      "with",
		Description: "Create a with block",
		Body:        load("with.tpl"),
	},
	"define": {
		Prefix:      "define",
		Description: "Define a template",
		Body:        load("define.tpl"),
	},
}

func load(loc string) []string {
	loc = filepath.Join("rawsnippets", loc)
	f, err := os.Open(loc)
	if err != nil {
		panic(err)
	}
	defer f.Close()

	r := bufio.NewScanner(f)
	lines := []string{}
	for r.Scan() {
		l := r.Text()
		if err := r.Err(); err != nil {
			panic(err)
		}
		lines = append(lines, l)
	}

	return lines
}

func main() {
	out, err := json.MarshalIndent(snippets, "", "  ")
	if err != nil {
		panic(err)
	}
	fmt.Printf("%s", out)
}
