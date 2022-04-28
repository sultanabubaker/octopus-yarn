const fixtures = require('octopus-test-utils'),
  {expect} = require('chai').use(require('chai-shallow-deep-equal')),
  modules = require('..'),
  {resolve} = require('path');

const emitModules = modules.modules;
const removeByPath = modules.removeNotInPaths;

describe('modules', () => {

  it('should traverse into private package, but exclude if they have siblings', () => {
    const project = fixtures.empty()
      .packageJson({name: 'root', private: true, dependencies: {name: 'a', version: '1.0.0'}})
      .module('a', module => module.packageJson({name: 'a', version: '1.0.0'}))
      .module('b', module => module.packageJson({version: '1.0.0', dependencies: {'a': '~1.0.0'}}));

    return project.within(() => {
      expect(emitModuleNames()).to.deep.equal(['a', 'b']);
    });
  });

  it('should include leaf private packages', () => {
    const project = fixtures.empty()
      .module('a', module => module.packageJson({name: 'a', version: '1.0.0'}))
      .module('nested/b', module => module.packageJson({version: '1.0.0', dependencies: {'a': '~1.0.0'}, private: true}));

    return project.within(() => {
      expect(emitModuleNames()).to.deep.equal(['a', 'b']);
    });
  });


  it('should not traverse into node_modules', () => {
    const project = fixtures.empty()
      .packageJson({name: 'root', private: true, dependencies: {name: 'a', version: '1.0.0'}})
      .module('node_modules/a', module => module.packageJson({name: 'a', version: '1.0.0'}))
      .module('b', module => module.packageJson({version: '1.0.0', dependencies: {'a': '~1.0.0'}}));

    return project.within(() => {
      expect(emitModuleNames()).to.deep.equal(['b']);
    });
  });


  it('should not traverse into module that is not private', () => {
    const project = fixtures.empty()
      .packageJson({name: 'root', dependencies: {name: 'a', version: '1.0.0'}})
      .module('a', module => module.packageJson({name: 'a', version: '1.0.0'}))
      .module('b', module => module.packageJson({version: '1.0.0', dependencies: {'a': '~1.0.0'}}));

    return project.within(() => {
      expect(emitModuleNames()).to.deep.equal(['root']);
    });
  });

  it('should traverse into nested private module, but exclude them if they have siblings', () => {
    const project = fixtures.empty()
      .module('a', module => {
        module.packageJson({name: 'a', version: '1.0.0', private: true});
        module.module('c', module => module.packageJson({name: 'c', version: '1.0.0'}));
      })
      .module('b', module => module.packageJson({version: '1.0.0', dependencies: {'c': '~1.0.0'}}));

    return project.within(() => {
      expect(emitModuleNames()).to.deep.equal(['c', 'b']);
    });
  });

  it('should build correct dependency order', () => {
    const project = fixtures.empty()
      .module('a', module => module.packageJson({name: 'a', version: '1.0.0'}))
      .module('b', module => module.packageJson({version: '1.0.0', dependencies: {'a': '~1.0.0'}}))
      .module('c', module => module.packageJson({version: '1.0.0', dependencies: {'b': '~1.0.0'}}));

    return project.within(() => {
      expect(emitModuleNames()).to.deep.equal(['a', 'b', 'c']);
    });

  });

  it('should fail for cyclic graph', () => {
    const project = fixtures.empty()
      .module('b', module => module.packageJson({version: '1.0.0', dependencies: {'c': '~1.0.0'}}))
      .module('c', module => module.packageJson({version: '1.0.0', dependencies: {'b': '~1.0.0'}}));

    return project.within(() => {
      expect(() => emitModuleNames()).to.throw('Cycles detected in dependency graph');
    });

  });

  it('should build modules with dependencies', () => {
    const project = fixtures.empty()
      .module('b', module => module.packageJson({version: '1.0.0', dependencies: {'c': '~1.0.0'}}))
      .module('c', module => module.packageJson({version: '1.0.0'}));

    return project.within(() => {
      expect(emitModules()).to.shallowDeepEqual([
        {
          name: 'c',
          path: resolve(project.dir, './c'),
          relativePath: 'c',
          version: '1.0.0',
          dependencies: []
        },
        {
          name: 'b',
          path: resolve(project.dir, './b'),
          relativePath: 'b',
          version: '1.0.0',
          dependencies: [{
            name: 'c',
            path: resolve(project.dir, './c'),
            relativePath: 'c',
            version: '1.0.0'
          }]
        }
      ])
    });
  });

  it('remove modules without changes as defined by provided paths', () => {
    const project = fixtures.empty()
      .module('a', module => module.packageJson({name: 'a', version: '1.0.0'}))
      .module('b', module => module.packageJson({version: '1.0.0', dependencies: {'a': '~1.0.0'}}))
      .module('c', module => module.packageJson({version: '1.0.0', dependencies: {'b': '~1.0.0'}}));

    return project.within(() => {
      const withRemoved = removeByPath(emitModules(), ['b/.touch']);
      expect(withRemoved.map(module => module.name)).to.deep.equal(['b', 'c']);
    });

  });

  function emitModuleNames() {
    return emitModules().map(module => module.name);
  }
});
