'use strict';

const browserify = require('browserify');
const chalk = require('chalk');
const fs = require('fs');
const rollupify = require('rollupify');
const watchify = require('watchify');

function bundle(opts) {
  const exorcist = require('exorcist');
  const domain = chalk.dim(`[${opts.domain}]`);
  const mkdirp = require('mkdirp');
  const uglifyJs = require('uglify-js');

  console.log(domain, `PacPan is getting your Panels app "${opts.expose}" ready to go :)`);
  console.time('pacpan-bundle');

  const b = browserify({
    debug: true,
    entries: [opts.entry]
  });

  // entry point of our app, panels needs this to require it
  b.require(opts.entry, {expose: opts.expose});

  // expose the app dependencies
  b.require(opts.requires);

  // rollupify the bundle
  b.transform(rollupify, {config: opts.rollupConfig});

  // declare our build's externals
  opts.externals.forEach(dep => b.external(dep));

  // make sure the bundle directory exists
  mkdirp.sync(opts.bundle);

  // determine the bundle's full path
  const out = `${opts.expose.replace(/[@\/]/g, '')}-${opts.version}`;

  const outJs = `${out}.js`;
  const outJsMap = `${outJs}.map`;

  const outJsMin = `${out}.min.js`;
  const outJsMinMap = `${outJsMin}.map`;

  function minify() {
    const minified = uglifyJs.minify(`${opts.bundle}/${outJs}`, {
      compress: {
        screw_ie8: true
      },
      inSourceMap: `${opts.bundle}/${outJsMap}`,
      mangle: {
        screw_ie8: true
      },
      outSourceMap: outJsMinMap
    });

    // write the minified code
    const codeStream = fs.createWriteStream(`${opts.bundle}/${outJsMin}`, 'utf8');
    codeStream.write(minified.code, () => codeStream.end());

    // write the minified map code
    const mapStream = fs.createWriteStream(`${opts.bundle}/${outJsMinMap}`, 'utf8');
    mapStream.write(minified.map, () => mapStream.end());
  }

  function buildIndexHtml() {
    const out = fs.createWriteStream(`${opts.bundle}/index.html`, 'utf8');

    const html = fs.readFileSync(`${__dirname}/playground.html`).toString()
      .replace(
        '<script src=/panels.js></script>\n',
        `<script src=/${outJsMin}></script>\n<script src=https://cdn.uxtemple.com/panels.js></script>\n`
      );

    out.write(html, () => out.end());
  }

  function buildPanelsJson() {
    const out = fs.createWriteStream(`${opts.bundle}/panels.json`, 'utf8');

    const json = fs.readFileSync(`${__dirname}/panels.json`).toString().replace('app.js', outJsMin);

    out.write(json);
    out.end();
  }

  b.bundle()
    .pipe(exorcist(`${opts.bundle}/${outJsMap}`, outJsMap))
    .pipe(fs.createWriteStream(`${opts.bundle}/${outJs}`), 'utf8')
    .on('finish', () => {
      minify();
      buildIndexHtml();
      buildPanelsJson();

      console.timeEnd('pacpan-bundle');
      console.log(domain, `PacPan just finished. Your bundle is at ${opts.bundle}:`);
      console.log(fs.readdirSync(opts.bundle).join(', '));
    });
}

let watchError;
function watch(opts) {
  const b = browserify({
    cache: {},
    // debug: true,
    entries: [opts.entry],
    packageCache: {},
    plugin: [watchify]
  });

  const domain = chalk.dim(`[${opts.domain}]`);

  // entry point of our app, panels needs this to require it
  b.require(opts.entry, {expose: opts.expose});

  // expose the app dependencies
  b.require(opts.requires);

  // rollupify the bundle
  b.transform(rollupify, {config: opts.rollupConfig, sourceMaps: false});

  // declare our build's externals
  opts.externals.forEach(dep => b.external(dep));

  // run the bundle and output to the console
  function bundle() {
    b.bundle().pipe(fs.createWriteStream(opts.tmp));
  }
  bundle();

  b.on('update', bundle);
  b.on('log', msg => {
    console.log(domain, msg)
  });

  b.on('bundle', theBundle => {
    theBundle.on('error', error => {
      if (watchError !== error.stack) {
        if (error.codeFrame) {
          console.error(domain, chalk.red(`${error.constructor.name} at ${error.id}`));
          console.error(domain, error.codeFrame);
        } else {
          const match = error.stack.match(/Error: Could not resolve (.+?) from (.+?) while/);
          if (match) {
            console.error(domain, chalk.red(`ImportError at ${match[2]}`));
            console.error(domain, 'Does', chalk.blue(match[1]), 'exist? Check that import statement.');
          } else {
            console.error(domain, error.stack);
          }
        }
        watchError = error.stack;
      }
      b.removeAllListeners();
      b.close();
      setTimeout(() => watch(opts), 1000);
    });
  });

  return function cleanup() {
    try {
      fs.unlinkSync(opts.tmp);
    } catch(err) {
    }

    try {
      fs.unlinkSync(`${opts.entry}.tmp`);
    } catch(err) {
    }
    process.exit();
  };
}

module.exports = {
  bundle,
  watch
};
