Feature: Monorepo

  Scenario: Add package to existing monorepo
    Given the project will be a "Package"
    And the package will be added to an existing monorepo
    And the project will be versioned on GitHub
    And the default answers are chosen
    And nvm is properly configured
    When the project is scaffolded
    Then the repository details include the path within the parent project
    And project-level tools are not installed for a sub-project
