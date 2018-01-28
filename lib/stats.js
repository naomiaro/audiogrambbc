'use strict';

const StatsD = require('node-statsd').StatsD;

const env = process.env.NODE_ENV || 'dev';
const prefix = `bbc.newslabs.audiogram.${env}.`;
const host = 'audiogram.newslabs.co';
const port = 8125;

const client = new StatsD({
    prefix,
    host,
    port,
    cacheDns: true
});

module.exports = client;