#!/bin/sh
set -e
cd /home/youpers
source ./.profile
cd /home/youpers/$2-backend
git pull origin $1
export NODE_ENV=$2
npm update
pm2 startOrRestart processes.json
