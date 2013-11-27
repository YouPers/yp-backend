![Build status](https://circleci.com/gh/youpers/yp-backend.png?circle-token=:circle-token)

# Youpers Backend Platform


## Prerequisites

Installed local mongoDb: http://www.mongodb.org/downloads
Installed nodejs und npm: http://nodejs.org/
Installed grunt cli: npm install -g grunt-cli`

## Getting Started
    git clone https://github.com/YouPers/yp-backend.git
    cd yp-backend
    npm install   // installs all needed software for build system: defined in package.json)

## Documentation
### Build commands:

    grunt
tests, compiles and builds the distribution version of the whole project, is used by CI
is executing "grunt jshint", "grunt test"

    grunt server
runs the server, watches all files, restarts a server on filechange on localhost:8000

    grunt test
Starts a server, runs the testsuite once, and stops the server. Used by continuous integration.

    grunt testdebug
Only runs the testsuite once, expects a running server on port 8000, useful when running a server with a running debugger
in the IDE

    grunt servertest
for TDD, starts a server and runs the testsuite, then watches all files an restarts server when needed and reruns
testsuite whenever changes occur


## Continuous Deployment to Heroku:

CircleCI automatically deploys this project to Heroku whenever all Tests pass on the CircleCI Server.

Heroku uses:
- "ci" environmont (see config.js) for the master branch, deploys to http://yp-backend-ci.herokuapp.com
- "test" environment (see config.js) for the test branch, deploys to http://yp-backend-test.herokupp.com

## Examples
_(Coming soon)_

## Contributing
In lieu of a formal styleguide, take care to maintain the existing coding style. Add unit tests for any new or changed functionality. Lint and test your code using [Grunt](http://gruntjs.com/).

## Release History
_(Nothing yet)_

## License
Copyright (c) 2013 YouPers AG
