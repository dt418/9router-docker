/**
 * commitlint configuration
 * https://commitlint.js.org/
 * 
 * Enforces Conventional Commits format:
 * <type>(<scope>): <subject>
 */

module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Allowed commit types
    'type-enum': [2, 'always', [
      'feat',     // New feature
      'fix',      // Bug fix
      'docs',     // Documentation only
      'style',    // Code style (formatting, semicolons, etc)
      'refactor', // Code change that neither fixes a bug nor adds a feature
      'perf',     // Performance improvement
      'test',     // Adding or correcting tests
      'build',    // Build system or external dependencies
      'ci',       // CI configuration
      'chore',    // Other changes that don't modify src or test files
      'revert',   // Revert a previous commit
      'security', // Security improvement (custom)
    ]],
    
    // Type must be lowercase
    'type-case': [2, 'always', 'lower-case'],
    
    // Type cannot be empty
    'type-empty': [2, 'never'],
    
    // Scope must be lowercase
    'scope-case': [2, 'always', 'lower-case'],
    
    // Subject cannot be empty
    'subject-empty': [2, 'never'],
    
    // Subject cannot end with period
    'subject-full-stop': [2, 'never', '.'],
    
    // Subject cannot start with capital (unless it's a proper noun)
    'subject-case': [0, 'never', ['sentence-case', 'start-case', 'pascal-case', 'upper-case']],
    
    // Header (first line) max length
    'header-max-length': [2, 'always', 100],
    
    // Body leading blank line
    'body-leading-blank': [2, 'always'],
    
    // Footer leading blank line
    'footer-leading-blank': [2, 'always'],
  },
  
  // Custom prompt for commitizen
  prompter: require('cz-conventional-changelog'),
};
