#!/bin/sh
cd /home/youpers/yp-backend
git pull
pm2 restart all
