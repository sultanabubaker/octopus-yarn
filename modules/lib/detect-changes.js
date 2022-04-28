const parseGitIgnore = require('parse-gitignore');
const {Minimatch} = require('minimatch');
const shelljs = require('shelljs');
const fs = require('fs');
const path = require('path');
const inDir = require('./in-dir').sync;
const _ = require('lodash');

const targetFileSentinelFilename = label => `target/.octo-${label}-sentinel`;

module.exports.makePackageBuilt = (dir, label) => {
  shelljs.mkdir('-p', path.resolve(dir, path.dirname(targetFileSentinelFilename(label))));
  fs.writeFileSync(path.resolve(dir, targetFileSentinelFilename(label)), '');
};

module.exports.makePackageUnbuilt = (dir, label) => {
  shelljs.rm('-f', path.resolve(dir, targetFileSentinelFilename(label)));
};

module.exports.findChangedPackages = (dir, packages, label) => {
  const isPackageChangedLabeled = isPackageChanged(label);
  return packages.filter(isPackageChangedLabeled);
};


function createIgnoreFn(ignores) {
  const patterns = parseGitIgnore.parse(ignores, {});
  const matchers = patterns.map(pattern => new Minimatch(pattern));
  return filePath => matchers.some(matcher => matcher.match(filePath));
}

function isPackageChanged(label) {
  return packageObject => {
    const fullPath = packageObject.path;
    let ignores = collectIgnores(fullPath, []);
    const ignored = createIgnoreFn(ignores);
    const targetSentinelForPackage = path.resolve(fullPath, targetFileSentinelFilename(label));
    return !shelljs.test('-f', targetSentinelForPackage) ||
      modifiedAfter(fullPath, '.', ignored, fs.statSync(targetSentinelForPackage).mtime.getTime());
  };
}

function modifiedAfter(baseDir, dir, ignored, timeStamp) {
  let rootAbsolutePath = path.resolve(baseDir, dir);
  const entries = shelljs.ls(rootAbsolutePath);

  return entries
    .map(entry => {
      const absolutePath = path.resolve(rootAbsolutePath, entry);
      return {
        absolutePath,
        relativePath: path.relative(baseDir, absolutePath),
        stats: fs.lstatSync(absolutePath)
      }
    })
    .filter(({relativePath}) => !ignored(relativePath))
    .filter(({stats}) => !stats.isSymbolicLink())
    .sort(({stats}) => stats.isFile() ? -1 : 1)
    .some(({relativePath, stats}) => {
      return stats.isDirectory() ? modifiedAfter(baseDir, relativePath, ignored, timeStamp) : stats.mtime.getTime() > timeStamp
    })

}

function collectIgnores(dir, acc) {
  acc = acc || ['target', 'node_modules', 'npm-debug.log'];
  return _.union(acc, inDir(dir, () => {
    const slash = path.sep;
    const ignores = readAndParseGitignore();
    const parent = dir.split(slash).slice(0, -1).join(slash) || '/';
    const isRoot = shelljs.test('-d', '.git');
    return isRoot || dir === slash ? ignores : collectIgnores(parent, ignores);
  }));
}

function readAndParseGitignore() {
  const gitignore = shelljs.test('-f', '.gitignore');
  return gitignore
    ? fs.readFileSync('.gitignore', 'utf8')
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && line.charAt(0) !== '#')
    : [];
}
