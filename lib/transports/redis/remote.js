var redis = require("redis"),
    _ = require('lodash'),
    queue = require("d3").queue;

module.exports = function(host) {

  // Prefix all keys to avoid collisions
  var prefix = "audiogram:";

  var client = redis.createClient({ host: host });

  client.on("error", function(err) {
    throw err;
  });

  function hset(key, field, value) {
    client.hset(prefix + key, field, value);
  }

  function hgetall(key, cb) {
    client.hgetall(prefix + key, cb);
  }

  function hincr(key, field) {
    client.hincrby(prefix + key, field, 1);
  }

  function getJobList(cb) {
    client.lrange(prefix + "jobs", 0, -1, function(err, jobs) {
      if (!err && jobs) {
        jobs = jobs.map(function(job){
          return JSON.parse(job);
        });
      }
      cb(err,jobs);
    });
  }

  function updateProject(id, user, opts, cb) {
      client.lrange(prefix + "projects", 0, -1, function (err, projects) {
        if (err || !projects) return cb(err);
        projects = projects.map(function (job) {
            return JSON.parse(job);
        });
        var project;
        for(var i = 0; i < projects.length; i++) {
            if (projects[i].id == id) {
                project = projects[i];
                break;
            }
        }
        if (!project) return cb('no project found');
        if (user != project.user) return cb(403);
        var val = JSON.stringify(project);
        var newProject = Object.assign({}, project, opts);
        client.lrem(prefix + "projects", 0, val, function (err) {
            if (err) return cb(err);
            addProject(newProject, cb);
        });
      });
  }

  function getProjectList(cb) {
    client.lrange(prefix + "projects", 0, -1, function(err, jobs) {
      if (!err && jobs) {
        jobs = jobs.map(function(job){
          return JSON.parse(job);
        });
        jobsSorted = _.sortBy(jobs, 'created');
        // TODO: delete expired projects
      }
      cb(err, jobsSorted);
    });
  }

  function addProject(settings, cb) {
    console.log("addProject", JSON.stringify(settings));
    var res = client.rpush(prefix + "projects", JSON.stringify(settings), cb);
  }

  function addJob(settings) {
    client.rpush(prefix + "jobs", JSON.stringify(settings));
    addProject(settings);
  }

  function getJob(cb) {
    client.blpop(prefix + "jobs", 5, function(err, job) {
      cb(err, job ? JSON.parse(job[1]) : null);
    });
  }

  function quit() {
    client.quit();
  }

  function clean(cb) {
    client.keys(prefix + "*", function(err, keys){

      if (err || !keys.length) {
        return cb(err);
      }

      client.del(keys, cb);

    });
  }

  // JOB: the jobs list is the queue of active jobs being processed
  // PROJECT: projects are saved jobs, that can be accessed again later
  return {
    setField: hset,
    getHash: hgetall,
    incrementField: hincr,
    getJobList: getJobList,
    getProjectList: getProjectList,
    addProject: addProject,
    updateProject,
    addJob: addJob,
    getJob: getJob,
    quit: quit,
    cleanJobs: clean
  };

};
