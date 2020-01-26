import {Given} from 'cucumber';

Given(/^the project will not be tested$/, async function () {
  this.unitTestAnswer = ['n', '\n'];
  this.integrationTestAnswer = ['n', '\n'];
  this.tested = false;
});

Given(/^the project will not be transpiled or linted$/, async function () {
  this.transpilationLintAnswer = ['n', '\n'];
  this.transpileAndLint = false;
});