#! /bin/bash

OLD_VERSION=`/usr/local/bin/mongo --version | cut -b 24-`
echo keeping mongo version $OLD_VERSION to switch back after using 2.4.9
/usr/local/bin/brew switch mongo 2.4.9

DATE=$(date +"%Y%m%d%H%M")
/usr/local/bin/mongoexport --host 10.111.1.70:27017 -u nodeDbAccess -p yp13%mongodb%uat -c ideas -d ypdb --jsonArray > /Users/retoblunschi/Documents/backendBackup/activities_$DATE.json
/usr/local/bin/brew switch mongo $OLD_VERSION