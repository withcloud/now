import { basename, dirname, join, relative, resolve, sep } from 'path';
import nodeFileTrace from '@zeit/node-file-trace';
import {
  glob,
  download,
  File,
  FileBlob,
  FileFsRef,
  Files,
  Meta,
  createLambda,
  runNpmInstall,
  runPackageJsonScript,
  getNodeVersion,
  getSpawnOptions,
  PrepareCacheOptions,
  BuildOptions,
  shouldServe,
  Config,
  debug
} from '@now/build-utils';
export { NowRequest, NowResponse } from './types';
import { makeNowLauncher, makeAwsLauncher } from './launcher';
import { readFileSync, lstatSync, readlinkSync, statSync } from 'fs';
import { Register, register } from './typescript';

import { pathExists, readFile, writeFile } from 'fs-extra';

interface CompilerConfig {
  dist?: string;
  debug?: boolean;
  includeFiles?: string | string[];
  excludeFiles?: string | string[];
}

interface DownloadOptions {
  files: Files;
  entrypoint: string;
  workPath: string;
  config: Config;
  meta: Meta;
}

// eslint-disable-next-line no-useless-escape
const libPathRegEx = /^node_modules|[\/\\]node_modules[\/\\]/;

const LAUNCHER_FILENAME = '___now_launcher';
const BRIDGE_FILENAME = '___now_bridge';
const HELPERS_FILENAME = '___now_helpers';
const SOURCEMAP_SUPPORT_FILENAME = '__sourcemap_support';

const S_IFMT = 61440; /* 0170000 type of file */
const S_IFLNK = 40960; /* 0120000 symbolic link */

function isSymbolicLink(mode: number): boolean {
  return (mode & S_IFMT) === S_IFLNK;
}


async function readPackageJson(entryPath: string) {
  let currentDestPath = entryPath;
  let packageJson = {};
  let packageJsonPath;
  while (true) {
    packageJsonPath = join(currentDestPath, 'package.json');
    console.log('readPackageJson', packageJsonPath);
    if (await pathExists(packageJsonPath)) {
      try {
        // eslint-disable-next-line no-await-in-loop
        packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));
      } catch (err) {
        console.log('package.json not found in entry');
      }
      break;
    }
    const newDestPath = dirname(currentDestPath);
    if (currentDestPath === newDestPath) break;
    currentDestPath = newDestPath;
  }
  return { packageJson, packageJsonPath };
}

async function writePackageJson(packageJsonPath: string, packageJson: Object) {
  await writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
}

type stringMap = { [key: string]: string };

function normalizePackageJson(
  defaultPackageJson: {
    dependencies?: stringMap;
    devDependencies?: stringMap;
    scripts?: stringMap;
  } = {}
) {
  const dependencies: stringMap = {
    ...defaultPackageJson.dependencies,
  };
  const devDependencies: stringMap = {
    ...defaultPackageJson.devDependencies,
  };
  if (devDependencies['aws-sdk']) {
    delete devDependencies['aws-sdk'];
  }
  return {
    ...defaultPackageJson,
    dependencies: {
      ...dependencies,
    },
    devDependencies: {
      ...devDependencies,
    },
    scripts: {
      ...defaultPackageJson.scripts,
    },
  };
}

async function downloadInstallAndBundle({
  files,
  entrypoint,
  workPath,
  config,
  meta
}: DownloadOptions) {
  debug('downloading user files...');
  const downloadTime = Date.now();
  const downloadedFiles = await download(files, workPath, meta);
  debug(`download complete [${Date.now() - downloadTime}ms]`);

  // --- added ---
  if (!meta || !meta.isDev) {
    const entryDirectory = dirname(entrypoint);
    const entryPath = join(workPath, entryDirectory);
    const pkg = await readPackageJson(entryPath);
    console.log('normalizing package.json');
    const packageJson = normalizePackageJson(pkg.packageJson);
    console.log('normalized package.json result: ', packageJson);
    await writePackageJson(pkg.packageJsonPath, packageJson);
  }
  // --- added ---

  debug("installing dependencies for user's code...");
  const installTime = Date.now();
  const entrypointFsDirname = join(workPath, dirname(entrypoint));
  const nodeVersion = await getNodeVersion(
    entrypointFsDirname,
    undefined,
    config
  );
  const spawnOpts = getSpawnOptions(meta, nodeVersion);
  await runNpmInstall(
    entrypointFsDirname,
    ['--prefer-offline'],
    spawnOpts,
    meta
  );
  debug(`install complete [${Date.now() - installTime}ms]`);

  const entrypointPath = downloadedFiles[entrypoint].fsPath;
  return { entrypointPath, entrypointFsDirname, nodeVersion, spawnOpts };
}

async function compile(
  workPath: string,
  entrypointPath: string,
  entrypoint: string,
  config: CompilerConfig
): Promise<{
  preparedFiles: Files;
  shouldAddSourcemapSupport: boolean;
  watch: string[];
}> {
  // --- added ---
  let input = entrypointPath;
  if (config && config.dist) {
    input = entrypointPath.replace(new RegExp(`src/`), `${config.dist}/`);
  }
  console.log('[now-node] input', input);
  // --- added ---

  const inputFiles = new Set<string>([entrypointPath]);

  const sourceCache = new Map<string, string | Buffer | null>();
  const fsCache = new Map<string, File>();
  const tsCompiled = new Set<string>();

  let shouldAddSourcemapSupport = false;

  if (config.includeFiles) {
    const includeFiles =
      typeof config.includeFiles === 'string'
        ? [config.includeFiles]
        : config.includeFiles;

    for (const pattern of includeFiles) {
      const files = await glob(pattern, workPath);
      await Promise.all(
        Object.keys(files).map(async file => {
          const entry: FileFsRef = files[file];
          fsCache.set(file, entry);
          const stream = entry.toStream();
          const { data } = await FileBlob.fromStream({ stream });
          if (file.endsWith('.ts') || file.endsWith('.tsx')) {
            sourceCache.set(
              file,
              compileTypeScript(resolve(workPath, file), data.toString())
            );
          } else {
            sourceCache.set(file, data);
          }
          inputFiles.add(resolve(workPath, file));
        })
      );
    }
  }

  debug(
    'tracing input files: ' +
      [...inputFiles].map(p => relative(workPath, p)).join(', ')
  );

  const preparedFiles: Files = {};

  let tsCompile: Register;
  function compileTypeScript(path: string, source: string): string {
    const relPath = relative(workPath, path);
    if (!tsCompile) {
      tsCompile = register({
        basePath: workPath, // The base is the same as root now.json dir
        project: path, // Resolve tsconfig.json from entrypoint dir
        files: true // Include all files such as global `.d.ts`
      });
    }
    const { code, map } = tsCompile(source, path);
    tsCompiled.add(relPath);
    preparedFiles[
      relPath.slice(0, -3 - Number(path.endsWith('x'))) + '.js.map'
    ] = new FileBlob({
      data: JSON.stringify(map)
    });
    source = code;
    shouldAddSourcemapSupport = true;
    return source;
  }

  const { fileList, esmFileList, warnings } = await nodeFileTrace([...inputFiles], {
    base: workPath,
    ts: true,
    mixedModules: true,
    ignore: config.excludeFiles,
    readFile(fsPath: string): Buffer | string | null {
      const relPath = relative(workPath, fsPath);
      const cached = sourceCache.get(relPath);
      if (cached) return cached.toString();
      // null represents a not found
      if (cached === null) return null;
      try {
        let source: string | Buffer = readFileSync(fsPath);
        if (fsPath.endsWith('.ts') || fsPath.endsWith('.tsx')) {
          source = compileTypeScript(fsPath, source.toString());
        }
        const { mode } = lstatSync(fsPath);
        let entry: File;
        if (isSymbolicLink(mode)) {
          entry = new FileFsRef({ fsPath, mode });
        } else {
          entry = new FileBlob({ data: source, mode });
        }
        fsCache.set(relPath, entry);
        sourceCache.set(relPath, source);
        return source.toString();
      } catch (e) {
        if (e.code === 'ENOENT' || e.code === 'EISDIR') {
          sourceCache.set(relPath, null);
          return null;
        }
        throw e;
      }
    }
  });

  for (const warning of warnings) {
    if (warning && warning.stack) {
      debug(warning.stack.replace('Error: ', 'Warning: '));
    }
  }

  for (const path of fileList) {
    let entry = fsCache.get(path);
    if (!entry) {
      const fsPath = resolve(workPath, path);
      const { mode } = lstatSync(fsPath);
      if (isSymbolicLink(mode)) {
        entry = new FileFsRef({ fsPath, mode });
      } else {
        const source = readFileSync(fsPath);
        entry = new FileBlob({ data: source, mode });
      }
    }
    if (isSymbolicLink(entry.mode) && entry.fsPath) {
      // ensure the symlink target is added to the file list
      const symlinkTarget = relative(
        workPath,
        resolve(dirname(entry.fsPath), readlinkSync(entry.fsPath))
      );
      if (
        !symlinkTarget.startsWith('..' + sep) &&
        fileList.indexOf(symlinkTarget) === -1
      ) {
        const stats = statSync(resolve(workPath, symlinkTarget));
        if (stats.isFile()) {
          fileList.push(symlinkTarget);
        }
      }
    }
    // Rename .ts -> .js (except for entry)
    // There is a bug on Windows where entrypoint uses forward slashes
    // and workPath uses backslashes so we use resolve before comparing.
    if (
      resolve(workPath, path) !== resolve(workPath, entrypoint) &&
      tsCompiled.has(path)
    ) {
      preparedFiles[
        path.slice(0, -3 - Number(path.endsWith('x'))) + '.js'
      ] = entry;
    } else {
      // --- added ---
      let filePath = path;
      if (config && config.dist && !path.includes('node_modules')) {
        filePath = path.replace(new RegExp(`${config.dist}/`), `src/`);
      }
      // console.log('[now-node] filePath', filePath)
      // --- added ---
      preparedFiles[filePath] = entry;
    }
  }

  // Compile ES Modules into CommonJS
  const esmPaths = esmFileList.filter(
    file =>
      !file.endsWith('.ts') &&
      !file.endsWith('.tsx') &&
      !file.match(libPathRegEx)
  );
  if (esmPaths.length) {
    const babelCompile = require('./babel').compile;
    for (const path of esmPaths) {
      const filename = basename(path);
      const { data: source } = await FileBlob.fromStream({
        stream: preparedFiles[path].toStream()
      });

      const { code, map } = babelCompile(filename, source);
      shouldAddSourcemapSupport = true;
      preparedFiles[path] = new FileBlob({
        data: `${code}\n//# sourceMappingURL=${filename}.map`
      });
      delete map.sourcesContent;
      preparedFiles[path + '.map'] = new FileBlob({
        data: JSON.stringify(map)
      });
    }
  }

  return {
    preparedFiles,
    shouldAddSourcemapSupport,
    watch: fileList
  };
}

export const version = 2;

export async function build({
  files,
  entrypoint,
  workPath,
  config = {},
  meta = {}
}: BuildOptions) {
  const shouldAddHelpers = config.helpers !== false;
  const awsLambdaHandler = config.awsLambdaHandler as string;

  const {
    entrypointPath,
    entrypointFsDirname,
    nodeVersion,
    spawnOpts
  } = await downloadInstallAndBundle({
    files,
    entrypoint,
    workPath,
    config,
    meta
  });

  debug('running user script...');
  const runScriptTime = Date.now();
  await runPackageJsonScript(entrypointFsDirname, 'now-build', spawnOpts);
  debug(`script complete [${Date.now() - runScriptTime}ms]`);

  debug('tracing input files...');
  const traceTime = Date.now();
  const { preparedFiles, shouldAddSourcemapSupport, watch } = await compile(
    workPath,
    entrypointPath,
    entrypoint,
    config
  );
  debug(`trace complete [${Date.now() - traceTime}ms]`);

  const makeLauncher = awsLambdaHandler ? makeAwsLauncher : makeNowLauncher;

  const launcherFiles: Files = {
    [`${LAUNCHER_FILENAME}.js`]: new FileBlob({
      data: makeLauncher({
        entrypointPath: `./${entrypoint}`,
        bridgePath: `./${BRIDGE_FILENAME}`,
        helpersPath: `./${HELPERS_FILENAME}`,
        sourcemapSupportPath: `./${SOURCEMAP_SUPPORT_FILENAME}`,
        shouldAddHelpers,
        shouldAddSourcemapSupport,
        awsLambdaHandler,
      })
    }),
    [`${BRIDGE_FILENAME}.js`]: new FileFsRef({
      fsPath: join(__dirname, 'bridge.js')
    })
  };

  if (shouldAddSourcemapSupport) {
    launcherFiles[`${SOURCEMAP_SUPPORT_FILENAME}.js`] = new FileFsRef({
      fsPath: join(__dirname, 'source-map-support.js')
    });
  }

  if (shouldAddHelpers) {
    launcherFiles[`${HELPERS_FILENAME}.js`] = new FileFsRef({
      fsPath: join(__dirname, 'helpers.js')
    });
  }

  // Use the system-installed version of `node` when running via `now dev`
  const runtime = meta.isDev ? 'nodejs' : nodeVersion.runtime;

  const lambda = await createLambda({
    files: {
      ...preparedFiles,
      ...(launcherFiles)
    },
    handler: `${LAUNCHER_FILENAME}.launcher`,
    runtime
  });

  const output = { [entrypoint]: lambda };
  const result = { output, watch };
  return result;
}

export async function prepareCache({ workPath }: PrepareCacheOptions) {
  return {
    ...(await glob('node_modules/**', workPath)),
    ...(await glob('package-lock.json', workPath)),
    ...(await glob('yarn.lock', workPath))
  };
}

export { shouldServe };
