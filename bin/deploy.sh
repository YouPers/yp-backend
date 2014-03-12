#!/bin/sh
cd /home/youpers/yp-backend
git pull
npm install
pm2 restart all
