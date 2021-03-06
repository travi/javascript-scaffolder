import sinon from 'sinon';
import any from '@travi/any';
import {assert} from 'chai';
import * as huskyScaffolder from '@form8ion/husky';
import * as commitizenScaffolder from '../config/commitizen';
import * as commitlintScaffolder from './commitlint';
import scaffoldCommitConvention from './index';

suite('commit-convention scaffolder', () => {
  let sandbox;
  const projectRoot = any.string();
  const packageManager = any.word();
  const commitizenScripts = any.simpleObject();
  const commitizenDevDependencies = any.listOf(any.string);
  const huskyScripts = any.simpleObject();
  const huskyDevDependencies = any.listOf(any.string);
  const contributionBadges = {
    'commit-convention': {
      img: 'https://img.shields.io/badge/Conventional%20Commits-1.0.0-yellow.svg',
      text: 'Conventional Commits',
      link: 'https://conventionalcommits.org'
    }
  };

  setup(() => {
    sandbox = sinon.createSandbox();

    sandbox.stub(commitlintScaffolder, 'default');
    sandbox.stub(huskyScaffolder, 'scaffold');
    sandbox.stub(commitizenScaffolder, 'default');

    huskyScaffolder.scaffold
      .withArgs({projectRoot, packageManager})
      .resolves({devDependencies: huskyDevDependencies, scripts: huskyScripts});
    commitizenScaffolder.default
      .withArgs({projectRoot})
      .resolves({devDependencies: commitizenDevDependencies, scripts: commitizenScripts});
  });

  teardown(() => sandbox.restore());

  test('that tools for the commit-convention are not configured for a sub-project', async () => {
    assert.deepEqual(await scaffoldCommitConvention({pathWithinParent: any.string()}), {});
  });

  test('that the convention is configured', async () => {
    const commitlintConfig = any.simpleObject();
    const commitlintDevDependencies = any.listOf(any.string);
    commitlintScaffolder.default
      .withArgs({projectRoot, config: commitlintConfig})
      .resolves({devDependencies: commitlintDevDependencies});

    assert.deepEqual(
      await scaffoldCommitConvention({projectRoot, packageManager, configs: {commitlint: commitlintConfig}}),
      {
        devDependencies: [...commitizenDevDependencies, ...huskyDevDependencies, ...commitlintDevDependencies],
        scripts: {...commitizenScripts, ...huskyScripts},
        vcsIgnore: {files: [], directories: []},
        badges: {contribution: contributionBadges}
      }
    );
  });

  test('that commitlint is not configured if no config is provided', async () => {
    assert.deepEqual(
      await scaffoldCommitConvention({projectRoot, configs: {}, packageManager}),
      {
        devDependencies: [...commitizenDevDependencies, ...huskyDevDependencies],
        scripts: {...commitizenScripts, ...huskyScripts},
        vcsIgnore: {files: [], directories: []},
        badges: {contribution: contributionBadges}
      }
    );
    assert.notCalled(commitlintScaffolder.default);
  });
});
