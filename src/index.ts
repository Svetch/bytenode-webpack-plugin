import Module from 'module';
import path from 'path';
import v8 from 'v8';

import { compileCode, compileElectronCode } from 'bytenode';
import { Compilation, ExternalsPlugin, sources } from 'webpack';
import type { Compiler, WebpackOptionsNormalized, WebpackPluginInstance } from 'webpack';
import type { Source } from 'webpack-sources';
import WebpackVirtualModules from 'webpack-virtual-modules';

import { createLoaderCode } from './loader';
import { toRelativeImportPath } from './paths';
import type { Options, Prepared, PreprocessedEntry, PreprocessedOutput, ProcessedOptions } from './types';
import type { EntryPoint } from './types-normalized';

v8.setFlagsFromString('--no-lazy');

class BytenodeWebpackPlugin implements WebpackPluginInstance {

  private readonly name = 'BytenodeWebpackPlugin';
  private readonly options: Options;

  constructor(options: Partial<Options> = {}) {
    this.options = {
      compileAsModule: true,
      compileForElectron: false,
      debugLifecycle: false,
      debugLogs: false,
      keepSource: false,
      silent: false,
      ...options,
    };
  }

  apply(compiler: Compiler): void {
    this.debug('original options', {
      context: compiler.options.context,
      devtool: compiler.options.devtool,
      entry: compiler.options.entry,
      output: compiler.options.output,
    });
    const outputs = Object.entries(compiler.options.entry).map(([name]) => {
      return prepare(compiler.options.context, name + '.js');
    });

    const { entry, entryLoaders, externals, virtualModules } = this.processOptions(compiler.options, outputs);
    this.debug('processed options', {
      entry,
      entryLoaders,
      outputs,
      virtualModules,
    });
    if (typeof compiler.options.output.filename === 'string') {
      compiler.options.output.filename = '[name].js';
    }

    compiler.options.entry = entry;

    // @ts-ignore: The plugin supports string[] but the type doesn't
    new ExternalsPlugin('commonjs', externals)
      .apply(compiler);

    new WebpackVirtualModules(virtualModules)
      .apply(compiler);

    this.debug('modified options', {
      devtool: compiler.options.devtool,
      entry: compiler.options.entry,
      output: compiler.options.output,
    });

    compiler.hooks.compilation.tap(this.name, (compilation: Compilation) => {
      compilation.hooks.processAssets.tapPromise({
        name: this.name,
        stage: Compilation.PROCESS_ASSETS_STAGE_DEV_TOOLING,
      }, async (assets) => {
        const entryLoaderFiles: string[] = [];

        for (const entryLoader of entryLoaders) {
          const entryPoints = compilation.entrypoints as Map<string, EntryPoint>;
          const entryPoint = entryPoints.get(entryLoader);
          const files = entryPoint?.getFiles() ?? [];

          entryLoaderFiles.push(...files);
        }

        const outputExtensionRegex = new RegExp('\\.js$', 'i');
        const shouldCompile = (name: string): boolean => {
          return outputExtensionRegex.test(name) && !entryLoaderFiles.includes(name);
        };

        for (const [name, asset] of Object.entries(assets as Record<string, Source>)) {
          this.debug('emitting', name);

          if (!shouldCompile(name)) {
            continue;
          }
          let source = asset.source();

          if (this.options.compileAsModule) {
            source = Module.wrap(source as string);
          }

          const compiledAssetName = name.replace(outputExtensionRegex, '.jsc');
          this.debug('compiling to', compiledAssetName);

          const compiledAssetSource = this.options.compileForElectron
            ? await compileElectronCode(source)
            : await compileCode(source);

          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          assets[compiledAssetName] = new sources.RawSource(compiledAssetSource, false);

          if (!this.options.keepSource) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            delete assets[name];
          }
        }
      });

    });
  }

  processOptions(options: WebpackOptionsNormalized, outputs: Prepared[]): ProcessedOptions {

    const entries: [string, string | string[] | any][] = [];
    const entryLoaders: string[] = [];
    const externals: string[] = [];
    const virtualModules: [string, string][] = [];

    for (const { entry, compiled, loader } of this.preprocessEntry(options)) {
      const entryName = typeof options.output.filename === 'string' ? prepare(options.context, options.output.filename).name : entry.name;

      entries.push([entryName, { import: loader.locations.map(e => e.location) }]);
      entryLoaders.push(entryName);

      const { name } = compiled;

      const output = outputs.find(o => {
        return o.name == entry.name;
      });
      if (!output) throw new Error('Entry not found!');
      const from = entryName + output.extension;
      const to = name + output.extension;

      let relativeImportPath = toRelativeImportPath(options?.output?.path || '', from, to);

      // Use absolute path to load the compiled file in dev mode due to how electron-forge handles
      // the renderer process code loading (by using a server and not directly from the file system).
      // This should be safe exactly because it will only be used in dev mode, so the app code will
      // never be relocated after compiling with webpack and before starting electron.
      if (options.target === 'electron-renderer' && options.mode === 'development') {
        relativeImportPath = path.resolve(options?.output?.path || '', 'renderer', relativeImportPath);
      }

      entries.push([name, { import: entry.locations.map(e => e.location) }]);
      externals.push(relativeImportPath);

      for (const e of loader.locations) {
        if (!e.dependency) {
          virtualModules.push([e.location, createLoaderCode(relativeImportPath)]);
        }
      }
    }

    return {
      entry: Object.fromEntries(entries),
      entryLoaders,
      externals,
      virtualModules: Object.fromEntries(virtualModules),
    };
  }

  preprocessOutput({ context }: WebpackOptionsNormalized, filename: string): PreprocessedOutput {
    /*     let filename: string;
    
        if (typeof output?.filename == 'function') {
          filename = output?.filename(chunk);
        } else filename = output?.filename ?? '[name].js';
     */
    const { extension, name } = prepare(context, filename);
    const dynamic = /.*[[\]]+.*/.test(filename);

    filename = dynamic ? filename : '[name]' + extension;

    return {
      dynamic,
      extension,
      filename,
      name: dynamic ? undefined : name,
      of: name => filename.replace('[name]', name),
    };
  }

  preprocessEntry({ context, entry }: WebpackOptionsNormalized): PreprocessedEntry[] {
    let entries: [string | undefined, string | string[] | any][];

    if (!entry) throw new Error('Entry is reqquired!');

    if (typeof entry === 'function') {
      throw new Error('Entry as a function is not supported as of yet.');
    }

    if (typeof entry === 'string' || Array.isArray(entry)) {
      entries = [[undefined, entry]];
    } else {
      entries = Object.entries(entry);
    }

    return entries.map(([name, location]) => {
      const entry = prepare(context, location.import || location, name);
      const compiled = prepare(context, location.import || location, name, '.compiled');
      const loader = prepare(context, location.import || location, name, '.loader');

      return {
        compiled, entry, loader,
      };
    });
  }

  debug(title: unknown, data: unknown, ...rest: unknown[]): void {
    const { debugLogs, silent } = this.options;

    if (!debugLogs || silent) {
      return;
    }

    if (typeof data === 'object') {
      console.debug('');

      if (typeof title === 'string') {
        title = title.endsWith(':') ? title : `${title}:`;
      }
    }

    console.debug(title, data, ...rest);
  }

  log(...messages: unknown[]): void {
    if (this.options.silent) {
      return;
    }
    console.log(`[${this.name}]:`, ...messages);
  }
}

function prepare(context: string | undefined, location: string | string[], name?: string, suffix = ''): Prepared {
  const locationArray = Array.isArray(location) ? location : [location];

  const locations = locationArray.map(location => {
    const dependency = isDependency(location);

    if (dependency) {
      return {
        dependency,
        location,
      };
    }

    if (context && !path.isAbsolute(location)) {
      location = path.resolve(context, location);
    }

    const directory = path.dirname(location);
    const extension = path.extname(location);
    const basename = path.basename(location, extension) + suffix;
    const filename = basename + extension;

    location = path.join(directory, filename);

    return {
      basename,
      dependency,
      location,
    };
  });

  let basename = 'main' + suffix;

  if (locations.length === 1) {
    const [single] = locations;
    basename = single.basename ?? basename;
  }

  name = name ? name + suffix : basename;

  return {
    extension: '.js', locations, name,
  };

  function isDependency(module: string): boolean {
    if (path.isAbsolute(module) || /^[.]+\/.*/.test(module)) {
      return false;
    }

    try {
      return typeof require.resolve(module) === 'string';
    } catch (_) {
      return false;
    }
  }
}

export {
  BytenodeWebpackPlugin,
};
