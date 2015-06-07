/* global Function:false */
'use strict';


var isNode = (typeof process !== 'undefined' && process.versions && process.versions.node);

var modCtx = (new Function('return this'))();


if (isNode) {
  module.exports = function (rdf) {
    modCtx = {};
    modCtx.rdf = rdf;
    modCtx.jsonld = require('jsonld');
    modCtx.Promise = require('es6-promise').Promise;
  };
}


var JsonLdUtils = {};

JsonLdUtils.funcTemplate = function (func) {
  return function (argument1, argument2) {
    return new modCtx.Promise(function (resolve, reject) {
      if (argument2 === undefined) {
        func(argument1, function (error, result) {
          if (error != null) {
            reject();
          } else {
            resolve(result);
          }
        });
      } else {
        func(argument1, argument2, function (error, result) {
          if (error != null) {
            reject();
          } else {
            resolve(result);
          }
        });
      }
    });
  };
};


JsonLdUtils.compact = JsonLdUtils.funcTemplate(modCtx.jsonld.compact);
JsonLdUtils.expand = JsonLdUtils.funcTemplate(modCtx.jsonld.expand);
JsonLdUtils.flatten = JsonLdUtils.funcTemplate(modCtx.jsonld.flatten);
JsonLdUtils.frame = JsonLdUtils.funcTemplate(modCtx.jsonld.frame);
JsonLdUtils.objectify = JsonLdUtils.funcTemplate(modCtx.jsonld.objectify);
JsonLdUtils.normalize = JsonLdUtils.funcTemplate(modCtx.jsonld.normalize);
JsonLdUtils.toRDF = JsonLdUtils.funcTemplate(modCtx.jsonld.toRDF);
JsonLdUtils.fromRDF = JsonLdUtils.funcTemplate(modCtx.jsonld.fromRDF);


/**
 * RESTful interface to a RDF-Ext Store using JSON-LD and Promises
 *
 * @param {rdf.Store} store
 * @param {Object} [options]
 * @constructor
 */
modCtx.rdf.JSONify = function (store, options) {
  this.etags = {};
  if (options == null) {
    options = {};
  }

  if (store == null) {
    var storeOptions = {};

    if ('corsProxy' in options) {
      storeOptions.request = modCtx.rdf.corsProxyRequest.bind(modCtx.rdf, options.corsProxy)
    }
    storeOptions.useEtag = true;
    store = new modCtx.rdf.promise.Store(
      new modCtx.rdf.LdpStore(storeOptions));
  }

  var
    parser = new modCtx.rdf.promise.Parser(new modCtx.rdf.JsonLdParser()),
    serializer = new modCtx.rdf.promise.Serializer(new modCtx.rdf.JsonLdSerializer()),
    routedContexts = {};

  // returns the document part of an hash IRI
  var documentIri = function (iri) {
    return iri.split('#', 2)[0];
  };

  // parse iri + object arguments
  var parseIriObjectsArgs = function (args) {
    if (typeof args[0] === 'string') {
      return {
        'iri': args[0],
        'objects': Array.prototype.slice.call(args).slice(1)
      };
    }

    return {
      'iri': '@id' in args[0] ? args[0]['@id'] : null,
      'objects': Array.prototype.slice.call(args).slice()
    };
  };

  // merges multiple JSON-LD objects into a single graph
  var objectsToGraph = function (iri, objects) {
    var
      graph = modCtx.rdf.createGraph(),
      parseAll = [];

    var addToGraph = function (subGraph) {
      graph.addAll(subGraph);
    };

    objects.forEach(function (object) {
      // use context routing of no context is defined
      if (!('@context' in object)) {
        object = JSON.parse(JSON.stringify(object));
        object['@context'] = findContext(iri);
      }

      // use IRI if no id is defined
      if (!('@id' in object)) {
        object['@id'] = iri;
      }

      parseAll.push(parser.parse(object, iri).then(addToGraph));
    });

    return modCtx.Promise.all(parseAll)
      .then(function () { return graph; });
  };

  // find a routing based context
  var findContext = function (iri) {
    for (var key in routedContexts) {
      var route = routedContexts[key];

      if ('startsWith' in route && iri.indexOf(route.startsWith) === 0) {
        return route.context;
      }

      if ('regexp' in route && route.regexp.test(iri)) {
        return route.context;
      }
    }

    return {};
  };

  /**
   * Fetches a JSON-LD object of the given IRI
   * If no context is given, it will try to get the context via routing,
   *
   * @param {String} iri IRI of the named graph
   * @param {Object} [context] JSON-LD context to compact the graph
   * @returns {Promise}
   */
  this.get = function get(object, context) {
    var iri;
    if (typeof object === 'string') {
        iri = object;
    } else {
        iri = object['@id'];
    }
    if (context == null) {
      context = findContext(iri);
    }

    return store.graph(documentIri(iri), {'useEtag': true})
      .then(function(graph) {this.etags[iri]=graph.etag;return serializer.serialize(graph)}.bind(this))
      .then(function (expanded) { return JsonLdUtils.frame(expanded, {}); })
      .then(function (framed) {
        var frame = framed['@graph'].reduce(function (p, c) { return (c['@id'] == iri ? c : p); }, {});
        return JsonLdUtils.compact(frame, context);
      });
  };

    //TODO: find out why ids get messed up
    this.resetId = function resetId(o) {
        if(o.id) {
            o['@id'] = o.id;
            delete o.id;
        }
        return o;
    }

    this.save = function save(object) {
        this.resetId(object);
        if('@id' in object)
            this.put(object);
        else
            this.add(this.container, object);
    }
    
    this.list = function list(containerIri) {
        return this.get(containerIri).then(function(container) {
            return container['http://www.w3.org/ns/ldp#contains'];
        });
    }
    
    this.move = function move(containerId) {
        this.list(containerId).then(function(objects) {
            objects.forEach(function(object) {
                this.get(object, context).then(function(object) {
                    delete object.id;
                    store.save(object);
                });
            }.bind(this));
        }.bind(this));
    }
    
    this.render = function render(containerIri, div, template, context) {
        var objects=[];
        this.list(containerIri).then(function(objectlist) {
            objectlist.forEach(function(object) {
                this.get(object, context).then(function(object){
                    objects.push(object);
                    $(div).html(template({objects: objects}));
                });
            }.bind(this));
        }.bind(this));
    }
    
  /**
   * Adds one or more JSON-LD objects to the given IRI
   *
   * @param {String} iri IRI of the named graph
   * @param {Object} objects one or more JSON-LD objects to add
   * @returns {Promise}
   */
  this.add = function () {
    var param = parseIriObjectsArgs(arguments);
    
    return objectsToGraph(param.iri, param.objects)
      .then(function (graph) { graph.etag=this.etags[param.iri];return store.add(documentIri(param.iri), graph, {'useEtag': true, 'method': 'POST'}); }.bind(this))
      .then(function (added, error) {
        return new modCtx.Promise(function (resolve, reject) {
          if (error != null) {
            return reject(error);
          }

          if (added.toArray().length === 0) {
            return reject('no triples added');
          }

          resolve();
        });
      });
  };    
  /**
   * Adds one or more JSON-LD objects to the given IRI
   *
   * @param {String} iri IRI of the named graph
   * @param {Object} objects one or more JSON-LD objects to add
   * @returns {Promise}
   */
  this.put = function () {
    var param = parseIriObjectsArgs(arguments);
    
    return objectsToGraph(param.iri, param.objects)
      .then(function (graph) { graph.etag=this.etags[param.iri];return store.add(documentIri(param.iri), graph, {'useEtag': true}); }.bind(this))
      .then(function (added, error) {
        return new modCtx.Promise(function (resolve, reject) {
          if (error != null) {
            return reject(error);
          }

          if (added.toArray().length === 0) {
            return reject('no triples added');
          }

          resolve();
        });
      });
  };

  /**
   * Merges n JSON-LD objects to the given IRI
   *
   * @param {String} iri IRI of the named graph
   * @param {Object} objects n JSON-LD objects to merge
   * @returns {Promise}
   */
  this.patch = function () {
    var param = parseIriObjectsArgs(arguments);

    return objectsToGraph(param.iri, param.objects)
      .then(function (graph) { return store.merge(documentIri(param.iri), graph); })
      .then(function (merged, error) {
        return new modCtx.Promise(function (resolve, reject) {
          if (error != null) {
            return reject(error);
          }

          if (merged.toArray().length === 0) {
            return reject('no triples merged');
          }

          resolve();
        });
      });
  };

  /**
   * Deletes the content of the given IRI
   *
   * Also deletes other objects in the same document !!!
   *
   * @param {String} iri IRI of the named graph
   * @returns {Promise}
   */
  this.delete = function (iri) {
    if (typeof iri !== 'string' && '@id' in iri) {
      iri = iri['@id'];
    }

    return store.delete(documentIri(iri))
      .then(function (success, error) {
        return new modCtx.Promise(function (resolve, reject) {
          if (error != null) {
            return reject(error);
          }

          if (!success) {
            return reject();
          }

          resolve();
        });
      });
  };

  /**
   * Assigns a JSON-LD context to a route
   *
   * @param {String|RegExp} path Path the IRI starts with or a RegExp to test
   * @param {Object} context JSON-LD context to compact the graph
   * @returns {JSONify}
   */
  this.addContext = function (path, context) {
    if (typeof path === 'string') {
      routedContexts[path] = {
        'startsWith': path,
        'context': context
      };
    } else if (path instanceof RegExp) {
      routedContexts[path] = {
        'regexp': path,
        'context': context
      };
    }

    return this;
  };
};


/**
 * RESTful cached read only interface for RDF-Ext Store using JSON-LD
 *
 * @param JSONify
 * @param {Object} [options]
 * @constructor
 */
modCtx.rdf.CachedJSONify = function (JSONify, options) {
  if (options == null) {
    options = {};
  }

  if (JSONify == null) {
    JSONify = new modCtx.rdf.JSONify(null, options);
  }

  var
    cache = {},
    queue = {};

  var enqueue = function (iri, context, callback) {
    if (iri in queue) {
      queue[iri].push(callback);
    } else {
      queue[iri] = [callback];

      JSONify.get(iri, context).then(function (data) {
        cache[iri] = data;

        for (var i = 0; i < queue[iri].length; i++) {
          queue[iri][i](data);
        }
      });
    }
  };

  /**
   * Fetches a JSON-LD object of the given IRI
   *
   * @param {String} iri IRI of the named graph
   * @param {Object} [context] JSON-LD context to compact the graph
   * @param {Function} callback Callback function if object isn't cached
   * @returns {Object}
   */
  this.get = function (iri) {
    var
      context = null,
      callback = arguments[arguments.length - 1];

    if (iri in cache) {
      return cache[iri];
    }

    if (arguments.length === 3) {
      context = arguments[1];
    }

    enqueue(iri, context, callback);

    return null;
  };

  /**
   * Clears the complete cache or if given for a single IRI
   *
   * @param {String} [iri] The IRI to clear
   * @returns {CachedJSONify}
   */
  this.clear = function (iri) {
    if (iri != null) {
      // clear object cache
      if (iri in cache) {
        delete cache[iri];
      }

      // clear queued callbacks
      if (iri in queue) {
        delete queue[iri];
      }
    } else {
      cache = {};
      queue = {};
    }

    return this;
  };

  /**
   * Assigns a JSON-LD context to a route
   *
   * See JSONify.addContext documentation
   *
   * @param {String|RegExp} path Path the IRI starts with or a RegExp to test
   * @param {Object} context JSON-LD context to compact the graph
   * @returns {CachedJSONify}
   */
  this.addContext = function (path, context) {
    JSONify.addContext(path, context);

    return this;
  };
};
