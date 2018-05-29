import path from 'path';
import fs from 'mz/fs';
import {assert} from 'chai';
import any from '@travi/any';
import sinon from 'sinon';
import * as prompts from '../../src/prompts';
import * as packageBuilder from '../../src/package';
import * as installer from '../../src/install';
import * as exec from '../../third-party-wrappers/exec-as-promised';
import * as mkdir from '../../third-party-wrappers/make-dir';
import * as validator from '../../src/options-validator';
import {scaffold} from '../../src/scaffolder';

suite('javascript project scaffolder', () => {
  let sandbox;
  const options = any.simpleObject();
  const projectRoot = any.string();
  const projectName = any.string();
  const visibility = any.fromList(['Private', 'Public']);
  const ltsVersion = `v${any.integer()}.${any.integer()}.${any.integer()}`;
  const latestVersion = `v${any.integer()}.${any.integer()}.${any.integer()}`;

  setup(() => {
    sandbox = sinon.createSandbox();

    sandbox.stub(fs, 'writeFile');
    sandbox.stub(fs, 'copyFile');
    sandbox.stub(packageBuilder, 'default');
    sandbox.stub(installer, 'default');
    sandbox.stub(exec, 'default');
    sandbox.stub(prompts, 'prompt');
    sandbox.stub(mkdir, 'default');
    sandbox.stub(validator, 'validate');

    fs.writeFile.resolves();
    fs.copyFile.resolves();
    exec.default
      .withArgs('. ~/.nvm/nvm.sh && nvm ls-remote')
      .resolves([...any.listOf(any.word), latestVersion, ''].join('\n'));
    exec.default
      .withArgs('. ~/.nvm/nvm.sh && nvm ls-remote --lts')
      .resolves([...any.listOf(any.word), ltsVersion, ''].join('\n'));
    packageBuilder.default.returns({});
  });

  teardown(() => sandbox.restore());

  suite('config files', () => {
    test('that config files are created', () => {
      const babelPresetName = any.string();
      validator.validate
        .withArgs(options)
        .returns({visibility, projectRoot, vcs: {}, configs: {babelPreset: {name: babelPresetName}}});

      prompts.prompt.resolves({[prompts.questionNames.NODE_VERSION_CATEGORY]: any.word()});

      return scaffold(options).then(() => {
        assert.calledWith(
          fs.copyFile,
          path.resolve(__dirname, '../../', 'templates', 'huskyrc.json'),
          `${projectRoot}/.huskyrc.json`
        );
        assert.calledWith(
          fs.copyFile,
          path.resolve(__dirname, '../../', 'templates', 'nycrc.json'),
          `${projectRoot}/.nycrc`
        );
        assert.calledWith(fs.writeFile, `${projectRoot}/.babelrc`, JSON.stringify({presets: [babelPresetName]}));
      });
    });

    suite('npm ignore', () => {
      test('that files and directories are defined to be ignored from the published npm package', async () => {
        validator.validate
          .withArgs(options)
          .returns({projectRoot, projectName, visibility: 'Public', vcs: {}, configs: {}});
        prompts.prompt.resolves({
          [prompts.questionNames.NODE_VERSION_CATEGORY]: any.word(),
          [prompts.questionNames.PACKAGE_TYPE]: 'Package'
        });

        await scaffold(options);

        assert.calledWith(
          fs.writeFile,
          `${projectRoot}/.npmignore`,
          sinon.match(`/src/
/test/
/coverage/
/.nyc_output/

.babelrc
.commitlintrc.js
.editorconfig
.eslintcache
.eslintignore
.eslintrc.yml
.gitattributes
.huskyrc.json
.markdownlintrc
.nvmrc
coverage.lcov
rollup.config.js`)
        );
      });

      test('that the travis config is ignored when travis is the ci service', async () => {
        validator.validate
          .withArgs(options)
          .returns({projectRoot, projectName, visibility: 'Public', ci: 'Travis', vcs: {}, configs: {}});
        prompts.prompt.resolves({
          [prompts.questionNames.NODE_VERSION_CATEGORY]: any.word(),
          [prompts.questionNames.PACKAGE_TYPE]: 'Package'
        });
        packageBuilder.default.returns({});

        await scaffold(options);

        assert.calledWith(
          fs.writeFile,
          `${projectRoot}/.npmignore`,
          sinon.match(`
.travis.yml
`)
        );
      });

      test('that the github settings file is ignored when github is the vcs host', async () => {
        validator.validate
          .withArgs(options)
          .returns({projectRoot, projectName, visibility: 'Public', vcs: {host: 'GitHub'}, configs: {}});
        prompts.prompt.resolves({
          [prompts.questionNames.NODE_VERSION_CATEGORY]: any.word(),
          [prompts.questionNames.PACKAGE_TYPE]: 'Package'
        });
        packageBuilder.default.returns({});

        await scaffold(options);

        assert.calledWith(
          fs.writeFile,
          `${projectRoot}/.npmignore`,
          sinon.match(`
/.github/
`)
        );
      });

      test('that no npm ignore file is generated for non-packages', async () => {
        validator.validate
          .withArgs(options)
          .returns({projectRoot, projectName, visibility: 'Public', vcs: {}, configs: {}});
        prompts.prompt.resolves({
          [prompts.questionNames.NODE_VERSION_CATEGORY]: any.word(),
          [prompts.questionNames.PACKAGE_TYPE]: any.word()
        });

        await scaffold(options);

        assert.neverCalledWith(fs.writeFile, `${projectRoot}/.npmignore`);
      });
    });

    suite('unit test', () => {
      test('that a canary test is included when the project will be unit tested', async () => {
        const pathToCreatedDirectory = any.string();
        validator.validate.withArgs(options).returns({projectRoot, vcs: {}, configs: {}});
        prompts.prompt.resolves({
          [prompts.questionNames.NODE_VERSION_CATEGORY]: any.word(),
          [prompts.questionNames.UNIT_TESTS]: true
        });
        mkdir.default.withArgs(`${projectRoot}/test/unit`).resolves(pathToCreatedDirectory);

        await scaffold(options);

        assert.calledWith(
          fs.copyFile,
          path.resolve(__dirname, '../../', 'templates', 'canary-test.txt'),
          `${pathToCreatedDirectory}/canary-test.js`
        );
        assert.calledWith(
          fs.copyFile,
          path.resolve(__dirname, '../../', 'templates', 'mocha.opts'),
          `${pathToCreatedDirectory}/../mocha.opts`
        );
      });

      test('that a canary test is not included when the project will be not unit tested', async () => {
        validator.validate.withArgs(options).returns({projectRoot, vcs: {}, configs: {}});
        prompts.prompt.resolves({
          [prompts.questionNames.NODE_VERSION_CATEGORY]: any.word(),
          [prompts.questionNames.UNIT_TESTS]: false
        });

        await scaffold(options);

        assert.neverCalledWith(mkdir.default, `${projectRoot}/test/unit`);
        assert.neverCalledWith(fs.copyFile, path.resolve(__dirname, '../../', 'templates', 'canary-test.txt'));
        assert.neverCalledWith(fs.copyFile, path.resolve(__dirname, '../../', 'templates', 'mocha.opts'));
      });
    });

    suite('eslint', () => {
      const eslintConfigPrefix = any.string();

      test('that the base config is added to the root of the project if the config prefix is provided', async () => {
        validator.validate
          .withArgs(options)
          .returns({projectRoot, vcs: {}, configs: {eslint: {prefix: eslintConfigPrefix}}});
        prompts.prompt.resolves({
          [prompts.questionNames.NODE_VERSION_CATEGORY]: any.word(),
          [prompts.questionNames.UNIT_TESTS]: false
        });

        await scaffold(options);

        assert.calledWith(fs.writeFile, `${projectRoot}/.eslintrc.yml`, `extends: '${eslintConfigPrefix}/rules/es6'`);
        assert.neverCalledWith(fs.writeFile, `${projectRoot}/test/.eslintrc.yml`);
        assert.neverCalledWith(fs.writeFile, `${projectRoot}/test/unit/.eslintrc.yml`);
      });

      test(
        'that the test config is added if the config prefix is provided and the project will be unit tested',
        async () => {
          validator.validate
            .withArgs(options)
            .returns({projectRoot, vcs: {}, configs: {eslint: {prefix: eslintConfigPrefix}}});
          prompts.prompt.resolves({
            [prompts.questionNames.NODE_VERSION_CATEGORY]: any.word(),
            [prompts.questionNames.UNIT_TESTS]: true
          });
          mkdir.default.resolves();

          await scaffold(options);

          assert.calledWith(
            fs.writeFile,
            `${projectRoot}/test/.eslintrc.yml`,
            `extends: '${eslintConfigPrefix}/rules/tests/base'`
          );
          assert.calledWith(
            fs.writeFile,
            `${projectRoot}/test/unit/.eslintrc.yml`,
            `extends: '${eslintConfigPrefix}/rules/tests/mocha'`
          );
        }
      );

      test('that the no config is added if the config prefix is not provided', async () => {
        validator.validate.withArgs(options).returns({projectRoot, vcs: {}, configs: {}});
        prompts.prompt.resolves({
          [prompts.questionNames.NODE_VERSION_CATEGORY]: any.word(),
          [prompts.questionNames.UNIT_TESTS]: true
        });
        mkdir.default.resolves();

        await scaffold(options);

        assert.neverCalledWith(fs.writeFile, `${projectRoot}/.eslintrc.yml`);
        assert.neverCalledWith(fs.writeFile, `${projectRoot}/.eslintignore`);
        assert.neverCalledWith(fs.writeFile, `${projectRoot}/test/.eslintrc.yml`);
        assert.neverCalledWith(fs.writeFile, `${projectRoot}/test/unit/.eslintrc.yml`);
      });

      suite('eslint-ignore', () => {
        test('that non-source files are excluded from linting', async () => {
          validator.validate
            .withArgs(options)
            .returns({projectRoot, vcs: {}, configs: {eslint: {prefix: eslintConfigPrefix}}});
          prompts.prompt.resolves({
            [prompts.questionNames.NODE_VERSION_CATEGORY]: any.word(),
            [prompts.questionNames.UNIT_TESTS]: false
          });

          await scaffold(options);

          assert.calledWith(fs.writeFile, `${projectRoot}/.eslintignore`, sinon.match('/lib/'));
          assert.neverCalledWith(fs.writeFile, `${projectRoot}/.eslintignore`, sinon.match('/coverage/'));
        });

        test('that the coverage folder is excluded from linting when the project is unit tested', async () => {
          validator.validate
            .withArgs(options)
            .returns({projectRoot, vcs: {}, configs: {eslint: {prefix: eslintConfigPrefix}}});
          prompts.prompt.resolves({
            [prompts.questionNames.NODE_VERSION_CATEGORY]: any.word(),
            [prompts.questionNames.UNIT_TESTS]: true
          });
          mkdir.default.resolves();

          await scaffold(options);

          assert.calledWith(
            fs.writeFile,
            `${projectRoot}/.eslintignore`,
            sinon.match(`
/coverage/`)
          );
        });
      });
    });

    suite('commitlint', () => {
      const commitlintConfigPrefix = any.word();

      test('that the config is added to the root of the project if the package is defined', async () => {
        validator.validate
          .withArgs(options)
          .returns({projectRoot, vcs: {}, configs: {commitlint: {name: commitlintConfigPrefix}}});
        prompts.prompt.resolves({[prompts.questionNames.NODE_VERSION_CATEGORY]: any.word()});

        await scaffold(options);

        assert.calledWith(
          fs.writeFile,
          `${projectRoot}/.commitlintrc.js`,
          `module.exports = {extends: ['${commitlintConfigPrefix}']};`
        );
      });

      test('that the config is not added to the root of the project if the package is not defined', async () => {
        validator.validate.withArgs(options).returns({projectRoot, vcs: {}, configs: {}});
        prompts.prompt.resolves({[prompts.questionNames.NODE_VERSION_CATEGORY]: any.word()});

        await scaffold(options);

        assert.neverCalledWith(fs.writeFile, `${projectRoot}/.commitlintrc.js`);
      });
    });

    suite('build', () => {
      suite('application', () => {
        test('that rollup is not configured', async () => {
          validator.validate.withArgs(options).returns({visibility, projectRoot, vcs: {}, configs: {}});
          prompts.prompt.resolves({
            [prompts.questionNames.NODE_VERSION_CATEGORY]: any.word(),
            [prompts.questionNames.PACKAGE_TYPE]: 'Application'
          });

          await scaffold(options);

          assert.neverCalledWith(fs.copyFile, path.resolve(__dirname, '../../', 'templates', 'rollup.config.js'));
        });
      });

      suite('package', () => {
        test('that the package gets bundled with rollup', async () => {
          validator.validate.withArgs(options).returns({visibility, projectRoot, vcs: {}, configs: {}});
          prompts.prompt.resolves({
            [prompts.questionNames.NODE_VERSION_CATEGORY]: any.word(),
            [prompts.questionNames.PACKAGE_TYPE]: 'Package'
          });

          await scaffold(options);

          assert.calledWith(
            fs.copyFile,
            path.resolve(__dirname, '../../', 'templates', 'rollup.config.js'),
            `${projectRoot}/rollup.config.js`
          );
        });
      });
    });
  });

  suite('package', () => {
    test('that the package file is defined', () => {
      const packageDetails = any.simpleObject();
      const scope = any.word();
      const packageType = any.word();
      const license = any.string();
      const tests = {unit: any.boolean(), integration: any.boolean()};
      const vcs = any.simpleObject();
      const authorName = any.string();
      const authorEmail = any.string();
      const authorUrl = any.url();
      const ci = any.word();
      const description = any.sentence();
      validator.validate
        .withArgs(options)
        .returns({projectRoot, projectName, visibility, license, vcs, ci, description, configs: {}});
      prompts.prompt.resolves({
        [prompts.questionNames.SCOPE]: scope,
        [prompts.questionNames.PACKAGE_TYPE]: packageType,
        [prompts.questionNames.UNIT_TESTS]: tests.unit,
        [prompts.questionNames.INTEGRATION_TESTS]: tests.integration,
        [prompts.questionNames.NODE_VERSION_CATEGORY]: any.word(),
        [prompts.questionNames.AUTHOR_NAME]: authorName,
        [prompts.questionNames.AUTHOR_EMAIL]: authorEmail,
        [prompts.questionNames.AUTHOR_URL]: authorUrl
      });
      packageBuilder.default
        .withArgs({
          projectName,
          visibility,
          scope,
          packageType,
          license,
          tests,
          vcs,
          author: {name: authorName, email: authorEmail, url: authorUrl},
          ci,
          description
        })
        .returns(packageDetails);
      mkdir.default.resolves();

      return scaffold(options).then(() => assert.calledWith(
        fs.writeFile,
        `${projectRoot}/package.json`,
        JSON.stringify(packageDetails)
      ));
    });

    suite('dependencies', () => {
      const defaultDependencies = [
        'npm-run-all',
        'husky@next',
        'cz-conventional-changelog',
        'greenkeeper-lockfile',
        'nyc',
        'babel-register'
      ];

      suite('scripts', () => {
        test('that scripting tools are installed', async () => {
          validator.validate.withArgs(options).returns({vcs: {}, configs: {}});
          prompts.prompt.resolves({[prompts.questionNames.NODE_VERSION_CATEGORY]: any.word()});

          await scaffold(options);

          assert.calledWith(installer.default, [...defaultDependencies]);
        });

        test('that the appropriate packages are installed for `Package` type projects', async () => {
          validator.validate.withArgs(options).returns({vcs: {}, configs: {}});
          prompts.prompt.resolves({
            [prompts.questionNames.NODE_VERSION_CATEGORY]: any.word(),
            [prompts.questionNames.PACKAGE_TYPE]: 'Package'
          });

          await scaffold(options);

          assert.calledWith(installer.default, [...defaultDependencies, 'rimraf', 'rollup']);
        });
      });

      suite('lint', () => {
        const eslintConfigName = any.string();
        const commitlintConfigName = any.string();

        test('that the eslint config is installed when defined', async () => {
          const overrides = any.simpleObject();
          validator.validate
            .withArgs(options)
            .returns({vcs: {}, configs: {eslint: {packageName: eslintConfigName}}, overrides});
          prompts.prompt.withArgs(overrides).resolves({[prompts.questionNames.NODE_VERSION_CATEGORY]: any.word()});

          await scaffold(options);

          assert.calledWith(installer.default, [eslintConfigName, ...defaultDependencies]);
        });

        test('that the commitlint config is installed when defined', async () => {
          const overrides = any.simpleObject();
          validator.validate
            .withArgs(options)
            .returns({vcs: {}, configs: {commitlint: {packageName: commitlintConfigName}}, overrides});
          prompts.prompt.withArgs(overrides).resolves({[prompts.questionNames.NODE_VERSION_CATEGORY]: any.word()});

          await scaffold(options);

          assert.calledWith(installer.default, [commitlintConfigName, ...defaultDependencies]);
        });
      });

      suite('babel', () => {
        const babelPresetName = any.string();

        test('that the babel-preset is installed when defined', async () => {
          const overrides = any.simpleObject();
          validator.validate
            .withArgs(options)
            .returns({vcs: {}, configs: {babelPreset: {packageName: babelPresetName}}, overrides});
          prompts.prompt.withArgs(overrides).resolves({[prompts.questionNames.NODE_VERSION_CATEGORY]: any.word()});

          await scaffold(options);

          assert.calledWith(installer.default, [babelPresetName, ...defaultDependencies]);
        });
      });

      suite('testing', () => {
        test('that mocha, chai, and sinon are installed when the project will be unit tested', async () => {
          validator.validate.withArgs(options).returns({vcs: {}, configs: {}});
          prompts.prompt.resolves({
            [prompts.questionNames.NODE_VERSION_CATEGORY]: any.word(),
            [prompts.questionNames.UNIT_TESTS]: true
          });
          mkdir.default.resolves();

          await scaffold(options);

          assert.calledWith(installer.default, [...defaultDependencies, 'mocha', 'chai', 'sinon']);
        });

        test('that mocha, chai, and sinon are not installed when the project will not be unit tested', async () => {
          validator.validate.withArgs(options).returns({vcs: {}, configs: {}});
          prompts.prompt.resolves({
            [prompts.questionNames.NODE_VERSION_CATEGORY]: any.word(),
            [prompts.questionNames.UNIT_TESTS]: false
          });

          await scaffold(options);

          assert.calledWith(installer.default, [...defaultDependencies]);
        });

        test('that cucumber and chai are installed when the project will be integration tested', async () => {
          validator.validate.withArgs(options).returns({vcs: {}, configs: {}});
          prompts.prompt.resolves({
            [prompts.questionNames.NODE_VERSION_CATEGORY]: any.word(),
            [prompts.questionNames.INTEGRATION_TESTS]: true
          });

          await scaffold(options);

          assert.calledWith(installer.default, [...defaultDependencies, 'cucumber', 'chai']);
        });

        test('that cucumber and chai are not installed when the project will not be integration tested', async () => {
          validator.validate.withArgs(options).returns({vcs: {}, configs: {}});
          prompts.prompt.resolves({
            [prompts.questionNames.NODE_VERSION_CATEGORY]: any.word(),
            [prompts.questionNames.INTEGRATION_TESTS]: false
          });

          await scaffold(options);

          assert.calledWith(installer.default, [...defaultDependencies]);
        });

        test('that unique dependencies are requested when various reasons overlap', async () => {
          validator.validate.withArgs(options).returns({vcs: {}, configs: {}});
          prompts.prompt.resolves({
            [prompts.questionNames.NODE_VERSION_CATEGORY]: any.word(),
            [prompts.questionNames.UNIT_TESTS]: true,
            [prompts.questionNames.INTEGRATION_TESTS]: true
          });
          mkdir.default.resolves();

          await scaffold(options);

          assert.calledWith(installer.default, [...defaultDependencies, 'mocha', 'chai', 'sinon', 'cucumber']);
        });

        test('that codecov is installed for public projects', async () => {
          validator.validate.withArgs(options).returns({visibility: 'Public', vcs: {}, configs: {}});
          prompts.prompt.resolves({[prompts.questionNames.NODE_VERSION_CATEGORY]: any.word()});

          await scaffold(options);

          assert.calledWith(installer.default, [...defaultDependencies, 'codecov']);
        });

        test('that codecov is not installed for private projects', async () => {
          validator.validate.withArgs(options).returns({visibility: 'Private', vcs: {}, configs: {}});
          prompts.prompt.resolves({[prompts.questionNames.NODE_VERSION_CATEGORY]: any.word()});

          await scaffold(options);

          assert.calledWith(installer.default, defaultDependencies);
        });
      });
    });
  });

  suite('save-exact', () => {
    test('that the project is configured to use exact dependency versions if it is an application', () => {
      const overrides = any.simpleObject();
      validator.validate
        .withArgs(options)
        .returns({projectRoot, projectName, visibility: 'Public', vcs: {}, configs: {}, overrides});
      prompts.prompt.withArgs(overrides).resolves({
        [prompts.questionNames.NODE_VERSION_CATEGORY]: any.word(),
        [prompts.questionNames.PACKAGE_TYPE]: 'Application'
      });

      return scaffold(options).then(() => assert.calledWith(fs.writeFile, `${projectRoot}/.npmrc`, 'save-exact=true'));
    });

    test('that the project is allowed to use semver ranges if it is a package', () => {
      packageBuilder.default.returns({name: any.word()});
      validator.validate
        .withArgs(options)
        .returns({projectRoot, projectName, visibility: 'Public', vcs: {}, configs: {}});
      prompts.prompt.resolves({
        [prompts.questionNames.NODE_VERSION_CATEGORY]: any.word(),
        [prompts.questionNames.PACKAGE_TYPE]: 'Package'
      });

      return scaffold(options).then(() => assert.neverCalledWith(fs.writeFile, `${projectRoot}/.npmrc`));
    });
  });

  suite('nvm', () => {
    test('that the latest available version is used for the project when `Latest` is chosen', () => {
      validator.validate
        .withArgs(options)
        .returns({projectRoot, projectName, visibility: 'Public', vcs: {}, configs: {}});
      prompts.prompt.resolves({[prompts.questionNames.NODE_VERSION_CATEGORY]: 'Latest'});

      return scaffold(options).then(() => {
        assert.calledWith(fs.writeFile, `${projectRoot}/.nvmrc`, latestVersion);
        assert.calledWith(exec.default, '. ~/.nvm/nvm.sh && nvm install', {silent: false});
      });
    });

    test('that the latest available version is used for the project when `LTS` is chosen', () => {
      validator.validate
        .withArgs(options)
        .returns({projectRoot, projectName, visibility: 'Public', vcs: {}, configs: {}});
      prompts.prompt.resolves({[prompts.questionNames.NODE_VERSION_CATEGORY]: 'LTS'});

      return scaffold(options).then(() => {
        assert.calledWith(fs.writeFile, `${projectRoot}/.nvmrc`, ltsVersion);
        assert.calledWith(exec.default, '. ~/.nvm/nvm.sh && nvm install', {silent: false});
      });
    });
  });

  suite('data passed downstream', () => {
    suite('badges', () => {
      test('that the npm badge is defined for public packages', async () => {
        const packageName = any.word();
        packageBuilder.default.returns({name: packageName});
        validator.validate
          .withArgs(options)
          .returns({projectRoot, projectName, visibility: 'Public', vcs: {}, configs: {}});
        prompts.prompt.resolves({
          [prompts.questionNames.NODE_VERSION_CATEGORY]: any.word(),
          [prompts.questionNames.PACKAGE_TYPE]: 'Package'
        });

        const {badges} = await scaffold(options);

        assert.deepEqual(badges.consumer.npm, {
          img: `https://img.shields.io/npm/v/${packageName}.svg`,
          text: 'npm',
          link: `https://www.npmjs.com/package/${packageName}`
        });
      });

      test('that the npm badge is not defined for private packages', async () => {
        validator.validate
          .withArgs(options)
          .returns({projectRoot, projectName, visibility: 'Private', vcs: {}, configs: {}});
        prompts.prompt.resolves({
          [prompts.questionNames.NODE_VERSION_CATEGORY]: any.word(),
          [prompts.questionNames.PACKAGE_TYPE]: 'Package'
        });

        const {badges} = await scaffold(options);

        assert.isUndefined(badges.consumer.npm);
      });

      test('that the npm badge is not defined if the project is not a package', async () => {
        validator.validate
          .withArgs(options)
          .returns({projectRoot, projectName, visibility: 'Public', vcs: {}, configs: {}});
        prompts.prompt.resolves({
          [prompts.questionNames.NODE_VERSION_CATEGORY]: any.word(),
          [prompts.questionNames.PACKAGE_TYPE]: any.word()
        });

        const {badges} = await scaffold(options);

        assert.isUndefined(badges.consumer.npm);
      });

      test('that the commit-convention badges are provided', async () => {
        const packageName = any.word();
        validator.validate.withArgs(options).returns({projectRoot, projectName, vcs: {}, configs: {}});
        packageBuilder.default.returns({name: packageName});
        prompts.prompt.resolves({[prompts.questionNames.NODE_VERSION_CATEGORY]: any.word()});

        const {badges} = await scaffold(options);

        assert.deepEqual(badges.contribution['commit-convention'], {
          img: 'https://img.shields.io/badge/Conventional%20Commits-1.0.0-yellow.svg',
          text: 'Conventional Commits',
          link: 'https://conventionalcommits.org'
        });
        assert.deepEqual(badges.contribution.commitizen, {
          img: 'https://img.shields.io/badge/commitizen-friendly-brightgreen.svg',
          text: 'Commitizen friendly',
          link: 'http://commitizen.github.io/cz-cli/'
        });
      });
    });

    suite('vcs ignore', () => {
      test('that files and directories are defined to be ignored from version control', async () => {
        validator.validate
          .withArgs(options)
          .returns({projectRoot, projectName, visibility: 'Public', vcs: {}, configs: {}});
        prompts.prompt.resolves({[prompts.questionNames.NODE_VERSION_CATEGORY]: any.word()});

        const {vcsIgnore} = await scaffold(options);

        assert.include(vcsIgnore.files, '.eslintcache');

        assert.include(vcsIgnore.directories, '/node_modules/');
        assert.include(vcsIgnore.directories, '/lib/');
        assert.include(vcsIgnore.directories, '/coverage/');
        assert.include(vcsIgnore.directories, '/.nyc_output/');
      });
    });

    suite('verification', () => {
      test('that `npm test` is defined as the verification command', async () => {
        validator.validate
          .withArgs(options)
          .returns({projectRoot, projectName, visibility: any.word(), vcs: {}, configs: {}});
        prompts.prompt.resolves({[prompts.questionNames.NODE_VERSION_CATEGORY]: any.word()});

        const {verificationCommand} = await scaffold(options);

        assert.equal(verificationCommand, 'npm test');
      });
    });

    suite('project details', () => {
      test('that details are passed along', async () => {
        const homepage = any.url();
        validator.validate
          .withArgs(options)
          .returns({projectRoot, projectName, visibility: any.word(), vcs: {}, configs: {}});
        prompts.prompt.resolves({[prompts.questionNames.NODE_VERSION_CATEGORY]: any.word()});
        packageBuilder.default.returns({homepage});

        const {projectDetails} = await scaffold(options);

        assert.equal(projectDetails.homepage, homepage);
      });

      test('that details are not passed along if not defined', async () => {
        validator.validate
          .withArgs(options)
          .returns({projectRoot, projectName, visibility: any.word(), vcs: {}, configs: {}});
        prompts.prompt.resolves({[prompts.questionNames.NODE_VERSION_CATEGORY]: any.word()});
        packageBuilder.default.returns({});

        const {projectDetails} = await scaffold(options);

        assert.isUndefined(projectDetails.homepage);
      });
    });
  });
});
