import { src, dest, parallel, series, watch } from 'gulp';
import uglify from 'gulp-uglify';
import cleanCSS from 'gulp-clean-css';
import rename from 'gulp-rename';
import replace from 'gulp-replace';
import ts from "gulp-typescript";
import filter from "gulp-filter";

const path = {
  src: './src/*',
  dist: './dist',
  js: './src/*.ts',
  css: './src/*.css'
};

const tsProject = ts.createProject('tsconfig.json');


function minifyJS() {
  const f = filter(['*.js']);
  return src(path.js)
    .pipe(tsProject())
    .pipe(replace('"use strict";', ''))
    // Output the non-minified version
    .pipe(dest(path.dist))
    // Minify and rename to *.min.js
    .pipe(f)
    .pipe(uglify({
      output: {
        comments: /^!/
      }
    }))
    .pipe(rename(function (path) {
      path.basename += '.min';
    }))
    .pipe(dest(path.dist));
}

function minifyCSS() {
  return src(path.css)
    .pipe(cleanCSS())
    .pipe(rename(function (path) {
      path.basename += '.min';
    }))
    .pipe(dest(path.dist));
}

function copySourceCSS() {
    return src(path.css).pipe(dest(path.dist));
}

function watchFiles() {
  watch(path.js, minifyJS);
  watch(path.css, parallel(minifyCSS, copySourceCSS));
}

export const build = parallel(minifyJS, minifyCSS, copySourceCSS);

export default series(build, watchFiles);


