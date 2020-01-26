import {prompt, Separator} from 'inquirer';

export default async function ({types, projectType}) {
  if (!Object.keys(types).length) return 'Other';

  const answers = await prompt([{
    name: 'type',
    type: 'list',
    message: `What type of ${projectType} is this?`,
    choices: [...Object.keys(types), new Separator(), 'Other']
  }]);

  return answers.type;
}