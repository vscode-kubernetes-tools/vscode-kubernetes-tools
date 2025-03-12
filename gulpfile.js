import { task, src } from "gulp";
import tslint from "gulp-tslint";

task("tslint", () => {
	return src(["**/*.ts", "!**/*.d.ts", "!node_modules/**"])
		.pipe(tslint())
		.pipe(tslint.report());
});
