#!/bin/bash
set -e
HOST=localhost:51111
DB=ypdb
USER=$1
PW=$2

echo "**** LOADING MONGO DATABASE $HOST:$DB with user: $USER,  base data"

bin/mongoimportexport.sh -H $HOST -u $USER -p $PW -d dbdata/prodset -l $DB