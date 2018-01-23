#!/bin/bash
nohup redis-server --dir /home/audiogram/redis --appendonly yes &
npm run debug > console.log