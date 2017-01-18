# Sofaking

Bucket configuration and connection management for Couchbase.

Manages the lifetime and configuration of [`couchbase`](https://www.npmjs.com/package/couchbase) bucket instances.  All buckets are wrapped using [`couchbase-promises`](https://www.npmjs.com/package/couchbase-promises) to provide full A+ promises support.

## Configuration

The `sofaking` module internally uses [`kibbutz`](https://www.npmjs.com/package/kibbutz) for configuration loading and aggregation.  Configuration providers must return objects with the following schema:

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

The following example uses [`kibbutz-rc`](https://www.npmjs.com/package/kibbutz-rc) to load configuration using [`rc`](https://www.npmjs.com/package/rc)

```sh
$ npm install sofaking -S
```

Create a `.usersrc` file:

```json
{
  "clusters": {
    "primary": {
      "cnstr": "couchbase://127.0.0.1",
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
const RcProvider = require('kibbutz-rc');

const provider = new RcProvider({
  appName: 'users'
});

const sofa = new Sofaking();
sofa.load([provider]);

const me = new WeakMap();

class UsersRepository {
  constructor(bucket) {
    // support DI
    me.set(this, {
      bucket: bucket || sofa.getBucket('users')
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

#### Constructors

##### `new Sofaking(couchbase)`

Creates a new instance of `Sofaking`.  The constructor takes a single, optional argument that allows you to specify what `couchbase` module to use internally.  This is especially useful in unit tests when you want to use mocks.

#### Properties

##### `Sofaking.errors`

A dictionary of custom errors thrown by `sofaking`.  Errors include:

  * `UnknownRepositoryError`: thrown when an unknown repository is requested with `Sofaking.getBucket()`.

  * `InvalidClusterMappingError`: thrown when a _repository_ is configured to reference an unknown Couchbase cluster.

  * `InvalidBucketMappingError`: thrown a _repository_ is configured to reference an unknown Couchbase bucket.

  * `codes`: an object containing all of the Couchbase error codes.  This is the same object as the `couchbase-promises`' `error` property.

##### `Sofaking.shared`

Instances of `Sofaking` do not share Couchbase cluster and bucket instances.  If you have a need to share instances across multiple modules, set the `shared` property to an instance of `Sofaking`.  This static property is, by default, set to `null`.

##### `Sofaking.prototype.clusters`

A `Map` of configured clusters.  Values for entries are objects with the following keys:

  * `name`: the name of the cluster as it is in configuration.  This will be the same value as the `key` for the entry.

  * `cluster`: the Couchbase `Cluster` instance.

  * `buckets`: a `Map` of open buckets.  Entries correspond to configuration.  Values for entries are objects with the following keys:

    + `name`: the name of the bucket.  This will be the same value as the `key` for the entry, as well as the name of the bucket in the Couchbase cluster.

    + `bucket`: the open Couchbase `Bucket` instance.

##### `Sofaking.prototype.repositories`

A `Map` of configured repositories.  Values are instances of their mapped Couchbase `Bucket` instance.

#### Methods

##### `Sofaking.prototype.add(fragments | ...fragments)`

Adds Couchbase cluster, bucket, and repository mappings from configuration fragments.  The `add()` method returns the same instance of `Sofaking` so that calls can be chained together.  Parameters:

  * `fragments`: _(required)_ an array of configuration fragments.  All fragments are merged, and new cluster, bucket, and repository mappings are opened and added as necessary.

  _...or..._

  * `...fragments`: _(required)_ n-number of configuration fragments provided as separate arguments.  All fragments are merged, and new cluster, bucket, and repository mappings are opened and added as necessary.

The merging of configuration fragments uses the same `Kibbutz`-style merge logic as the `load()` method.

##### `Sofaking.prototype.getBucket(repository)`

Returns the Couchbase bucket mapped to the given repository name.

##### `Sofaking.prototype.getBucketName(repository)`

Returns the name of the bucket mapped to the given repository name.

##### `Sofaking.prototype.load(providers [, value] [, callback])`

Used to load configuration.  The `load()` method returns the same instance of `Sofaking` so that calls can be chained together.  Parameters:

  * `providers`: _(required)_ an array of `Kibbutz`-styled configuration providers.

  * `value`: _(optional)_ the base configuration object to pass to the `Kibbutz` constructor.

  * `callback`: _(optional)_ a Node.js callback function that is called when all configuration fragments have been loaded, aggregated, and subsequently mapped to Couchbase `Bucket` instances.

##### `Sofaking.prototype.on(eventName, listener)`

Instances of `Sofaking` are also `EventEmitter`s.  The `on()` method maps listeners to specific events.  The `on()` method returns the same isntance of `Sofaking` so that calls can be chained together.  Parameters:

  * `eventName`: _(required)_ a string that maps the `lister` to its target event.

  * `listener`: _(required)_ a function used to handle events.  The signature for the function depends on the event.

Valid events include:

  * `config`: raised when the internal `Kibbutz` instance loads configuration fragments.  This event is exactly the same as `Kibbutz`'s' `config` event.

  * `done`: raised when the internal `Kibbutz` instance completes loading all configuration fragments from all providers given to the `load()` method.  This event is exactly the same as `Kibbutz`'s' `done` event.

  * `bucket`: raised when Couchbase `Bucket` instances are opened.  Listeners should take a single parameter.  Passed arguments are objects with following keys:

    + `name`: the name of the bucket.

    + `bucket`: the Couchbase `Bucket` instance.

  * `error`: raised when an internal error is encountered.  Listeners should take a single parameter, which is the error that was thrown internally.
