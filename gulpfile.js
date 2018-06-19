const gulp = require("gulp");
const tslint = require("gulp-tslint");
const { generate_kubernetes_enums }  = require("./generate_kubernetes_enums");

gulp.task("tslint", () => {
	return gulp.src(["**/*.ts", "!**/*.d.ts", "!node_modules/**"])
		.pipe(tslint())
		.pipe(tslint.report());
});

gulp.task("schema_enum", () => {
	return generate_kubernetes_enums("schema/schema_enums-v1.9.3.json");
});
