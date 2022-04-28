const startModules = require('octopus-start-modules-tasks'),
  startTasks = require('octopus-start-tasks'),
  start = require('start').default,
  R = require('ramda');

const {iter, modules} = startModules;
const {readJson} = startModules.module;

function unmanagedDependenciesTask() {
  return () => function unmanagedDependencies(log, reporter) {
    const innerModules = [];
    const deps = {dependencies: {}, peerDependencies: {}};

    return start(reporter)(
      modules.load(),
      iter.async({silent: true})((module, input, asyncReporter) =>
        start(asyncReporter)(
          readJson(module)('package.json'),
          fillModulesAndDeps(innerModules, deps))
      ),
      startTasks.readJson('package.json'),
      executeUnmanaged(innerModules, deps)
    )
  }
}

function executeUnmanaged(innerModules, deps) {
  return ({managedDependencies = {}, managedPeerDependencies = {}}) => {
    return function unmanaged(log/*, reporter*/) {
      cleanProjectDeps(innerModules, deps);
      cleanManagedDeps(deps, managedDependencies, managedPeerDependencies);
      logUnmanaged(deps, log);
      return rejectIfUnmanaged(deps);
    };
  }
}

function logUnmanaged(deps, log) {
  const toSortedUniqKeys = R.compose(R.sort(R.ascend), R.uniq, R.values);
  Object.keys(deps.dependencies).forEach(depKey => {
    const modulesAndVersions = toSortedUniqKeys(deps.dependencies[depKey]);
    log(`Unmanaged dependency ${depKey} (${modulesAndVersions.join(', ')})`);
  });

  Object.keys(deps.peerDependencies).forEach(depKey => {
    const modulesAndVersions = toSortedUniqKeys(deps.peerDependencies[depKey]);
    log(`Unmanaged peerDependency ${depKey} (${modulesAndVersions.join(', ')})`);
  });
}

function rejectIfUnmanaged(deps) {
  if ((Object.keys(deps.dependencies).length + Object.keys(deps.peerDependencies).length) > 0) {
    return Promise.reject(new Error('Unmanaged dependencies found, see output above'));
  } else {
    return Promise.resolve();
  }
}

function cleanProjectDeps(innerModules, deps) {
  innerModules.forEach(name => delete deps.dependencies[name]);
  innerModules.forEach(name => delete deps.peerDependencies[name]);
}

function cleanManagedDeps(deps, managedDependencies, managedPeerDependencies) {
  Object.keys(managedDependencies).forEach(name => delete deps.dependencies[name]);
  Object.keys(managedPeerDependencies).forEach(name => delete deps.peerDependencies[name]);
}

function fillModulesAndDeps(innerModules, deps) {
  return packageJson => () => {
    return Promise.resolve().then(() => {
      innerModules.push(packageJson.name);
      fill(deps.dependencies)(packageJson, 'dependencies');
      fill(deps.dependencies)(packageJson, 'devDependencies');
      fill(deps.peerDependencies)(packageJson, 'peerDependencies');
    });
  };
}


function fill(deps) {
  return (packageJson, type) => {
    Object.keys(packageJson[type] || []).forEach(depKey => {
      deps[depKey] = deps[depKey] || {};
      deps[depKey][packageJson.name] = packageJson[type][depKey];
    });
  }
}


module.exports.task = unmanagedDependenciesTask;