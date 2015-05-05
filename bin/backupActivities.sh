#! /bin/bash

OLD_VERSION=`/usr/local/bin/mongo --version | cut -b 24-`
echo keeping mongo version $OLD_VERSION to switch back after using 2.4.12
/usr/local/bin/brew switch mongo 2.4.12

DATE=$(date +"%Y%m%d%H%M")
/usr/local/bin/mongoexport --host 10.111.1.92:27017 -u nodeDbAccess -p yp13%mongodb%insp -c ideas -d hc-content --jsonArray > /Users/retoblunschi/Documents/backendBackup/activities_$DATE.json
/usr/local/bin/mongoexport --host 10.111.1.92:27017 -u nodeDbAccess -p yp13%mongodb%insp -c assessments -d hc-content --jsonArray > /Users/retoblunschi/Documents/backendBackup/assessments_$DATE.json
/usr/local/bin/mongoexport --host 10.111.1.92:27017 -u nodeDbAccess -p yp13%mongodb%insp -c assessmentquestions -d hc-content --jsonArray > /Users/retoblunschi/Documents/backendBackup/assessmentquestions_$DATE.json
/usr/local/bin/mongoexport --host 10.111.1.92:27017 -u nodeDbAccess -p yp13%mongodb%insp -c topics -d hc-content --jsonArray > /Users/retoblunschi/Documents/backendBackup/topics_$DATE.json
/usr/local/bin/brew switch mongo $OLD_VERSION