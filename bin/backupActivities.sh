#! /bin/bash

OLD_VERSION=`/usr/local/bin/mongo --version | cut -b 24-`
echo keeping mongo version $OLD_VERSION to switch back after using 2.4.9
/usr/local/bin/brew switch mongo 2.4.9

DATE=$(date +"%Y%m%d%H%M")
/usr/local/bin/mongoexport --host localhost:27017  -c ideas -d test_database --jsonArray > idea.json
/usr/local/bin/brew switch mongo $OLD_VERSION