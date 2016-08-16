'use strict';

function UnknownRepositoryError(repo) {
  Error.call(this);
  Error.captureStackTrace(this, UnknownRepositoryError);
  this.message = `The repository "${repo}" does not have an associated bucket.`;
}

function InvalidClusterMappingError(repo, cluster) {
  Error.call(this);
  Error.captureStackTrace(this, InvalidClusterMappingError);
  this.message =
    `The repository "${repo}" is referencing an unknown cluster "${cluster}."`;
}

function InvalidBucketMappingError(repo, bucket) {
  Error.call(this);
  Error.captureStackTrace(this, InvalidBucketMappingError);
  this.message =
    `The repository "${repo}" is referencing an unknown bucket "${bucket}."`;
}

module.exports = {
  UnknownRepositoryError: UnknownRepositoryError,
  InvalidClusterMappingError: InvalidClusterMappingError,
  InvalidBucketMappingError: InvalidBucketMappingError
};
