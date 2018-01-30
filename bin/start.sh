#!/bin/bash
nohup redis-server --dir /home/audiogram/redis --appendonly yes --logfile redis.log &
npm run debug > console.log