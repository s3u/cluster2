/*
 * Copyright 2012 eBay Software Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

var Process = require('./process.js'),
    ecv = require('./ecv.js'),
    _ = require('underscore'),
    assert = require('assert'),
    os = require('os'),
    util = require('util'),
    events = require('events');

// Trap all uncaught exception here.
process.on('uncaughtException', function (error) {
    // TODO: This has to the log file
    console.log(error.stack || error);
});

exports.version = require('../package.json').version;

var Cluster = module.exports = function Cluster(options) {
    // Extend from EventEmitter
    events.EventEmitter.call(this);

    this.options = options || {};
    this.options.port = this.options.port || 3000;
    this.options.monPort = this.options.monPort || 3001;
    this.options.ecvPath = this.options.ecvPath || '/ecv';
    this.options.monPath = this.options.monPath || '/';
    this.options.noWorkers = this.options.noWorkers || os.cpus().length;
}

util.inherits(Cluster, events.EventEmitter);

/**
 * Start the cluster
 */
Cluster.prototype.listen = function(createApp, cb) {
    var self = this;
    assert.ok(_.isFunction(createApp), 'createApp must be a function');

    if(!self.options.hasOwnProperty('cluster') || self.options.cluster === true) {
        var master = new Process({
            pids: process.cwd() + '/pids',
            logs: process.cwd() + '/logs',
            port: self.options.port,
            monPort: self.options.monPort,
            monPath: self.options.monPath,
            ecv: self.options.ecv,
            ecvPath: self.options.ecvPath || '/ecv',
            noWorkers: self.options.noWorkers,
            timeout: self.options.timeout || 30 * 1000, // idle socket timeout
            connThreshold: self.options.connThreshold || 10000, // recycle workers after this many connections
            emitter: self
        });

        if(self.options.stop) {
            master.stop()
        }
        else if(self.options.shutdown) {
            master.shutdown();
        }
        else {
            createApp.call(null, function (app) {
                master.listen(app, function () {
                    if(self.options.ecv) {
                        ecv.enable(app, self.options.port, self.options.ecvPath, self.options.ecv.monitor, function (data) {
                            return true;
                        });
                    }
                    if(cb) {
                        cb(app);
                    }
                });
            });
        }
    }
    else {
        createApp.call(null, function (app) {
            app.listen(self.options.port, function () {
                if(self.options.ecv) {
                    ecv.enable(app, self.options.port, self.options.ecvPath, self.options.ecv.monitor, function (data) {
                        return true;
                    });
                }
                if(cb) {
                    cb(app);
                }
            });
        });
    }
}

Cluster.prototype.stop = function () {
    var master = new Process({
        pids: process.cwd() + '/pids'
    });
    master.stop();
}

Cluster.prototype.shutdown = function () {
    var master = new Process({
        pids: process.cwd() + '/pids'
    });
    master.shutdown();
}
