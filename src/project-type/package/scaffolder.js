import {copyFile} from 'mz/fs';
import {info} from '@travi/cli-messages';
import determinePathToTemplateFile from '../../template-path';
import defineBadges from './badges';

const defaultBuildDirectory = './lib';

export default async function ({projectRoot, transpileLint, packageName, visibility}) {
  info('Scaffolding Package Details');

  if (false !== transpileLint) {
    const coreBadges = defineBadges(packageName, visibility);

    await copyFile(determinePathToTemplateFile('rollup.config.js'), `${projectRoot}/rollup.config.js`);

    return {
      devDependencies: ['rimraf', 'rollup', 'rollup-plugin-auto-external'],
      scripts: {
        clean: `rimraf ${defaultBuildDirectory}`,
        prebuild: 'run-s clean',
        build: 'npm-run-all --print-label --parallel build:*',
        'build:js': 'rollup --config',
        watch: 'run-s \'build:js -- --watch\'',
        prepack: 'run-s build'
      },
      vcsIgnore: {
        files: [],
        directories: ['/lib/']
      },
      buildDirectory: defaultBuildDirectory,
      badges: {
        consumer: {
          ...coreBadges.consumer,
          ...'Public' === visibility && {
            runkit: {
              img: `https://badge.runkitcdn.com/${packageName}.svg`,
              text: `Try ${packageName} on RunKit`,
              link: `https://npm.runkit.com/${packageName}`
            }
          }
        },
        contribution: coreBadges.contribution,
        status: coreBadges.status
      }
    };
  }

  return {
    devDependencies: [],
    scripts: {},
    vcsIgnore: {files: [], directories: []},
    badges: defineBadges(packageName, visibility)
  };
}