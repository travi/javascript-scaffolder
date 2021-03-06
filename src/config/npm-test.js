import {promises as fsPromises} from 'fs';
import {projectTypes} from '@form8ion/javascript-core';
import {assert} from 'chai';
import any from '@travi/any';
import sinon from 'sinon';
import scaffoldNpmConfig from './npm';

suite('npm config scaffolder', () => {
  let sandbox;
  const projectRoot = any.string();

  setup(() => {
    sandbox = sinon.createSandbox();

    sandbox.stub(fsPromises, 'writeFile');
  });

  teardown(() => sandbox.restore());

  test('that applications save exact versions of dependencies', async () => {
    await scaffoldNpmConfig({projectRoot, projectType: projectTypes.APPLICATION});

    assert.calledWith(
      fsPromises.writeFile,
      `${projectRoot}/.npmrc`,
      'update-notifier=false\nengine-strict=true\nsave-exact=true\n'
    );
  });

  test('that cli-applications save exact versions of dependencies', async () => {
    await scaffoldNpmConfig({projectRoot, projectType: projectTypes.CLI});

    assert.calledWith(
      fsPromises.writeFile,
      `${projectRoot}/.npmrc`,
      'update-notifier=false\nengine-strict=true\nsave-exact=true\n'
    );
  });

  test('that packages are allowed to use semver ranges', async () => {
    await scaffoldNpmConfig({projectRoot, projectType: projectTypes.PACKAGE});

    assert.calledWith(
      fsPromises.writeFile,
      `${projectRoot}/.npmrc`,
      'update-notifier=false\nengine-strict=true\n'
    );
  });

  test('that scoped registries are added to the contig when provided', async () => {
    const registries = any.objectWithKeys(any.listOf(any.word), {factory: any.word});

    await scaffoldNpmConfig({projectRoot, projectType: any.word(), registries});

    assert.calledWith(
      fsPromises.writeFile,
      `${projectRoot}/.npmrc`,
      `update-notifier=false\nengine-strict=true\n${
        Object.entries(registries)
          .map(([scope, url]) => `@${scope}:registry=${url}`)
          .join('\n')
      }\n`
    );
  });

  test('that the script to enforce peer-dependency compatibility is defined', async () => {
    const results = await scaffoldNpmConfig({projectRoot, projectType: any.word()});

    assert.equal(results.scripts['lint:peer'], 'npm ls >/dev/null');
  });
});
