'use strict';

const assert = require('chai').assert;
const couchbase = require('couchbase-promises').Mock;

const _e = require('../../lib/errors');
const Sofaking = require('../../lib/sofaking');

function TestProviderError() {
  Error.call(this);
  Error.captureStackTrace(this, TestProviderError);
  this.message = 'This is a test';
}
TestProviderError.prototype = Object.create(Error.prototype);
TestProviderError.prototype.constructor = TestProviderError;

describe('Sofaking', () => {
  let sofaking;
  const testProvider = {
    load: function(callback) {
      process.nextTick(() => {
        const c = {
          clusters: {
            foo: {
              cnstr: 'couchbase://locahost',
              buckets: {
                "default": {}
              }
            }
          },
          repositories: {
            bar: {
              cluster: "foo",
              bucket: "default"
            }
          }
        };
        callback(undefined, c);
      });
    }
  };

  beforeEach((done) => {
    sofaking = new Sofaking(couchbase);
    sofaking.load([testProvider], (err, res) => {
      done();
    })
  });

  describe('#constructor', () => {
    it('should throw if provided Couchbase module not an object', () => {
      assert.throws(() => {
        const sk = new Sofaking(42);
      }, TypeError);
    });

    it('should throw if provided Couchbase module has no Cluster key', () => {
      assert.throws(() => {
        const sk = new Sofaking({});
      });
    });

    it('should throw if provided Couchbase module Cluster not a func', () => {
      assert.throws(() => {
        const sk = new Sofaking({
          Cluster: 42
        });
      });
    });

    it('should not throw if provided Couchbase module native Mock', () => {
      assert.doesNotThrow(() => {
        const sk = new Sofaking(couchbase);
      });
    });

    it('should use provided Couchbase module', (done) => {
      let constructed = false;

      const Cluster = function() {
        constructed = true;
      };

      Cluster.prototype.openBucket = function(name, password, callback) {
        const bucket = {};
        process.nextTick(() => {
          callback(undefined, bucket);
        });
      };

      const providers = [
        {
          load: function(callback) {
            process.nextTick(() => {
              callback(undefined, {
                clusters: {
                  foo: {
                    cnstr: 'blah',
                    buckets: {
                      bar: {}
                    }
                  }
                },
                repositories: {
                  baz: {
                    cluster: 'foo',
                    bucket: 'bar'
                  }
                }
              })
            });
          }
        }
      ];

      const sk = new Sofaking({ Cluster: Cluster });

      sk.on('bucket', (b) => {
        assert.isTrue(constructed);
        done();
      })

      sk.load(providers);
    });
  });

  describe('#clusters', () => {
    it('should return an instance of Map', (done) => {
      const sk = new Sofaking();
      assert.instanceOf(sk.clusters, Map);
      done();
    });
  });

  describe('#repositories', () => {
    it('should return an instance of Map', (done) => {
      const sk = new Sofaking();
      assert.instanceOf(sk.repositories, Map);
      done();
    });
  });

  describe('#shared', () => {
    it('should return null if not set', (done) => {
      assert.isNull(Sofaking.shared);
      done();
    });

    it('should return an instance of Sofaking if set', (done) => {
      Sofaking.shared = new Sofaking();
      assert.instanceOf(Sofaking.shared, Sofaking);
      Sofaking.shared = null;
      done();
    });

    it('should throw if set to non-Sofaking or null value', () => {
      assert.throws(() => {
        Sofaking.shared = 42;
      }, TypeError);
    });
  });

  describe('#errors', () => {
    it('should return object', (done) => {
      assert.isObject(Sofaking.errors);
      done();
    })
  });

  describe('#load', () => {
    const provider2 = {
      load: function(callback) {
        process.nextTick(() => {
          const conf = {
            clusters: {
              qux: {
                cnstr: 'couchbase://localhost',
                buckets: {
                  "default": {
                    password: 'superdupersecret'
                  }
                }
              }
            },
            repositories: {
              quux: {
                cluster: 'qux',
                bucket: 'default'
              }
            }
          };
          callback(undefined, conf);
        });
      }
    };

    const errProvider = {
      load: function(callback) {
        process.nextTick(() => {
          callback(new TestProviderError());
        });
      }
    };

    it('should throw if providers not an array', () => {
      assert.throws(() => {
        sofaking.load(42);
      }, TypeError);
    });

    it('should throw if provider.length is 0', () => {
      assert.throws(() => {
        sofaking.load([]);
      }, TypeError);
    });

    it('should use second arg as callback if func and 2 args', (done) => {
      sofaking.load([provider2], (err, res) => {
        assert.isOk(true);
        done();
      });
    });

    it('should throw if value is defined and not object', () => {
      assert.throws(() => {
        sofaking.load([provider2], 42);
      }, TypeError);
    });

    it('should throw if callback not a function', () => {
      assert.throws(() => {
        sofaking.load([provider2], {}, 42);
      }, TypeError);
    });

    it('should throw if callback does not have arity of 2', () => {
      assert.throws(() => {
        sofaking.load([provider2], {}, () => { console.log('oops'); });
      }, TypeError);
    });

    it('should use value as base config', (done) => {
      const base = {
        clusters: {
          qux: {
            buckets: {
              test: {}
            }
          }
        }
      };

      sofaking.load([provider2], base, (err, res) => {
        assert.isTrue(sofaking.clusters.get('qux').buckets.has('test'));
        done();
      });
    });

    it('should fire config event when config loaded', (done) => {
      let called = false;
      sofaking.on('config', () => { called = true; });
      sofaking.load([provider2], (err, res) => {
        assert.isTrue(called);
        done();
      });
    });

    it('should fire done event when full config loaded', (done) => {
      let called = false;
      sofaking.on('done', () => { called = true; });
      sofaking.load([provider2], (err, res) => {
        assert.isTrue(called);
        done();
      });
    });

    it('should call callback with self when success', (done) => {
      sofaking.load([provider2], (err, res) => {
        assert.strictEqual(res, sofaking);
        done();
      });
    });

    it('should call callback with error on failure', (done) => {
      sofaking.load([errProvider], (err, res) => {
        assert.isOk(err);
        done();
      });
    });

    it('should emit error on failure', (done) => {
      sofaking.on('error', (err) => {
        assert.isOk(err);
      })
      .load([errProvider], (err, res) => {
        done();
      })
    });

    it('should return self', (done) => {
      const res = sofaking.load([provider2]);
      assert.strictEqual(res, sofaking);
      done();
    });

    it('should emit error if no config was loaded', (done) => {
      const noneProvider = {
        load: function(callback) {
          process.nextTick(() => {
            callback(undefined, undefined);
          });
        }
      };

      const sk = new Sofaking(couchbase);
      sk.on('error', (err) => {
        assert.instanceOf(err, TypeError);
        done();
      })
      .load([noneProvider]);
    });

    it('should emit error if loaded config is not an object', () => {
      const noneProvider = {
        load: function(callback) {
          process.nextTick(() => {
            callback(undefined, 42);
          });
        }
      };

      const sk = new Sofaking(couchbase);
      sk.on('error', (err) => {
        assert.instanceOf(err, TypeError);
        done();
      })
      .load([noneProvider]);
    });

    it('should emit error if config has no clusters key', () => {
      const noneProvider = {
        load: function(callback) {
          process.nextTick(() => {
            callback(undefined, {
              repositories: {
                test: {
                  cluster: 'test',
                  bucket: 'test'
                }
              }
            });
          });
        }
      };

      const sk = new Sofaking(couchbase);
      sk.on('error', (err) => {
        assert.instanceOf(err, TypeError);
        done();
      })
      .load([noneProvider]);
    });

    it('should emit error if config.clusters is not an object', () => {
      const noneProvider = {
        load: function(callback) {
          process.nextTick(() => {
            callback(undefined, {
              clusters: 42,
              repositories: {
                test: {
                  cluster: 'test',
                  bucket: 'test'
                }
              }
            });
          });
        }
      };

      const sk = new Sofaking(couchbase);
      sk.on('error', (err) => {
        assert.instanceOf(err, TypeError);
        done();
      })
      .load([noneProvider]);
    });

    it('should emit error if config has no repositories key', () => {
      const noneProvider = {
        load: function(callback) {
          process.nextTick(() => {
            callback(undefined, {
              clusters: {
                  cnstr: 'couchbase://localhost',
                  buckets: {
                    test: {}
                  }
              }
            });
          });
        }
      };

      const sk = new Sofaking(couchbase);
      sk.on('error', (err) => {
        assert.instanceOf(err, TypeError);
        done();
      })
      .load([noneProvider]);
    });

    it('should emit error if config.repositories is nt an object', () => {
      const noneProvider = {
        load: function(callback) {
          process.nextTick(() => {
            callback(undefined, {
              clusters: {
                  cnstr: 'couchbase://localhost',
                  buckets: {
                    test: {}
                  }
              },
              repositories: 42
            });
          });
        }
      };

      const sk = new Sofaking(couchbase);
      sk.on('error', (err) => {
        assert.instanceOf(err, TypeError);
        done();
      })
      .load([noneProvider]);
    });

    it('should emit error if no clusters defined', () => {
      const noneProvider = {
        load: function(callback) {
          process.nextTick(() => {
            callback(undefined, {
              clusters: {},
              repositories: {
                test: {
                  cluster: 'test',
                  bucket: 'test'
                }
              }
            });
          });
        }
      };

      const sk = new Sofaking(couchbase);
      sk.on('error', (err) => {
        assert.instanceOf(err, TypeError);
        done();
      })
      .load([noneProvider]);
    });

    it('should emit error if cluster config is not defined', () => {
      const noneProvider = {
        load: function(callback) {
          process.nextTick(() => {
            callback(undefined, {
              clusters: {
                test: undefined
              },
              repositories: {
                test: {
                  cluster: 'test',
                  bucket: 'test'
                }
              }
            });
          });
        }
      };

      const sk = new Sofaking(couchbase);
      sk.on('error', (err) => {
        assert.instanceOf(err, TypeError);
        done();
      })
      .load([noneProvider]);
    });

    it('should emit error if cluster config is not an object', () => {
      const noneProvider = {
        load: function(callback) {
          process.nextTick(() => {
            callback(undefined, {
              clusters: {
                test: 42
              },
              repositories: {
                test: {
                  cluster: 'test',
                  bucket: 'test'
                }
              }
            });
          });
        }
      };

      const sk = new Sofaking(couchbase);
      sk.on('error', (err) => {
        assert.instanceOf(err, TypeError);
        done();
      })
      .load([noneProvider]);
    });

    it('should emit error if cluster config cnstr is not string', () => {
      const noneProvider = {
        load: function(callback) {
          process.nextTick(() => {
            callback(undefined, {
              clusters: {
                test: {
                  cnstr: 42,
                  buckets: {
                    test: {}
                  }
                }
              },
              repositories: {
                test: {
                  cluster: 'test',
                  bucket: 'test'
                }
              }
            });
          });
        }
      };

      const sk = new Sofaking(couchbase);
      sk.on('error', (err) => {
        assert.instanceOf(err, TypeError);
        done();
      })
      .load([noneProvider]);
    });

    it('should emit error if cluster config cnstr length is 0', () => {
      const noneProvider = {
        load: function(callback) {
          process.nextTick(() => {
            callback(undefined, {
              clusters: {
                test: {
                  cnstr: '',
                  buckets: {
                    test: {}
                  }
                }
              },
              repositories: {
                test: {
                  cluster: 'test',
                  bucket: 'test'
                }
              }
            });
          });
        }
      };

      const sk = new Sofaking(couchbase);
      sk.on('error', (err) => {
        assert.instanceOf(err, TypeError);
        done();
      })
      .load([noneProvider]);
    });

    it('should emit error if cluster config options is not an object', () => {
      const noneProvider = {
        load: function(callback) {
          process.nextTick(() => {
            callback(undefined, {
              clusters: {
                test: {
                  cnstr: 'couchbase://localhost',
                  options: 42,
                  buckets: {
                    test: {}
                  }
                }
              },
              repositories: {
                test: {
                  cluster: 'test',
                  bucket: 'test'
                }
              }
            });
          });
        }
      };

      const sk = new Sofaking(couchbase);
      sk.on('error', (err) => {
        assert.instanceOf(err, TypeError);
        done();
      })
      .load([noneProvider]);
    });

    it('should emit error if cluster config buckets undefined', () => {
      const noneProvider = {
        load: function(callback) {
          process.nextTick(() => {
            callback(undefined, {
              clusters: {
                test: {
                  cnstr: 'couchbase://localhost',
                  buckets: undefined
                }
              },
              repositories: {
                test: {
                  cluster: 'test',
                  bucket: 'test'
                }
              }
            });
          });
        }
      };

      const sk = new Sofaking(couchbase);
      sk.on('error', (err) => {
        assert.instanceOf(err, TypeError);
        done();
      })
      .load([noneProvider]);
    });

    it('should emit error if cluster config buckets not an object', () => {
      const noneProvider = {
        load: function(callback) {
          process.nextTick(() => {
            callback(undefined, {
              clusters: {
                test: {
                  cnstr: 'couchbase://localhost',
                  buckets: 42
                }
              },
              repositories: {
                test: {
                  cluster: 'test',
                  bucket: 'test'
                }
              }
            });
          });
        }
      };

      const sk = new Sofaking(couchbase);
      sk.on('error', (err) => {
        assert.instanceOf(err, TypeError);
        done();
      })
      .load([noneProvider]);
    });

    it('should add buckets to existing cluster configs', (done) => {
      const noneProvider = {
        load: function(callback) {
          process.nextTick(() => {
            callback(undefined, {
              clusters: {
                foo: {
                  cnstr: 'couchbase://blorg',
                  buckets: {
                    test: {}
                  }
                }
              },
              repositories: {
                test: {
                  cluster: 'foo',
                  bucket: 'test'
                }
              }
            });
          });
        }
      };

      sofaking.load([noneProvider], (err, res) => {
        const hasIt = sofaking.clusters.get('foo').buckets.has('test');
        assert.isTrue(hasIt);
        done();
      });
    });

    it('should not overwrite cnstr for existing cluster configs', (done) => {
      const noneCnstr = 'couchbase://blorg';
      const noneProvider = {
        load: function(callback) {
          process.nextTick(() => {
            callback(undefined, {
              clusters: {
                foo: {
                  cnstr: noneCnstr,
                  buckets: {
                    test: {}
                  }
                }
              },
              repositories: {
                test: {
                  cluster: 'foo',
                  bucket: 'test'
                }
              }
            });
          });
        }
      };

      sofaking.load([noneProvider], (err, res) => {
        const cnstr = sofaking.clusters.get('foo').cnstr;
        assert.notStrictEqual(cnstr, noneCnstr);
        done();
      });
    });

    it('should not overwrite options for existing cluster configs', (done) => {
      const noneProvider = {
        load: function(callback) {
          process.nextTick(() => {
            callback(undefined, {
              clusters: {
                foo: {
                  cnstr: 'couchbase://blorg',
                  options: {},
                  buckets: {
                    test: {}
                  }
                }
              },
              repositories: {
                test: {
                  cluster: 'foo',
                  bucket: 'test'
                }
              }
            });
          });
        }
      };

      sofaking.load([noneProvider], (err, res) => {
        const options = sofaking.clusters.get('foo').options;
        assert.isUndefined(options);
        done();
      });
    });

    it('should add cluster entry with name set to key', (done) => {
      const noneProvider = {
        load: function(callback) {
          process.nextTick(() => {
            callback(undefined, {
              clusters: {
                test: {
                  cnstr: 'couchbase://blorg',
                  options: {},
                  buckets: {
                    test: {}
                  }
                }
              },
              repositories: {
                test: {
                  cluster: 'test',
                  bucket: 'test'
                }
              }
            });
          });
        }
      };

      sofaking.load([noneProvider], (err, res) => {
        const hasIt = sofaking.clusters.has('test');
        assert.isTrue(hasIt);
        done();
      });
    });

    it('should add cluster with cluster set to instance of Cluster', (done) => {
      const c = sofaking.clusters.get('foo').cluster;
      assert.instanceOf(c, couchbase.Cluster);
      done();
    });

    it('should add cluster with buckets set to instance of Map', (done) => {
      const bm = sofaking.clusters.get('foo').buckets;
      assert.instanceOf(bm, Map);
      done();
    });

    it('should add entry to bucket map for each cluster bucket key', (done) => {
      const hasIt = sofaking.clusters.get('foo').buckets.has('default');
      assert.isTrue(hasIt);
      done();
    });

    it('should emit error if no buckets defined by config', () => {
      const noneProvider = {
        load: function(callback) {
          process.nextTick(() => {
            callback(undefined, {
              clusters: {
                test: {
                  cnstr: 'couchbase://blorg',
                  buckets: {}
                }
              },
              repositories: {
                test: {
                  cluster: 'test',
                  bucket: 'test'
                }
              }
            });
          });
        }
      };

      const sk = new Sofaking(couchbase);
      sk.on('error', (err) => {
        assert.instanceOf(err, TypeError);
        done();
      })
      .load([noneProvider]);
    });

    it('should not overwrite existing buckets', (done) => {
      const noneProvider = {
        load: function(callback) {
          process.nextTick(() => {
            callback(undefined, {
              clusters: {
                test: {
                  cnstr: 'couchbase://blorg',
                  options: {},
                  buckets: {
                    test: {}
                  }
                }
              },
              repositories: {
                test: {
                  cluster: 'test',
                  bucket: 'test'
                }
              }
            });
          });
        }
      };

      sofaking.load([noneProvider], (err, res) => {
        const hasIt = sofaking.clusters.has('test');
        assert.isTrue(hasIt);
        done();
      });
    });

    it('should emit error if bucket conf undefined', () => {
      const noneProvider = {
        load: function(callback) {
          process.nextTick(() => {
            callback(undefined, {
              clusters: {
                test: {
                  cnstr: 'couchbase://blorg',
                  buckets: undefined
                }
              },
              repositories: {
                test: {
                  cluster: 'test',
                  bucket: 'test'
                }
              }
            });
          });
        }
      };

      const sk = new Sofaking(couchbase);
      sk.on('error', (err) => {
        assert.instanceOf(err, TypeError);
        done();
      })
      .load([noneProvider]);
    });

    it('should emit error if bucket conf not object', () => {
      const noneProvider = {
        load: function(callback) {
          process.nextTick(() => {
            callback(undefined, {
              clusters: {
                test: {
                  cnstr: 'couchbase://blorg',
                  buckets: 42
                }
              },
              repositories: {
                test: {
                  cluster: 'test',
                  bucket: 'test'
                }
              }
            });
          });
        }
      };

      const sk = new Sofaking(couchbase);
      sk.on('error', (err) => {
        assert.instanceOf(err, TypeError);
        done();
      })
      .load([noneProvider]);
    });

    it('should emit error if password is not string', () => {
      const noneProvider = {
        load: function(callback) {
          process.nextTick(() => {
            callback(undefined, {
              clusters: {
                test: {
                  cnstr: 'couchbase://blorg',
                  buckets: {
                    test: {
                      password: 42
                    }
                  }
                }
              },
              repositories: {
                test: {
                  cluster: 'test',
                  bucket: 'test'
                }
              }
            });
          });
        }
      };

      const sk = new Sofaking(couchbase);
      sk.on('error', (err) => {
        assert.instanceOf(err, TypeError);
        done();
      })
      .load([noneProvider]);
    });

    it('should open bucket with name', (done) => {
      const noneProvider = {
        load: function(callback) {
          process.nextTick(() => {
            callback(undefined, {
              clusters: {
                test: {
                  cnstr: 'couchbase://blorg',
                  buckets: {
                    test: {}
                  }
                }
              },
              repositories: {
                test: {
                  cluster: 'test',
                  bucket: 'test'
                }
              }
            });
          });
        }
      };

      let calledName = '';
      const Cluster = function() {};

      Cluster.prototype.openBucket = function(name, password, callback) {
        const bucket = {};
        calledName = name;
        process.nextTick(() => {
          callback(undefined, bucket);
        });
      };

      const sk = new Sofaking({ Cluster: Cluster });
      sk.load([noneProvider], (err, res) => {
        assert.strictEqual(calledName, 'test');
        done();
      });
    });

    it('should open bucket with password when supplied', (done) => {
      const password = 'hello';
      const noneProvider = {
        load: function(callback) {
          process.nextTick(() => {
            callback(undefined, {
              clusters: {
                test: {
                  cnstr: 'couchbase://blorg',
                  buckets: {
                    test: {
                      password: password
                    }
                  }
                }
              },
              repositories: {
                test: {
                  cluster: 'test',
                  bucket: 'test'
                }
              }
            });
          });
        }
      };

      let calledPass = '';
      const Cluster = function() {};

      Cluster.prototype.openBucket = function(name, password, callback) {
        const bucket = {};
        calledPass = password;
        process.nextTick(() => {
          callback(undefined, bucket);
        });
      };

      const sk = new Sofaking({ Cluster: Cluster });
      sk.load([noneProvider], (err, res) => {
        assert.strictEqual(calledPass, password);
        done();
      });
    });

    it('should open bucket with null password when not supplied', (done) => {
      const noneProvider = {
        load: function(callback) {
          process.nextTick(() => {
            callback(undefined, {
              clusters: {
                test: {
                  cnstr: 'couchbase://blorg',
                  buckets: {
                    test: {}
                  }
                }
              },
              repositories: {
                test: {
                  cluster: 'test',
                  bucket: 'test'
                }
              }
            });
          });
        }
      };

      let calledPass = '';
      const Cluster = function() {};

      Cluster.prototype.openBucket = function(name, password, callback) {
        const bucket = {};
        calledPass = password;
        process.nextTick(() => {
          callback(undefined, bucket);
        });
      };

      const sk = new Sofaking({ Cluster: Cluster });
      sk.load([noneProvider], (err, res) => {
        assert.isNull(calledPass);
        done();
      });
    });

    it('should emit error event when thrown by openBucket', (done) => {
      const noneProvider = {
        load: function(callback) {
          process.nextTick(() => {
            callback(undefined, {
              clusters: {
                test: {
                  cnstr: 'couchbase://blorg',
                  buckets: {
                    test: {}
                  }
                }
              },
              repositories: {
                test: {
                  cluster: 'test',
                  bucket: 'test'
                }
              }
            });
          });
        }
      };

      let calledPass = '';
      const Cluster = function() {};

      Cluster.prototype.openBucket = function(name, password, callback) {
        process.nextTick(() => {
          callback(new TestProviderError());
        });
      };

      const sk = new Sofaking({ Cluster: Cluster });
      sk.on('error', (err) => {
        assert.instanceOf(err, TestProviderError);
        done();
      })
      .load([noneProvider]);
    });

    it('should emit bucket event when bucket successfully opened', (done) => {
      const noneProvider = {
        load: function(callback) {
          process.nextTick(() => {
            callback(undefined, {
              clusters: {
                test: {
                  cnstr: 'couchbase://blorg',
                  buckets: {
                    test: {}
                  }
                }
              },
              repositories: {
                test: {
                  cluster: 'test',
                  bucket: 'test'
                }
              }
            });
          });
        }
      };

      const sk = new Sofaking(couchbase);
      sk.on('bucket', (bkt) => {
        assert.isOk(bkt);
        done();
      })
      .load([noneProvider]);
    });

    it('should add bucket with name set to key', (done) => {
      const noneProvider = {
        load: function(callback) {
          process.nextTick(() => {
            callback(undefined, {
              clusters: {
                test: {
                  cnstr: 'couchbase://blorg',
                  buckets: {
                    test: {}
                  }
                }
              },
              repositories: {
                test: {
                  cluster: 'test',
                  bucket: 'test'
                }
              }
            });
          });
        }
      };

      const sk = new Sofaking(couchbase);
      sk.on('bucket', (bkt) => {
        assert.strictEqual(bkt.name, 'test');
        done();
      })
      .load([noneProvider]);
    });

    it('should should not overwrite existing repo mappings', (done) => {
      const noneProvider = {
        load: function(callback) {
          process.nextTick(() => {
            callback(undefined, {
              clusters: {
                test: {
                  cnstr: 'couchbase://blorg',
                  buckets: {
                    test: {}
                  }
                }
              },
              repositories: {
                bar: {
                  cluster: 'test',
                  bucket: 'test'
                }
              }
            });
          });
        }
      };

      sofaking.load([noneProvider], (err, res) => {
        assert.notStrictEqual(sofaking.repositories.get('bar').name, 'test');
        done();
      });
    });

    it('should emit error if repo config is undefined', () => {
      const noneProvider = {
        load: function(callback) {
          process.nextTick(() => {
            callback(undefined, {
              clusters: {
                test: {
                  cnstr: 'couchbase://blorg',
                  buckets: {
                    test: {}
                  }
                }
              },
              repositories: {
                test: undefined
              }
            });
          });
        }
      };

      const sk = new Sofaking(couchbase);
      sk.on('error', (err) => {
        assert.instanceOf(err, TypeError);
        done();
      })
      .load([noneProvider]);
    });

    it('should emit error if repo config is empty', () => {
      const noneProvider = {
        load: function(callback) {
          process.nextTick(() => {
            callback(undefined, {
              clusters: {
                test: {
                  cnstr: 'couchbase://blorg',
                  buckets: {
                    test: {}
                  }
                }
              },
              repositories: {}
            });
          });
        }
      };

      const sk = new Sofaking(couchbase);
      sk.on('error', (err) => {
        assert.instanceOf(err, TypeError);
        done();
      })
      .load([noneProvider]);
    });

    it('should emit error if repo config cluster is not string', () => {
      const noneProvider = {
        load: function(callback) {
          process.nextTick(() => {
            callback(undefined, {
              clusters: {
                test: {
                  cnstr: 'couchbase://blorg',
                  buckets: {
                    test: {}
                  }
                }
              },
              repositories: {
                test: {
                  cluster: 42,
                  bucket: 'test'
                }
              }
            });
          });
        }
      };

      const sk = new Sofaking(couchbase);
      sk.on('error', (err) => {
        assert.instanceOf(err, TypeError);
        done();
      })
      .load([noneProvider]);
    });

    it('should emit error if repo config cluster length is 0', () => {
      const noneProvider = {
        load: function(callback) {
          process.nextTick(() => {
            callback(undefined, {
              clusters: {
                test: {
                  cnstr: 'couchbase://blorg',
                  buckets: {
                    test: {}
                  }
                }
              },
              repositories: {
                test: {
                  cluster: '',
                  bucket: 'test'
                }
              }
            });
          });
        }
      };

      const sk = new Sofaking(couchbase);
      sk.on('error', (err) => {
        assert.instanceOf(err, TypeError);
        done();
      })
      .load([noneProvider]);
    });

    it('should emit error if repo config bucket is not string', () => {
      const noneProvider = {
        load: function(callback) {
          process.nextTick(() => {
            callback(undefined, {
              clusters: {
                test: {
                  cnstr: 'couchbase://blorg',
                  buckets: {
                    test: {}
                  }
                }
              },
              repositories: {
                test: {
                  cluster: 'test',
                  bucket: 42
                }
              }
            });
          });
        }
      };

      const sk = new Sofaking(couchbase);
      sk.on('error', (err) => {
        assert.instanceOf(err, TypeError);
        done();
      })
      .load([noneProvider]);
    });

    it('should emit error if repo config bucket length is 0', () => {
      const noneProvider = {
        load: function(callback) {
          process.nextTick(() => {
            callback(undefined, {
              clusters: {
                test: {
                  cnstr: 'couchbase://blorg',
                  buckets: {
                    test: {}
                  }
                }
              },
              repositories: {
                test: {
                  cluster: 'test',
                  bucket: ''
                }
              }
            });
          });
        }
      };

      const sk = new Sofaking(couchbase);
      sk.on('error', (err) => {
        assert.instanceOf(err, TypeError);
        done();
      })
      .load([noneProvider]);
    });

    it('should emit error if mapped repo cluster does not exist', () => {
      const noneProvider = {
        load: function(callback) {
          process.nextTick(() => {
            callback(undefined, {
              clusters: {
                test: {
                  cnstr: 'couchbase://blorg',
                  buckets: {
                    test: {}
                  }
                }
              },
              repositories: {
                test: {
                  cluster: 'barf',
                  bucket: 'test'
                }
              }
            });
          });
        }
      };

      const sk = new Sofaking(couchbase);
      sk.on('error', (err) => {
        assert.instanceOf(err, _e.InvalidClusterMappingError);
        done();
      })
      .load([noneProvider]);
    });

    it('should emit error if mapped repo bucket does not exist', () => {
      const noneProvider = {
        load: function(callback) {
          process.nextTick(() => {
            callback(undefined, {
              clusters: {
                test: {
                  cnstr: 'couchbase://blorg',
                  buckets: {
                    test: {}
                  }
                }
              },
              repositories: {
                test: {
                  cluster: 'test',
                  bucket: 'barf'
                }
              }
            });
          });
        }
      };

      const sk = new Sofaking(couchbase);
      sk.on('error', (err) => {
        assert.instanceOf(err, _e.InvalidBucketMappingError);
        done();
      })
      .load([noneProvider]);
    });

    it('should add reference to mapped Bucket instance for repo', (done) => {
      const noneProvider = {
        load: function(callback) {
          process.nextTick(() => {
            callback(undefined, {
              clusters: {
                test: {
                  cnstr: 'couchbase://blorg',
                  buckets: {
                    test: {}
                  }
                }
              },
              repositories: {
                test: {
                  cluster: 'test',
                  bucket: 'test'
                }
              }
            });
          });
        }
      };

      const sk = new Sofaking(couchbase);
      sk.load([noneProvider], (err, res) => {
        assert.isOk(sk.repositories.get('test').bucket);
        done();
      });
    });
  });

  describe('#on', () => {
    it('should throw if eventName is not a string', () => {
      const sk = new Sofaking();
      assert.throws(() => {
        sk.on(42, (callback) => { callback(); });
      }, TypeError);
    });

    it('should throw if eventName length is zero', () => {
      const sk = new Sofaking();
      assert.throws(() => {
        sk.on('', (callback) => { callback(); });
      }, TypeError);
    });

    it('should throw if listener not a function', () => {
      const sk = new Sofaking();
      assert.throws(() => {
        sk.on('config', 42);
      }, TypeError);
    });

    it('should throw if eventName is unknown', () => {
      const sk = new Sofaking();
      assert.throws(() => {
        sk.on('nope', (callback) => { callback(); });
      });
    });

    it('should return self', () => {
      const sk = sofaking.on('config', () => { console.log('hai'); });
      assert.strictEqual(sk, sofaking);
    });
  });

  describe('#getBucket', () => {
    it('should throw if repository arg is not a string', () => {
      assert.throws(() => {
        const bucket = sofaking.getBucket(42);
      }, TypeError);
    });

    it('should throw if unknown repository', () => {
      assert.throws(() => {
        const bucket = sofaking.getBucket('nope');
      }, _e.UnknownRepositoryError);
    });

    it('should return mapped bucket', (done) => {
      const mapped = sofaking.clusters.get('foo').buckets.get('default').bucket;
      const result = sofaking.getBucket('bar');
      assert.strictEqual(result, mapped);
      done();
    });
  });

  describe('#getBucketName', () => {
    it('should throw if repository arg is not a string', () => {
      assert.throws(() => {
        const bucket = sofaking.getBucketName(42);
      }, TypeError);
    });

    it('should throw if unknown repository', () => {
      assert.throws(() => {
        const bucket = sofaking.getBucketName('nope');
      }, _e.UnknownRepositoryError);
    });

    it('should return mapped bucket name', (done) => {
      const result = sofaking.getBucketName('bar');
      assert.strictEqual(result, 'default');
      done();
    });
  });

});
