import inquirer from 'inquirer';
import * as prompts from '@form8ion/overridable-prompts';
import {projectTypes, packageManagers} from '@form8ion/javascript-core';
import * as commonPrompts from '@travi/language-scaffolder-prompts';
import sinon from 'sinon';
import {assert} from 'chai';
import any from '@travi/any';
import * as execa from '../../third-party-wrappers/execa';
import * as npmConf from '../../third-party-wrappers/npm-conf';
import * as validators from './validators';
import * as conditionals from './conditionals';
import * as visibilityFilterForChoices from './filter-by-visibility';
import {prompt} from './questions';
import {questionNames} from './question-names';

suite('prompts', () => {
  let sandbox;
  const commonQuestions = any.listOf(any.simpleObject);
  const decisions = any.simpleObject();
  const vcs = any.simpleObject();
  const pathWithinParent = any.string();
  const ciServices = any.simpleObject();
  const visibility = any.word();
  const answers = any.simpleObject();

  setup(() => {
    sandbox = sinon.createSandbox();

    sandbox.stub(prompts, 'prompt');
    sandbox.stub(npmConf, 'default');
    sandbox.stub(execa, 'default');
    sandbox.stub(validators, 'scope');
    sandbox.stub(conditionals, 'scopePromptShouldBePresentedFactory');
    sandbox.stub(visibilityFilterForChoices, 'default');
    sandbox.stub(commonPrompts, 'questions');

    visibilityFilterForChoices.default.withArgs({}).returns({});
    commonPrompts.questions
      .withArgs({vcs, ciServices, visibility, pathWithinParent: undefined})
      .returns(commonQuestions);
  });

  teardown(() => sandbox.restore());

  test('that the user is prompted for the necessary details', async () => {
    const authorName = any.string();
    const authorEmail = any.string();
    const authorUrl = any.url();
    const npmUser = any.word();
    const get = sinon.stub();
    const filteredCiServiceNames = any.listOf(any.word);
    const filteredCiServices = any.objectWithKeys(filteredCiServiceNames);
    const hosts = any.simpleObject();
    const scopeValidator = () => undefined;
    const scopePromptShouldBePresented = () => undefined;
    npmConf.default.returns({get});
    execa.default.withArgs('npm', ['whoami']).resolves({stdout: npmUser});
    get.withArgs('init.author.name').returns(authorName);
    get.withArgs('init.author.email').returns(authorEmail);
    get.withArgs('init.author.url').returns(authorUrl);
    validators.scope.withArgs(visibility).returns(scopeValidator);
    conditionals.scopePromptShouldBePresentedFactory.withArgs(visibility).returns(scopePromptShouldBePresented);
    visibilityFilterForChoices.default.withArgs(ciServices, visibility).returns(filteredCiServices);
    prompts.prompt
      .withArgs([
        {
          name: questionNames.NODE_VERSION_CATEGORY,
          message: 'What node.js version should be used?',
          type: 'list',
          choices: ['LTS', 'Latest'],
          default: 'LTS'
        },
        {
          name: questionNames.PACKAGE_MANAGER,
          message: 'Which package manager will be used with this project?',
          type: 'list',
          choices: Object.values(packageManagers),
          default: packageManagers.NPM
        },
        {
          name: questionNames.PROJECT_TYPE,
          message: 'What type of JavaScript project is this?',
          type: 'list',
          choices: Object.values(projectTypes),
          default: projectTypes.PACKAGE
        },
        {
          name: questionNames.SHOULD_BE_SCOPED,
          message: 'Should this package be scoped?',
          type: 'confirm',
          when: conditionals.shouldBeScopedPromptShouldBePresented,
          default: true
        },
        {
          name: questionNames.SCOPE,
          message: 'What is the scope?',
          when: scopePromptShouldBePresented,
          validate: scopeValidator,
          default: npmUser
        },
        {
          name: questionNames.AUTHOR_NAME,
          message: 'What is the author\'s name?',
          default: authorName
        },
        {
          name: questionNames.AUTHOR_EMAIL,
          message: 'What is the author\'s email?',
          default: authorEmail
        },
        {
          name: questionNames.AUTHOR_URL,
          message: 'What is the author\'s website url?',
          default: authorUrl
        },
        ...commonQuestions,
        {
          name: questionNames.TRANSPILE_LINT,
          message: 'Will there be source code that should be transpiled or linted?',
          type: 'confirm',
          when: conditionals.transpilationAndLintingPromptShouldBePresented
        },
        {
          name: questionNames.HOST,
          type: 'list',
          message: 'Where will the application be hosted?',
          when: conditionals.projectIsApplication,
          choices: [...Object.keys(hosts), new inquirer.Separator(), 'Other']
        }
      ], decisions)
      .resolves(answers);

    assert.deepEqual(
      await prompt({}, ciServices, hosts, visibility, vcs, decisions),
      {...answers, [questionNames.TRANSPILE_LINT]: true}
    );
  });

  test('that the transpile/lint value is not overriden when set to `false`', async () => {
    const npmUser = any.word();
    const get = sinon.stub();
    npmConf.default.returns({get});
    execa.default.withArgs('npm', ['whoami']).resolves({stdout: npmUser});
    prompts.prompt.resolves({...answers, [questionNames.TRANSPILE_LINT]: false});

    assert.deepEqual(
      await prompt({}, ciServices, {}, visibility, vcs, decisions),
      {...answers, [questionNames.TRANSPILE_LINT]: false}
    );
  });

  test('that defaults are overridden by the provided options', async () => {
    const npmAccount = any.word();
    const author = {name: any.string(), email: any.string(), url: any.url()};
    const get = sinon.stub();
    npmConf.default.returns({get});
    prompts.prompt.resolves(answers);

    await prompt({npmAccount, author}, ciServices, {}, visibility, vcs);

    assert.calledWith(
      prompts.prompt,
      sinon.match(value => 1 === value.filter((
        question => questionNames.SCOPE === question.name && npmAccount === question.default
      )).length)
    );
    assert.calledWith(
      prompts.prompt,
      sinon.match(value => 1 === value.filter((
        question => questionNames.AUTHOR_NAME === question.name && author.name === question.default
      )).length)
    );
    assert.calledWith(
      prompts.prompt,
      sinon.match(value => 1 === value.filter((
        question => questionNames.AUTHOR_EMAIL === question.name && author.email === question.default
      )).length)
    );
    assert.calledWith(
      prompts.prompt,
      sinon.match(value => 1 === value.filter((
        question => questionNames.AUTHOR_URL === question.name && author.url === question.default
      )).length)
    );
  });

  test('that sub-projects are not asked about node version since the parent project already defines', async () => {
    execa.default.withArgs('npm', ['whoami']).resolves({stdout: any.word()});
    npmConf.default.returns({get: () => undefined});
    commonPrompts.questions
      .withArgs({vcs, ciServices, visibility: 'Private', pathWithinParent})
      .returns(commonQuestions);
    prompts.prompt.resolves(answers);

    await prompt({}, ciServices, {}, 'Private', vcs, null, pathWithinParent);

    assert.neverCalledWith(
      prompts.prompt,
      sinon.match(value => 1 === value.filter(question => questionNames.NODE_VERSION_CATEGORY === question.name).length)
    );
  });

  test('that private packages are not asked about whether they should be scoped', async () => {
    execa.default.withArgs('npm', ['whoami']).resolves({stdout: any.word()});
    npmConf.default.returns({get: () => undefined});
    commonPrompts.questions
      .withArgs({vcs, ciServices, visibility: 'Private', pathWithinParent})
      .returns(commonQuestions);
    prompts.prompt.resolves(answers);

    await prompt({}, ciServices, {}, 'Private', vcs, null, pathWithinParent);

    assert.neverCalledWith(
      prompts.prompt,
      sinon.match(value => 1 === value.filter(question => questionNames.SHOULD_BE_SCOPED === question.name).length)
    );
  });

  test('that no logged-in-user is handled gracefully', async () => {
    execa.default.withArgs('npm', ['whoami']).rejects();
    npmConf.default.returns({get: () => undefined});
    commonPrompts.questions
      .withArgs({vcs, ciServices, visibility: 'Public', pathWithinParent})
      .returns(commonQuestions);
    prompts.prompt.resolves(answers);

    await prompt({}, ciServices, {}, 'Public', vcs, null, pathWithinParent);

    assert.calledWith(
      prompts.prompt,
      sinon.match(value => 1 === value.filter(question => questionNames.SHOULD_BE_SCOPED === question.name).length)
    );
  });
});
