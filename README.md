![Build status](https://circleci.com/gh/youpers/yp-backend.png?circle-token=:circle-token)

# Youpers Backend Platform


## API Documentation

The API documentation is autogenerated and provided as a Website using tooling from  [swagger](https://developers.helloreverb.com/swagger/).
In order to display the documentation from the locally running Backend during development follow these steps:

- clone this github repo: https://github.com/YouPers/swagger-ui.git
- cd swagger-ui
- node web.js
- open your preferred browser and go to localhost:5000 and enjoy the API documenation.


### Prerequisites:
- you have your local backend running at localhost:8000

In order to see the API documentation of a deployed instance of the backend, you can either use your local swagger-ui (see
above) and just enter the backend-URL in the input-box on top. Or you can use a public swagger site like:
[swagger public](http://petstore.swagger.wordnik.com/) and enter the YouPers Backend-URL into the input box on
top e.g. https://uat.youpers.com/api-docs

## Building and contributing:

### Prerequisites

Installed local mongoDb: http://www.mongodb.org/downloads
Installed nodejs und npm: http://nodejs.org/
Installed grunt cli: npm install -g grunt-cli`

### Getting Started
    git clone https://github.com/YouPers/yp-backend.git
    cd yp-backend
    npm install   // installs all needed software for build system: defined in package.json)



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


### Continuous Deployment to Heroku:

CircleCI automatically deploys this project to Heroku whenever all Tests pass on the CircleCI Server.

Heroku uses:
- "ci" environmont (see config.js) for the master branch, deploys to http://yp-backend-ci.herokuapp.com
- "test" environment (see config.js) for the test branch, deploys to http://yp-backend-test.herokupp.com


## Release History
_(Nothing yet)_

## License
Copyright (c) 2013 YouPers AG
