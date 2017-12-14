package main

import (
	"fmt"
	"strings"

	"github.com/Masterminds/sprig"
)

// main prints a regexp to match all of the functions in sprig.
//
// To use this, run it as `go run funcs.go`.
//
// This is a light utility for generating a list of all of the functions in the Sprig library.
// It is specific to the tmLanguage syntax for this project.
func main() {
	list := []string{}
	funcs := sprig.GenericFuncMap()
	for k := range funcs {
		list = append(list, k)
	}

	fmt.Printf("(%s)", strings.Join(list, "|"))
}
