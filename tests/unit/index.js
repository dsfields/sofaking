'use strict';

const assert = require('chai').assert;
const Sofaking = require('../../lib');
const cb = require('couchbase-promises').Mock;

describe('Sofaking', () => {
  describe('#constructor', () => {
    it('should throw if no config was supplied', () => {
      assert.throws(() => {
        const sofaking = new Sofaking();
      });
    });

    it('should throw if no clusters key provided', () => {
      assert.throws(() => {
        const sofaking = new Sofaking({}, cb);
      });
    });

    it('should throw if cluster is empty', () => {
      assert.throws(() => {
        const sofaking = new Sofaking({
          clusters: {},
          repositories: {
            "default": {
              cluster: "default",
              bucket: "default"
            }
          }
        }, cb);
      });
    });

    it('should throw if clusters is not object', () => {
      assert.throws(() => {
        const sofaking = new Sofaking({
          clusters: 123,
          repositories: {
            "default": {
              cluster: "default",
              bucket: "default"
            }
          }
        }, cb);
      });
    });

    it('should throw if clusters[key].cnstr not provided', () => {
      assert.throws(() => {
        const sofaking = new Sofaking({
          clusters: {
            "default": {
              buckets: {
                "default": {}
              }
            }
          },
          repositories: {
            "default": {
              cluster: "default",
              bucket: "default"
            }
          }
        }, cb);
      });
    });

    it('should throw if clusters[key].cnstr is not string', () => {
      assert.throws(() => {
        const sofaking = new Sofaking({
          clusters: {
            "default": {
              cnstr: 123,
              buckets: {
                "default": {}
              }
            }
          },
          repositories: {
            "default": {
              cluster: "default",
              bucket: "default"
            }
          }
        }, cb);
      });
    });

    it('should throw if clusters[key].options is not object', () => {
      assert.throws(() => {
        const sofaking = new Sofaking({
          clusters: {
            "default": {
              cnstr: "couchbase://127.0.0.1",
              options: 123,
              buckets: {
                "default": {}
              }
            }
          },
          repositories: {
            "default": {
              cluster: "default",
              bucket: "default"
            }
          }
        }, cb);
      });
    });

    it('should throw if buckets not provided', () => {
      assert.throws(() => {
        const sofaking = new Sofaking({
          clusters: {
            "default": {
              cnstr: "couchbase://127.0.0.1"
            }
          },
          repositories: {
            "default": {
              cluster: "default",
              bucket: "default"
            }
          }
        }, cb);
      });
    });

    it('should throw if buckets[key].password is not string', () => {
      assert.throws(() => {
        const sofaking = new Sofaking({
          clusters: {
            "default": {
              cnstr: "couchbase://127.0.0.1",
              buckets: {
                "default": {
                  password: 123
                }
              }
            }
          },
          repositories: {
            "default": {
              cluster: "default",
              bucket: "default"
            }
          }
        }, cb);
      });
    });

    it('should throw if repositories is not object', () => {
      assert.throws(() => {
        const sofaking = new Sofaking({
          clusters: {
            "default": {
              cnstr: "couchbase://127.0.0.1",
              buckets: {
                "default": { }
              }
            }
          },
          repositories: 123
        }, cb);
      });
    });

    it('should throw if repositories is empty', () => {
      assert.throws(() => {
        const sofaking = new Sofaking({
          clusters: {
            "default": {
              cnstr: "couchbase://127.0.0.1",
              buckets: {
                "default": { }
              }
            }
          },
          repositories: { }
        }, cb);
      });
    });

    it('should throw if repositories[key].cluster is not provided', () => {
      assert.throws(() => {
        const sofaking = new Sofaking({
          clusters: {
            "default": {
              cnstr: "couchbase://127.0.0.1",
              buckets: {
                "default": { }
              }
            }
          },
          repositories: {
            "default": {
              bucket: "default"
            }
          }
        }, cb);
      });
    });

    it('should throw if repositories[key].cluster is not string', () => {
      assert.throws(() => {
        const sofaking = new Sofaking({
          clusters: {
            "default": {
              cnstr: "couchbase://127.0.0.1",
              buckets: {
                "default": { }
              }
            }
          },
          repositories: {
            "default": {
              cluster: 123,
              bucket: "default"
            }
          }
        }, cb);
      });
    });

    it('should throw if repositories[key].bucket is not provided', () => {
      assert.throws(() => {
        const sofaking = new Sofaking({
          clusters: {
            "default": {
              cnstr: "couchbase://127.0.0.1",
              buckets: {
                "default": { }
              }
            }
          },
          repositories: {
            "default": {
              cluster: "defualt"
            }
          }
        }, cb);
      });
    });

    it('should throw if repositories[key].bucket is not string', () => {
      assert.throws(() => {
        const sofaking = new Sofaking({
          clusters: {
            "default": {
              cnstr: "couchbase://127.0.0.1",
              buckets: {
                "default": { }
              }
            }
          },
          repositories: {
            "default": {
              cluster: "default",
              bucket: 123
            }
          }
        }, cb);
      });
    });

    it('should throw if repositories[key].cluster is not found', () => {
      assert.throws(() => {
        const sofaking = new Sofaking({
          clusters: {
            "default": {
              cnstr: "couchbase://127.0.0.1",
              buckets: {
                "default": { }
              }
            }
          },
          repositories: {
            "default": {
              cluster: "123",
              bucket: "default"
            }
          }
        }, cb);
      }, Sofaking.errors.InvalidClusterMappingError);
    });

    it('should throw if repositories[key].bucket is not found', () => {
      assert.throws(() => {
        const sofaking = new Sofaking({
          clusters: {
            "default": {
              cnstr: "couchbase://127.0.0.1",
              buckets: {
                "default": { }
              }
            }
          },
          repositories: {
            "default": {
              cluster: "default",
              bucket: "123"
            }
          }
        }, cb);
      }, Sofaking.errors.InvalidBucketMappingError);
    });

    it('should create cluster for each cluster key', () => {
      const sofaking = new Sofaking({
        clusters: {
          "default": {
            cnstr: "couchbase://127.0.0.1",
            buckets: {
              "default": { }
            }
          }
        },
        repositories: {
          "default": {
            cluster: "default",
            bucket: "default"
          }
        }
      }, cb);

      assert.isObject(sofaking.clusters.get("default"));
    });

    it('should create a bucket for each bucket key per cluster', () => {
      const sofaking = new Sofaking({
        clusters: {
          "default": {
            cnstr: "couchbase://127.0.0.1",
            buckets: {
              "default": { }
            }
          }
        },
        repositories: {
          "default": {
            cluster: "default",
            bucket: "default"
          }
        }
      }, cb);

      assert.isObject(sofaking.clusters.get("default").buckets.get("default"));
    });

    it('should create a repository for each repository key', () => {
      const sofaking = new Sofaking({
        clusters: {
          "default": {
            cnstr: "couchbase://127.0.0.1",
            buckets: {
              "default": { }
            }
          }
        },
        repositories: {
          "default": {
            cluster: "default",
            bucket: "default"
          }
        }
      }, cb);

      assert(sofaking.repositories.has("default"));
    });

    it('should associate a bucket instance for each repository', () => {
      const sofaking = new Sofaking({
        clusters: {
          "default": {
            cnstr: "couchbase://127.0.0.1",
            buckets: {
              "default": { }
            }
          }
        },
        repositories: {
          "default": {
            cluster: "default",
            bucket: "default"
          }
        }
      }, cb);

      assert.isObject(sofaking.repositories.get("default"));
    });

    it('should use the same bucket for similarly mapped repositories', () => {
      const sofaking = new Sofaking({
        clusters: {
          "default": {
            cnstr: "couchbase://127.0.0.1",
            buckets: {
              "default": { }
            }
          }
        },
        repositories: {
          "default": {
            cluster: "default",
            bucket: "default"
          },
          "other": {
            cluster: "default",
            bucket: "default"
          }
        }
      }, cb);

      const d = sofaking.repositories.get("default");
      const o = sofaking.repositories.get("other");

      assert.strictEqual(d, o);
    });
  });

  describe('#getBucket', () => {
    it('should return the bucket mapped for provided repository', () => {
      const sofaking = new Sofaking({
        clusters: {
          "default": {
            cnstr: "couchbase://127.0.0.1",
            buckets: {
              "default": { }
            }
          },
          other: {
            cnstr: "couchbase://127.0.0.2",
            buckets: {
              "other": { }
            }
          }
        },
        repositories: {
          "default": {
            cluster: "default",
            bucket: "default"
          },
          "other": {
            cluster: "other",
            bucket: "other"
          }
        }
      }, cb);

      const repoBucket = sofaking.getBucket("default");
      const bucket = sofaking.clusters.get("default").buckets.get("default");
      assert.strictEqual(repoBucket, bucket);
    });

    it('should throw if no repository name is supplied.', () => {
      const sofaking = new Sofaking({
        clusters: {
          "default": {
            cnstr: "couchbase://127.0.0.1",
            buckets: {
              "default": { }
            }
          },
          other: {
            cnstr: "couchbase://127.0.0.2",
            buckets: {
              "other": { }
            }
          }
        },
        repositories: {
          "default": {
            cluster: "default",
            bucket: "default"
          },
          "other": {
            cluster: "other",
            bucket: "other"
          }
        }
      }, cb);

      assert.throws(() => {
        Sofaking.getBucket();
      }, TypeError);
    });

    it('should throw if repository name is not a string', () => {
      const sofaking = new Sofaking({
        clusters: {
          "default": {
            cnstr: "couchbase://127.0.0.1",
            buckets: {
              "default": { }
            }
          },
          other: {
            cnstr: "couchbase://127.0.0.2",
            buckets: {
              "other": { }
            }
          }
        },
        repositories: {
          "default": {
            cluster: "default",
            bucket: "default"
          },
          "other": {
            cluster: "other",
            bucket: "other"
          }
        }
      }, cb);

      assert.throws(() => {
        Sofaking.getBucket(123);
      }, TypeError);
    });

    it('should throw if no matching repository was found', () => {
      const sofaking = new Sofaking({
        clusters: {
          "default": {
            cnstr: "couchbase://127.0.0.1",
            buckets: {
              "default": { }
            }
          },
          other: {
            cnstr: "couchbase://127.0.0.2",
            buckets: {
              "other": { }
            }
          }
        },
        repositories: {
          "default": {
            cluster: "default",
            bucket: "default"
          },
          "other": {
            cluster: "other",
            bucket: "other"
          }
        }
      }, cb);

      assert.throws(() => {
        Sofaking.getBucket("nope");
      }, Sofaking.errors.UnknownRepositoryError);
    });
  });
});
