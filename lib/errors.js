'use strict';

const couchbase = require('couchbase-promises');
const elv = require('elv');

/*
  Thrown when a repository is requested that has no correlated configured
  mapping in the Sofaking instance.
*/
function UnknownRepositoryError(repo) {
  Error.call(this);
  Error.captureStackTrace(this, UnknownRepositoryError);
  this.message = `The repository "${repo}" does not have an associated bucket`;
}
UnknownRepositoryError.prototype = Object.create(Error.prototype);
UnknownRepositoryError.prototype.constructor = UnknownRepositoryError;

/*
  Thrown when a repository configuration references a cluster that does not
  exist in the clusters dictionary.
*/
function InvalidClusterMappingError(repo, cluster) {
  Error.call(this);
  Error.captureStackTrace(this, InvalidClusterMappingError);
  this.message =
    `The repository "${repo}" is referencing an unknown cluster "${cluster}"`;
}
InvalidClusterMappingError.prototype = Object.create(Error.prototype);
InvalidClusterMappingError.prototype.constructor = InvalidClusterMappingError;

/*
  Thrown when a repository configuration references a bucket that does not
  exist in the referenced cluster's dictionary of buckets.
*/
function InvalidBucketMappingError(repo, bucket) {
  Error.call(this);
  Error.captureStackTrace(this, InvalidBucketMappingError);
  this.message =
    `The repository "${repo}" is referencing an unknown bucket "${bucket}"`;
}
InvalidBucketMappingError.prototype = Object.create(Error.prototype);
InvalidBucketMappingError.prototype.constructor = InvalidBucketMappingError;

/*
  Thrown when there is a general config error.
*/
function ConfigError(message) {
  Error.call(this);
  Error.captureStackTrace(this, ConfigError);
  const msg = elv.coalesce(message, 'Invalid configuration');
  this.message = msg;
}
ConfigError.prototype = Object.create(Error.prototype);
ConfigError.prototype.constructor = ConfigError;

module.exports = {
  UnknownRepositoryError: UnknownRepositoryError,
  InvalidClusterMappingError: InvalidClusterMappingError,
  InvalidBucketMappingError: InvalidBucketMappingError,
  ConfigError: ConfigError,
  codes: couchbase.errors
};
