#!/bin/bash
set -e
DB=$1

if [ -z "$DB" ]; then
    DB="test_database"
fi

echo "**** importing Content Collections into MONGO DATABASE localhost:$DB from dbdata/content"
bin/mongoimportexport.sh -d dbdata/content -l $DB