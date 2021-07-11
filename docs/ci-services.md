# CI Services

The CI services object defines the supported CI services the user will be
presented with when running the scaffolder.

## Example

```javascript
{
  CIServiceName: {scaffolder: opts => scaffold(opts), public: true}
}
```

## Existing scaffolders
There are already multiple CI service scaffolders [available for
consumption](https://github.com/form8ion/awesome#continuous-integration-services).
Should your workflow fit into those, feel free to integrate them directly. If
not, you are welcome and encouraged to build more (and maybe consider
submitting a PR with a link 😎)!

## Config

### keys: __string__

Keys in the CI services object define the choices the user will be presented
with when choosing their desired CI service. These have no functional impact on
the scaffolder.

example: `CIServiceName`

### values: __object__

Values in the CI services object define the actual plugins and options that will
be used by the JavaScript Scaffolder to scaffold the CI service for the user's
project.

#### scaffolder: __function__ (_required_)

Consumer-provided plugin called when this CI service is selected by the
user in the interactive prompt. Will be called with the following arguments:

* `projectRoot` __string__ full path to the directory where scaffolder will
  create the JavaScript project
* `vcs` __object__
  * `host` __string__ VCS hosting service the repo will be stored in (e.g.,
    `GitHub`)
  * `owner` __string__ account name on the host service for the repository
    (e.g., `form8ion`)
  * `name` __string__ repository name
* `visibility` __string__ visibility of the project to be scaffolded (valid
  values are: `Public`, `Private`)
* `projectType` __string__ type of project to be scaffolded (valid values are:
  `Application`, `Package`, `CLI`)
* `nodeVersionCategory` __string__ category of Node version for the project
  (valid values are: `Latest`, `LTS`)
* `tests` __object__
  * `unit` __boolean__ whether the project will be unit-tested
  * `integration` __boolean__ whether the project will be integration-tested

*Return Value*

The returned object is commonly used across the project as a way for
scaffolders to communicate information to the caller. The following are
currently supported:

* `nextSteps` __array__ list of objects that will be aggregated and displayed
  to the user when all scaffolding is complete. This can be used to remind the
  user about steps that the scaffolder is not able to complete or has not been
  developed, but may be needed before considering scaffolding complete.  (e.g.,
  `['decide whether default dependency automation settings are appropriate']`).
  Each object in the list is the following shape:
  * `summary` __string__ a summary  of the next step
  * `description` __string__ the details of the next step
* `devDependencies` __array__ list of strings defining the package names of dev
  dependencies to be installed into the project (e.g.
  `@travi/travis-lint`)
* `dependencies` __array__ list of strings defining the package names of
  production dependencies to be installed into the project (e.g.  `lodash`)
* `scripts` __object__ an object of scripts to add to the project's
  `package.json`
  * `keys` __string__ the name of the script you would like added to the
    `package.json` (e.g., `'lint:travis'`)
  * `values` __string__ the script to run when called (e.g., `'travis-lint
    .travis.yml'`)
* `badges` __object__
  * `status` __object__ badges to be added to the `status` section of the
    generated top-level README
    * `keys` __string__ name used to identify this badge type (e.g.,
      `github-actions-ci`)
    * `values` __object__
      * `text` __string__ (_required_) text you would like displayed on this
        badge (e.g., `Build Status`)
      * `img` __string__ (_required_) a url to the image for this badge. Each
        CI service has it's own way of handling badging. See [adding a github
        workflow status
        badge](https://docs.github.com/en/free-pro-team@latest/actions/managing-workflow-runs/adding-a-workflow-status-badge)
        for an example.
      * `link` __string__ a url to the build status you would like to navigate
        the user to when the badge is clicked.

#### public: boolean (optional)

Value will be used to determine whether to display this as an option pending
the user's selection of `visibility` in prior prompts.

#### private: boolean (optional)

Value will be used to determine whether to display this as an option pending
the user's selection of `visibility` in prior prompts.
