import sinon from 'sinon';
import any from '@travi/any';
import {assert} from 'chai';
import * as packageTypeScaffolder from '../../../src/project-type/package/scaffolder';
import * as applicationTypeScaffolder from '../../../src/project-type/application';
import projectTypeScaffolder from '../../../src/project-type';

suite('project-type scaffolder', () => {
  let sandbox;
  const results = any.simpleObject();
  const projectRoot = any.string();
  const transpileLint = any.boolean();

  setup(() => {
    sandbox = sinon.createSandbox();

    sandbox.stub(packageTypeScaffolder, 'default');
    sandbox.stub(applicationTypeScaffolder, 'default');
  });

  teardown(() => sandbox.restore());

  test('that the package-type scaffolder is applied when the project-type is `Package`', async () => {
    const packageName = any.word();
    const visibility = any.word();
    packageTypeScaffolder.default.withArgs({projectRoot, transpileLint, packageName, visibility}).resolves(results);

    assert.equal(
      await projectTypeScaffolder({projectType: 'Package', projectRoot, transpileLint, packageName, visibility}),
      results
    );
  });

  test('that the application-type scaffolder is applied when the project-type is `Application`', async () => {
    const applicationTypes = any.simpleObject();
    const configs = any.simpleObject();
    applicationTypeScaffolder.default
      .withArgs({projectRoot, transpileLint, applicationTypes, configs})
      .resolves(results);

    assert.equal(
      await projectTypeScaffolder({projectType: 'Application', projectRoot, transpileLint, applicationTypes, configs}),
      results
    );
  });

  test('that an error is thrown for an unknown project-type', () => {
    const projectType = any.word();

    assert.throws(() => projectTypeScaffolder({projectType}), `The project-type of ${projectType} is invalid`);
  });
});
