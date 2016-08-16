# Sofaking

Manages the lifetime and configuration of [`couchbase`](https://www.npmjs.com/package/couchbase) bucket instances.  All buckets are wrapped using [`couchbase-promises`](https://www.npmjs.com/package/couchbase-promises) to provide full A+ promises support.

## Configuration

Configuration of `sofaking` is done using [`rc`](https://www.npmjs.com/package/rc).  Available configuration options include:

* `clusters`: _(required)_ an object that contains a listing of Couchbase clusters, and their configuration.  Each key in the `clusters` object corresponds to a single cluster configuration, and is an object that can contain the following keys:

  + `cnstr`: _(required)_ a connection string to the cluster.

  + `options`: _(optional)_ an object that contains connection options.  This object can contain the keys:

    - `certpath`: _(optional)_ the path to the certificate to use for SSL connections.

  + `buckets`: _(required)_ an object who's keys reference a bucket name found on the cluster.  Each key is an object that can contain the keys:

    - `password`: _(optional)_ the password to use to connect to the bucket.

* `repositories`: _(required)_ an object whose keys semantically align to the repositories in the project.  Each repository key is an object that contains the keys:

  + `cluster`: _(required)_ the name of the cluster the repository should use. The name should correspond to to a key found in `clusters`.

  + `bucket`: _(required)_ the name of the bucket the repository should use.  The bucket name should correspond to a key in the object referenced by `cluster`.

## Example

Add a reference in your `package.json` file's `dependencies` key:

```json
  "sofaking": "^1.0.0"
```

Create a `.sofakingerc` file:

```json
{
  "clusters": {
    "primary": {
      "cnstr": "couchbase://10.0.5.175",
      "options": { },
      "buckets": {
        "default": {
          "password": "oU812?"
        }
      }
    }
  },
  "repositories": {
    "users": {
      "cluster": "primary",
      "bucket": "default"
    }
  }
}
```

Create a `users-repository.js` file:

```js
const Sofaking = require('sofaking');
const me = new WeakMap();

class UsersRepository {
  constructor(bucket) {
    // support DI
    me.set(this, {
      bucket: bucket || Sofaking.getBucket('users')
    });
  }

  get(id) {
    return me.get(this).bucket.getAsync('user_' + id);
  }

  insert(user) {
    return me.get(this).bucket.insertAsync(user.id, user);
  }

  destroy(id) {
    return me.get(this).bucket.removeAsync(id);
  }
}

module.exports = UsersRepository;
```

### Repositories

A _repository_ is an abstract that represents all of the persistence logic for a given domain entity or namespace.  The idea behind `sofaking` is to provide a simple way of ensuring applications contain one open connection per Couchbase bucket, while allowing multiple conceptual _repositories_ to use common buckets.  This has the added benefit of completing separating bucket names, and other deployment concerns, from application code.

### API

#### `Sofaking.getBucket(repository)`

Returns the Couchbase bucket mapped to the given repository name.

#### `Sofaking.errors`

A dictionary of custom errors thrown by `sofaking`.  Errors include:

  * `UnknownRepositoryError`: thrown when an unknown repository is requested with `Sofaking.getBucket()`.

  * `InvalidClusterMappingError`: thrown when a _repository_ is configured to reference an unknown Couchbase cluster.

  * `InvalidBucketMappingError`: thrown a _repository_ is configured to reference an unknown Couchbase bucket.
