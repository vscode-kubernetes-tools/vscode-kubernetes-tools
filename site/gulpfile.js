var gulp = require('gulp'),
  sass = require('gulp-sass'),
  autoprefixer = require('gulp-autoprefixer'),
  minifycss = require('gulp-clean-css'),
  rename = require('gulp-rename'),
  livereload = require('gulp-livereload'),
  del = require('del'),
  cssnano = require('gulp-cssnano'),
  sourcemaps = require('gulp-sourcemaps'),
  ghPages = require('gulp-gh-pages-gift');

  sass.compiler = require('node-sass');


gulp.task('styles', function () {
  return gulp.src('themes/vscode/static/sass/styles.scss', {style: 'compressed'})
    .pipe(sass().on('error', sass.logError))
    .pipe(autoprefixer('last 2 version'))
    .pipe(rename({suffix: '.min'}))
    .pipe(minifycss())
    .pipe(sourcemaps.init())
    .pipe(cssnano())
    .pipe(sourcemaps.write('.'))
    .pipe(gulp.dest('themes/vscode/static/css/'))
    // .pipe(gulp.dest('static/css'));
});

gulp.task('deploy', function(){
  return gulp.src('./public/**/*')
    .pipe(ghPages())
});

gulp.task('default', gulp.series('styles'), function() { });

gulp.task('watch', function () {

  gulp.watch('themes/vscode/static/sass/**/*.scss', gulp.series('styles'));

  livereload.listen();

  gulp.watch('themes/**').on('change', livereload.changed);
});