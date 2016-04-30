#! /usr/bin/env node
'use strict';

const fs = require('fs');
const packager = require('./packager');
const path = process.cwd();
const pkg = require(`${path}/package.json`);
const serve = require('./serve');

const configFile = `${path}/.panels.js`;

const version = pkg.version || 'dev';

const defaultOpts = {
  // static assets path to put your images, files, etc.
  assets: `${path}/public`,

  // the path to the bundleda pp
  bundle: `${path}/bundle/${version}`,

  // the app's entry point
  entry: `${path}/${pkg.main}`,

  // dependencies that panels already bundles for us and we can safely declare as externals
  externals: Object.keys(require('panels/package.json').dependencies),

  // the app's name that panels will call it after, generally its the domain where it runs
  expose: pkg.name,

  // host to run the dev server at
  host: '0.0.0.0',

  // port to run the dev server at
  port: 80,

  // expose your own requires for your own use too
  requires: Object.keys(pkg.dependencies),

  // path to rollup.config.js used to transform the code
  rollupConfig: `${__dirname}/rollup.config.js`,

  // path to the temporary bundle used when watching
  tmp: `${path}/panels.app.tmp.js`,

  // the version we're working on
  version: version
};

const opts = fs.existsSync(configFile) ? Object.assign(defaultOpts, require(configFile)) : defaultOpts;

// tell the mode we're working on
const shouldBundle = process.argv[2] === 'bundle';
if (shouldBundle) {
  packager.bundle(opts);
} else {
  const cleanup = packager.watch(opts);
  serve(opts);

  // clean up the temp file on exit and ctrl+c event
  process.on('exit', cleanup);
  process.on('SIGINT', cleanup);
}
