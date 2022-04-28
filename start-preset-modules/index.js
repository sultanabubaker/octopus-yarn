const startModules = require('octopus-start-modules-tasks'),
  _ = require('lodash'),
  startTasks = require('octopus-start-tasks'),
  start = require('start').default;

const {iter, modules} = startModules;
const {readJson, writeJson, mergeJson} = startModules.module;

function listModulesTask() {
  return () => function listModules(log, reporter) {
    return start(reporter)(modules.load(), iter.forEach()(_.noop));
  }
}

function whereModuleTask(moduleName) {
  return () => function whereModule(log, reporter) {
    return start(reporter)(
      modules.load(),
      iter.async({silent: true})((module, input, asyncReporter) => {
        return Promise.resolve().then(() => {
          const dep = module.dependencies.find(dep => dep.name === moduleName);
          if (dep) {
            asyncReporter('whereModule', 'info', `${module.name} (${module.relativePath}) (${module.version})`);
          }
        })
      })
    )
  }
}

function syncModulesTask(mutateVersion = version => `~${version}`) {
  return () => function syncModules(log, reporter) {
    return start(reporter)(
      modules.load(),
      startTasks.props({
        modules: modules => modules,
        modulesAndVersions: modules => modulesAndVersion(modules, mutateVersion)
      }),
      iter.async({mapInput: opts => opts.modules, silent: true})((module, input, asyncReporter) => {
        const {modulesAndVersions} = input;
        const readPackageJson = readJson(module)('package.json');
        const writePackageJson = writeJson(module)('package.json');
        const logMerged = input => log(`${module.name}: ${input.key} (${input.currentValue} -> ${input.newValue})`);
        const mergePackageJson = mergeJson(logMerged)({
          dependencies: modulesAndVersions,
          devDependencies: modulesAndVersions
        });

        return start(asyncReporter)(readPackageJson, mergePackageJson, writePackageJson);
      })
    )
  }
}

function modulesAndVersion(modules, mutateVersion) {
  return modules.reduce((acc, val) => {
    acc[val.name] = mutateVersion(val.version);
    return acc;
  }, {})
}

module.exports = {
  list: listModulesTask,
  sync: syncModulesTask,
  where: whereModuleTask
};