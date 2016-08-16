'use strict';

const couchbase = require('couchbase-promises');
const Joi = require('joi');
const rc = require('rc');

const _errors = require('./errors');

const _configSchema = Joi.object({
  clusters: Joi.object().required().min(1),
  repositories: Joi.object().required().min(1),
  _: Joi.array() // this is here, because RC adds garbage
});

const _state = {
  clusters: new Map(),
  repositories: new Map()
};

const _clusterSchema = Joi.object({
  cnstr: Joi.string().required(),
  options: Joi.object(),
  buckets: Joi.object().required().min(1)
});

const _bucketSchema = Joi.object({
  password: Joi.string()
});

const _repoSchema = Joi.object({
  cluster: Joi.string().required(),
  bucket: Joi.string().required()
});

/* istanbul ignore next */
const _loadConfig = () => {
  const conf = rc('sofaking', {
    clusters: {
      "default": {
        cnstr: 'couchbase://127.0.0.1',
        options: { },
        buckets: {
          "default": { }
        }
      }
    },
    repositories: {
      "default": {
        cluster: 'default',
        bucket: 'default'
      }
    }
  });

  Joi.assert(conf, _configSchema);

  return conf;
};

const _createBucket = (name, conf, cluster) => {
  Joi.assert(conf, _bucketSchema)
  const password = conf.password || null;
  const bucket = cluster.openBucket(name, password);
  return bucket;
};

const _createBuckets = (conf, cluster) => {
  const bmap = new Map();
  const keys = Object.keys(conf);

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const bucket  = _createBucket(key, conf[key], cluster);
    bmap.set(key, bucket);
  }

  return bmap;
};

const _createCluster = (conf, cb) => {
  Joi.assert(conf, _clusterSchema);
  const Cluster = (cb) ? cb.Cluster : couchbase.Cluster;
  const cluster = new Cluster(conf.cnstr, conf.options);
  return {
    cluster: cluster,
    buckets: _createBuckets(conf.buckets, cluster)
  };
};

const _fillClusterMap = (conf, cmap, cb) => {
  const keys = Object.keys(conf);

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const c = conf[key];
    const cluster = _createCluster(c, cb);
    cmap.set(key, cluster);
  }
};

const _fillRepoMap = (repositories, clusters, rmap) => {
  const keys = Object.keys(repositories);

  for (let i = 0; i < keys.length; i++) {
    const rkey = keys[i];
    const repo = repositories[rkey];

    Joi.assert(repo, _repoSchema);

    const cluster = clusters.get(repo.cluster);
    if (!cluster)
      throw new _errors.InvalidClusterMappingError(rkey, repo.cluster);

    const bucket = cluster.buckets.get(repo.bucket);
    if (!bucket)
      throw new _errors.InvalidBucketMappingError(rkey, repo.bucket);

    rmap.set(rkey, bucket);
  }
};

const _getBucket = (repository, repositories) => {
  if (typeof repository !== 'string')
    throw new TypeError('The "repository" arg must be a string');

  const bucket = repositories.get(repository);
  if (!bucket) throw new _errors.UnknownRepositoryError(repository);
  return bucket;
};

/* istanbul ignore next */
(() => {
  if (process.env.NODE_ENV === 'test') return;
  const config = _loadConfig();
  _fillClusterMap(config.clusters, _state.clusters);
  _fillRepoMap(config.repositories, _state.clusters, _state.repositories);
})();

const me = new WeakMap();

class Sofaking {
  constructor(config, cb) {
    Joi.assert(config, _configSchema);
    var stuff = {
      clusters: new Map(),
      repositories: new Map()
    };
    _fillClusterMap(config.clusters, stuff.clusters, cb);
    _fillRepoMap(config.repositories, stuff.clusters, stuff.repositories);
    me.set(this, stuff);
  }

  get clusters() { return me.get(this).clusters; }
  get repositories() { return me.get(this).repositories; }

  getBucket(repository) {
    return _getBucket(repository, me.get(this).repositories);
  }

  static get errors() { return _errors; }

  static getBucket(repository) {
    /* istanbul ignore next */
    return _getBucket(repository, _state.repositories);
  }
}

module.exports = Sofaking;
