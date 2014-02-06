Unit testing the YP-Backend
===========================

To ensure quality of our backend implementation we use a thorough unit testing approach.

## Test types

We support two different types of backend unittests:

### API tests

using frisby.js and node-jasmine. We call our public API and inspect the answers. These tests are blackbox tests and
 should stand whenever the implementation of the backend is refactored or moved to a different technology. These
 tests run outside the node.js server in a different node.js process than the server.

Important: All frisby.js test calls to the backend need to include authentication as if this was a real call. Only for
calls that are anonymous in real life, the frisby.auth(username, password) can be omitted.

### Classical Unit-Tests using node-jasmine.

For specific classes/functions we write specific unittests that are  executed as classical jasmine unittests.
These tests are expected to change when the internal structure of our backend changes.


## Data available in Unittest

### Users

On all development and test environments the following test users are available.

username            password        role            email

test_ind1           yp              individual      ypunittest1+individual1@gmail.com
test_ind2           yp              individual      ypunittest1+individual2@gmail.com
test_ind1           yp              individual      ypunittest1+individual3@gmail.com
test_orgadm         yp              orgadmin        ypunittest1+orgadmin@gmail.com
test_prodadm        yp              productadmin    ypunittest1+productadmin@gmail.com
test_campaignlead   yp              campaignlead    ypunittest1+campaignlead@gmail.com
test_sysadm         yp              systemadmin     ypunittest1+systemadmin@gmail.com


all these emails go to the following gmail account, go to www.gmail.com
login: ypunittest1@gmail.com   password: unittest

### Other available Base-Data

  - activities: we ensure that all activities are loaded into all test environments
  - assessments: we ensure that one assessment is loaded into all test environments
  - organisation: we ensure that one test-organization is loaded in all test environments, administrated by
    user 'test_orgadm'.
  - campaign: we ensure that one "test campaign" is loaded in to all test environments, belonging to the test org
    managed by user 'test_campaignlead'

### other data

All other data has to be generated by the unittests themselves and must be deleted after the tests.
This includes: ActivityPlans, Comments, AssessmentResults, ...

## useful commands when working with unittests

Executing a single test file - in case of API test (frisby.js) a backend server must be running in other terminal session
or in the IDE (i.e. for debugging)

    jasmine-node spec/mytestfile_spec.js

Executing all tests using a different server session (expects a backend server to be running on port 8000)

    grunt testdebug

Executing all tests including runnnig the backend server (executed by continuous integration)

    grunt test
