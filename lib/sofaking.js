'use strict';

const couchbase = require('couchbase-promises');
const elv = require('elv');
const EventEmitter = require('events').EventEmitter;
const Kibbutz = require('kibbutz');

const _e = require('./errors');


/*
  Messages used for errors.
*/
const _msg = {
  sharedInvalid: 'Shared must be set to an instance of Sofaking.',
  eventNameStr: 'Arg "eventName" must be a non-empty string',
  listenerFunc: 'Arg "listener" must be a function',
  unknownEventName: 'Arg "eventName" referenes an unknown event: ',
  couchbaseNope: 'The provided couchbase module is invalid',
  providersArray: 'Arg "providers" must be an array',
  providersEmpty: 'Arg "providers" cannot be an empty array',
  valueObj: 'Arg "value" must be an object',
  callbackFn: 'Arg "callback" must be a function',
  callbackArity: 'Arg "callback" must be a function with an arity of 2',
  confMissing: 'No config was loaded',
  confObj: 'Configs must be non-array/Date objects',
  confClusters: 'Config missing required "clusters" key',
  confClustersObj: 'Config "clusters" key must be non-array/Date objects',
  confRepos: 'Config missing required "repositories" key',
  confReposObj: 'Config "repositories" key must be non-array/Date objects',
  clustersNone: 'No clusters were defined',
  clusterMissing: 'Cluster config is undefined',
  clusterObj: 'Cluster configurations must be an object',
  clusterCnstrStr: 'Cluster "cnstr" values must be a string',
  clusterOptionsObj: 'Cluster "options" must be an object',
  clusterBucketsMissing: 'Cluster "buckets" is required',
  clusterBucketObj: 'Cluster "buckets" must be a non-array/Date object',
  bucketsNone: 'No buckets were defined',
  bucketMissing: 'Bucket configuration is undefined',
  bucketObj: 'Bucket configurations must be an object',
  bucketPasswordStr: 'Bucket passwords must be a string',
  reposNone: 'No repositories were defined',
  repoMissing: 'Repository configuration is udnefined',
  repoClusterStr: 'Repository config key "cluster" must be a non-empty string',
  repoBucketStr: 'Repository config key "bucket" must be a non-empty string',
  repoArgStr: 'Arg "repositories" must be a string',
  addNothing: 'No arguments were supplied to append'
};

/*
  Is Plain Old JSON Object.  Returns true if value is an object, and is not an
  Array or Date.  Otherwise false.
*/
const _isPojo = (value) => {
  return (typeof value === 'object'
          && !Array.isArray(value)
          && !(value instanceof Date)
  );
};

/*
  Asserts that the options provided to the Sofaking constructor are valid.
*/
const _assertCouchbase = (cb) => {
  if (!elv(cb)) return;

  if (typeof cb !== 'object'
      || !cb.hasOwnProperty('Cluster')
      || typeof cb.Cluster !== 'function'
  )
    throw new TypeError(_msg.couchbaseNope);
};

/*
  Asserts that the providers argument given to load() is valid.
*/
const _assertProviders = (providers) => {
  if (!Array.isArray(providers))
    throw new TypeError(_msg.providersArray);

  if (providers.length === 0)
    throw new TypeError(_msg.providersEmpty)
};

/*
  Asserts that the value argument given to load() is valid.
*/
const _assertValue = (value) => {
  if (elv(value) && !_isPojo(value))
    throw new TypeError(_msg.valueObj);
};

/*
  Asserts that the callback reference given to load() is in fact a valid
  callback function.
*/
const _assertCallback = (callback) => {
  if (!elv(callback)) return;

  if (typeof callback !== 'function')
    throw new TypeError(_msg.callbackFn);

  if (callback.length !== 2)
    throw new TypeError(_msg.callbackArity);
};

/*
  Asserts that a fully loaded configuration has the required top-level keys
  and value types.
*/
const _assertConf = (conf) => {
  if (!conf.hasOwnProperty('clusters'))
    return new TypeError(_msg.confClusters);

  if (!_isPojo(conf.clusters))
    return new TypeError(_msg.confClustersObj);

  if (!conf.hasOwnProperty('repositories'))
    return new TypeError(_msg.confRepos);

  if (!_isPojo(conf.repositories))
    return new TypeError(_msg.confReposObj);

  return undefined;
};

/*
  Asserts that a cluster configuration is valid.
*/
const _assertClusterConf = (conf) => {
  if (typeof conf.cnstr !== 'string' || conf.cnstr.length === 0)
    return new TypeError(_msg.clusterCnstrStr);

  if (conf.hasOwnProperty('options') && !_isPojo(conf.options))
    return new TypeError(_msg.clusterOptionsObj);

  if (!elv(conf.buckets))
    return new TypeError(_msg.clusterBucketsMissing);

  if (!_isPojo(conf.buckets))
    return new TypeError(_msg.clusterBucketObj);

  return undefined;
};

/*
  Asserts that a bucket configuration is valid
*/
const _assertBucketConf = (conf) => {
  if (conf.hasOwnProperty('password') && typeof conf.password !== 'string')
    return new TypeError(_msg.bucketPasswordStr);

  return undefined;
};

/*
  Asserts that a repository configuration is valid
*/
const _assertRepositoryConf = (conf) => {
  if (!elv(conf))
    return new TypeError(_msg.repoMissing);

  if (typeof conf.cluster !== 'string' || conf.cluster.length === 0)
    return new TypeError(_msg.repoClusterStr);

  if (typeof conf.bucket !== 'string' || conf.cluster.length === 0)
    return new TypeError(_msg.repoBucketStr);

  return undefined;
};

/*
  Guess what this does.  It opens Couchbase buckets, silly.
*/
const _openBucket = (cluster, key, password, stuff) => {
  const emitter = stuff.emitter;
  const name = key;
  const bucket = {
    name: name,
    bucket: null
  };
  bucket.bucket = cluster.cluster.openBucket(name, password, (err, bkt) => {
    if (elv(err))
      emitter.emit('error', err);
    else
      emitter.emit('bucket', bucket);
  });
  return bucket;
};

/*
  Creates a wrapper that holds a Couchbase bucket instance.
*/
const _fillBucketsMap = (bucketsConf, cluster, stuff) => {
  const bmap = cluster.buckets;
  const emitter = stuff.emitter;
  const keys = Object.keys(bucketsConf);

  if (!elv(keys) || keys.length === 0)
    return new _e.ConfigError(_msg.bucketsNone);

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (bmap.has(key)) continue;

    const bucketConf = bucketsConf[key];
    const bucketErr = _assertBucketConf(bucketConf);
    if (elv(bucketErr)) return bucketErr;

    const password = (elv(bucketConf.password))
      ? bucketConf.password
      : null;

    const inst = _openBucket(cluster, key, password, stuff);
    bmap.set(key, inst);
  }

  return undefined;
};

/*
  Creates instances of Clusters and opens the necessary Buckets.  All instances
  are added to various indexes for quick lookup.
*/
const _fillClusterMap = (conf, stuff) => {
  const cconf = conf.clusters;
  const cmap = stuff.clusters;
  const keys = Object.keys(cconf);

  if (!elv(keys) || keys.length === 0)
    return new _e.ConfigError(_msg.clustersNone);

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const clusterConf = cconf[key];

    const clusterErr = _assertClusterConf(clusterConf);
    if (elv(clusterErr)) return clusterErr;

    if (stuff.clusters.has(key)) {
      const cluster = stuff.clusters.get(key);

      const bucketsErr1 = _fillBucketsMap(clusterConf.buckets, cluster, stuff);
      if (elv(bucketsErr1)) return bucketsErr1;

      continue;
    }

    const cnstr = clusterConf.cnstr;
    const options = clusterConf.options;

    const clusterWrap = {
      name: key,
      cluster: new stuff.couchbase.Cluster(cnstr, options),
      buckets: new Map()
    };

    const bucketsConf = clusterConf.buckets;
    const bucketsErr2 = _fillBucketsMap(bucketsConf, clusterWrap, stuff);
    if (elv(bucketsErr2)) return bucketsErr2;

    cmap.set(key, clusterWrap);
  }

  return undefined;
};

/*
  Builds an index of repository names to their Couchbase bucket instances.
*/
const _fillRepoMap = (conf, stuff) => {
  const rconf = conf.repositories;
  const rmap = stuff.repositories;
  const keys = Object.keys(rconf);

  if (!elv(keys) || keys.length === 0)
    return new _e.ConfigError(_msg.reposNone);

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (rmap.has(key)) continue;

    const repoConf = rconf[key];

    const repoErr = _assertRepositoryConf(repoConf);
    if (elv(repoErr)) return repoErr;

    const cluster = stuff.clusters.get(repoConf.cluster);
    if (!elv(cluster))
      return new _e.InvalidClusterMappingError(key, repoConf.cluster);

    const bucket = cluster.buckets.get(repoConf.bucket);
    if (!elv(bucket))
      return new _e.InvalidBucketMappingError(key, repoConf.bucket);

    rmap.set(key, bucket);
  }
}

/*
  Returns the bucket wrapper for a given repository name.
*/
const _getBucket = (repository, stuff) => {
  if (typeof repository !== 'string')
    throw new TypeError(_msg.repoArgStr);

  const repos = stuff.repositories;
  const bucket = repos.get(repository);

  if (!elv(bucket))
    throw new _e.UnknownRepositoryError(repository);

  return bucket;
};

/*
  Loads new clusters and buckets from a configuration object.
*/
const _fill = (conf, stuff) => {
  const emitter = stuff.emitter;

  const assertErr = _assertConf(conf);
  if (elv(assertErr)) {
    emitter.emit('error', assertErr);
    return;
  }

  const clusterErr = _fillClusterMap(conf, stuff);
  if (elv(clusterErr)) {
    emitter.emit('error', clusterErr);
    return;
  }

  const repoErr = _fillRepoMap(conf, stuff);
  if (elv(repoErr)) {
    emitter.emit('error', repoErr);
    return;
  }
};

/*
  Private state holder.
*/
let _shared = null;
const _state = new WeakMap();

/*
  Manages the configuration and lifetime of Couchbase clusters and buckets.
*/
class Sofaking {

  /*
    Creates an instance of Sofaking.
  */
  constructor(cb) {
    _assertCouchbase(cb);
    const stuff = {
      clusters: new Map(),
      repositories: new Map(),
      emitter: new EventEmitter(),
      couchbase: elv.coalesce(cb, couchbase),
    };
    _state.set(this, stuff);
  }

  /*
    Gets all of the clusters configured for the instance of Sofaking.
  */
  get clusters() { return _state.get(this).clusters; }

  /*
    Gets all of the repositories configured for the instance of Sofaking.
  */
  get repositories() { return _state.get(this).repositories; }

  /*
    Returns the custom errors thrown by Sofaking.
  */
  static get errors() { return _e; }

  /*
    A shared instance of Sofaking to use between modules.  By default, this
    value is null.  If you need a shared instance you must set this property
    to an instance of Sofaking.
  */
  static get shared() { return _shared; }
  static set shared(val) {
    if (val instanceof Sofaking || val === null) _shared = val;
    else throw new TypeError(_msg.sharedInvalid);
  }

  /*
    Loads configuration from a given set of Kibbutz providers, opens any
    Couchbase clusters/buckets not currently open, and creates an index
    between repository names and bucket instances (1-to-*).  Load returns this
    so that methods calls can be chained together.
  */
  load(providers, value, callback) {
    _assertProviders(providers);

    let val, cbfn;

    if (arguments.length === 2 && typeof value === 'function') {
      cbfn = value;
    } else {
      val = value;
      cbfn = callback;
    }

    _assertValue(val);
    _assertCallback(cbfn);

    const options = (elv(val)) ? { value: val } : undefined;
    const self = this;
    const stuff = _state.get(this);
    const emitter = stuff.emitter;
    const configurator = new Kibbutz(options);

    configurator.on('config', (fragment) => {
      emitter.emit('config', fragment);
    })
    .on('done', (conf) => {
      emitter.emit('done', conf);
    });

    configurator.load(providers, function(err, conf) {
      if (elv(err)) {
        if (elv(cbfn)) cbfn(err);
        emitter.emit('error', err);
        return;
      }

      _fill(conf, stuff);

      if (elv(cbfn)) cbfn(undefined, self);
    });

    return this;
  }

  /*
    Adds additional repository mappings to the Sofaking instance, and opens any
    clusters and buckets not currently open.
  */
  add() {
    if (arguments.length === 0)
      throw new TypeError(_msg.addNothing);

    const configurator = new Kibbutz();
    let vals = [];

    if (arguments.length === 1 && Array.isArray(arguments[0])) {
      vals = arguments[0];
    } else {
      for (let i = 0; i < arguments.length; i++) {
        const val = arguments[i];
        if (Array.isArray(val)) vals = vals.concat(val);
        else vals.push(val);
      }
    }

    configurator.append(vals);

    const stuff = _state.get(this);
    _fill(configurator.value, stuff);

    return this;
  }

  /*
    Returns the Couchbase bucket mapped to the given repository.
  */
  getBucket(repository) {
    return _getBucket(repository, _state.get(this)).bucket;
  }

  /*
    Returns the name of the Couchbase bucket mapped to the given repository.
  */
  getBucketName(repository) {
    return _getBucket(repository, _state.get(this)).name;
  }

  /*
    Wire up event listeners
  */
  on(eventName, listener) {
    if (typeof eventName !== 'string' || eventName.length === 0)
      throw new TypeError(_msg.eventNameStr);

    if (typeof listener !== 'function')
      throw new TypeError(_msg.listenerFunc);

    if (eventName !== 'config'
        && eventName !== 'done'
        && eventName !== 'bucket'
        && eventName !== 'error'
    )
      throw new Error(_msg.unknownEventName + eventName);

    _state.get(this).emitter.on(eventName, listener);
    return this;
  }

}

module.exports = Sofaking;
