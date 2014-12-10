#!/bin/sh
set -e
cd /home/youpers
source ./.profile
cd /home/youpers/yp-backend
git pull origin $1
export NODE_ENV=$2
npm install
pm2 restart all
