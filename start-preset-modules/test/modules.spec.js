const {empty, fs} = require('octopus-test-utils'),
  {expect} = require('chai').use(require('sinon-chai')),
  Start = require('start').default,
  sinon = require('sinon'),
  {sync, where, list} = require('..');

describe('modules tasks', () => {

  describe('sync', () => {

    it('should sync module versions', () => {
      const {reporter, project, start} = setup();
      return project.within(() => {

        return start(sync()).then(() => {
          expect(fs.readJson('b/package.json')).to.contain.deep.property('dependencies.a', '~2.0.0');
          expect(reporter).to.have.been.calledWith(sinon.match.any, 'info', 'b: dependencies.a (~1.0.0 -> ~2.0.0)');
        });
      });
    });
  });

  describe('list', () => {

    it('should list loaded modules', () => {
      const {reporter, project, start} = setup();

      return project.within(() => {
        return start(list()).then(() => {
          expect(reporter).to.have.been.calledWith(sinon.match.any, 'info', 'a (nested/a) (1/2)');
          expect(reporter).to.have.been.calledWith(sinon.match.any, 'info', 'b (b) (2/2)');
        });
      });
    });
  });

  describe('where', () => {

    it('should show where module is used', () => {
      const {reporter, project, start} = setup();

      return project.within(() => {
        return start(where('a')).then(() => {
          expect(reporter).to.have.been.calledWith(sinon.match.any, 'info', 'b (b) (1.0.0)');
        });
      });
    });
  });

  function setup() {
    const reporter = sinon.spy();
    const project = empty()
      .module('nested/a', module => module.packageJson({name: 'a', version: '2.0.0'}))
      .module('b', module => module.packageJson({version: '1.0.0', dependencies: {'a': '~1.0.0'}}));
    const start = new Start(reporter);

    return {reporter, project, start};
  }

});