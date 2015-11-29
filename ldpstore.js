/* global Function:false */
'use strict';

require('jquery');
var Handlebars = require('handlebars');
require('rdf-ext');
require('jsonld');

var JsonLdUtils = {};
JsonLdUtils.funcTemplate = function (func) {
    return function (argument1, argument2) {
        return new Promise(function (resolve, reject) {
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


JsonLdUtils.compact = JsonLdUtils.funcTemplate(jsonld.compact);
JsonLdUtils.expand = JsonLdUtils.funcTemplate(jsonld.expand);
JsonLdUtils.flatten = JsonLdUtils.funcTemplate(jsonld.flatten);
JsonLdUtils.frame = JsonLdUtils.funcTemplate(jsonld.frame);
JsonLdUtils.objectify = JsonLdUtils.funcTemplate(jsonld.objectify);
JsonLdUtils.normalize = JsonLdUtils.funcTemplate(jsonld.normalize);
JsonLdUtils.toRDF = JsonLdUtils.funcTemplate(jsonld.toRDF);
JsonLdUtils.fromRDF = JsonLdUtils.funcTemplate(jsonld.fromRDF);


/**
 * RESTful interface to a RDF-Ext Store using JSON-LD and Promises
 *
 * @param {rdf.Store} store
 * @param {Object} [options]
 * @constructor
 */
 window.MyStore = function (options) {
     this.etags          = {};
     options             = options || {};
     this.container      = options.container;
     this.context        = options.context;
     this.models         = options.models;
     if('template' in options) this.mainTemplate = Handlebars.compile(options.template);

     // The partial definition for displaying a form field
     var fieldPartial = "<label for='{{name}}'>{{title}}</label> \
                         {{#ifCond type 'textarea'}} \
                           <textarea id='{{name}}' name='{{name}}' rows='10'>{{#if fieldValue}}{{fieldValue}}{{/if}}</textarea><br/>\
                         {{else}}\
                           {{#ifCond type 'checkbox'}} \
                             <input type='checkbox' name='{{name}}' id='{{name}}'/>\
                           {{else}}\
                             {{#ifCond type 'select'}} \
                               <select id='{{name}}' name='{{name}}'> \
                                 {{#each options}}{{> LDPOptions fieldValue='{{fieldValue}}' }}{{/each}} \
                             {{else}} \
                               <input id='{{name}}' type='text' placeholder='{{title}}' name='{{name}}' value='{{fieldValue}}' />\
                             {{/ifCond}}\
                           {{/ifCond}}\
                         {{/ifCond}}";
     Handlebars.registerPartial("LDPField", fieldPartial);

     // The partial definition for displaying an option field inside a select
     var optionPartial = "{{#ifCond value fieldValue}} \
                           <option value='{{value}}' selected>{{name}}</option>\
                         {{else}}\
                           <option value='{{value}}'>{{name}}</option>\
                         {{/ifCond}}";
     Handlebars.registerPartial("LDPOptions", optionPartial);

     var formTemplate = Handlebars.compile(
         "<form data-container='{{container}}' onSubmit='return store.handleSubmit(event);'> \
             {{#each fields}}{{> LDPField }}{{/each}} \
             <input type='submit' value='Post' /> \
         </form>");

     if('partials' in options)
         for(var partialName in options.partials)
             Handlebars.registerPartial(partialName, options.partials[partialName]);

     Handlebars.registerHelper("ldpeach", function(array, tagName, options) {
         var id = "ldp-"+Math.round(new Date().getTime() + (Math.random() * 10000));
         var objects = Array.isArray(array) ? array : [array];
         objects.forEach(function(object) {
             console.log(object);
             this.get(object, this.context).then(function(object) {
                 console.log(document.getElementById(id));
                 $('#'+id).append(options.fn(object));
             }.bind(this));
         }.bind(this));
         return '<'+ tagName +' id="'+id+'"></' + tagName + '>';
     }.bind(this));

     Handlebars.registerHelper('ldplist', function(obj) {
         return obj['ldp:contains'];
     });

     Handlebars.registerHelper('ifCond', function(value, tester, options) {
       if (value == tester) {
         return options.fn(this);
       } else {
         return options.inverse(this);
       }
     });

     Handlebars.registerHelper('form', function(context, options) {
         return formTemplate(this.models[context]);
     }.bind(this));

     var storeOptions = {};
     if ('corsProxy' in options)
         storeOptions.request = rdf.corsProxyRequest.bind(rdf, options.corsProxy);

     var store = options.store || new rdf.promise.Store(new rdf.LdpStore(storeOptions)),
         parser = new rdf.promise.Parser(new rdf.JsonLdParser()),
         serializer = new rdf.promise.Serializer(new rdf.JsonLdSerializer());

     // returns the document part of an hash IRI
     var documentIri = function (iri) {
         return iri.split('#', 2)[0];
     };

     // parse iri + object arguments
     //TODO: clean up argument syntax
     var parseIriObjectsArgs = function (args) {
         if (typeof args[1] === 'string') {
             return {
                 'headers': args[0],
                 'iri': args[1],
                 'objects': Array.prototype.slice.call(args).slice(2)
             };
         }
         if (typeof args[0] === 'string') {
             return {
                 'iri': args[0],
                 'headers': undefined,
                 'objects': Array.prototype.slice.call(args).slice(1)
             };
         }

         return {
             'iri': '@id' in args[0] ? args[0]['@id'] : null,
             'headers': undefined,
             'objects': Array.prototype.slice.call(args).slice()
         };
     };

     // merges multiple JSON-LD objects into a single graph
     this.objectsToGraph = function objectsToGraph(iri, objects) {
         var
             graph = rdf.createGraph(),
             parseAll = [];

         var addToGraph = function (subGraph) {
             graph.addAll(subGraph);
         };

         objects.forEach(function (object) {
             // use context routing of no context is defined
             if (!('@context' in object)) {
                 object = JSON.parse(JSON.stringify(object));
                 object['@context'] = this.context;
             }

             // use IRI if no id is defined
             if (!('@id' in object)) {
                 object['@id'] = iri;
             }

             parseAll.push(parser.parse(object, iri).then(addToGraph));
         }.bind(this));

         return Promise.all(parseAll)
             .then(function () { return graph; });
     };

     //TODO: find out why ids get messed up
     this.resetId = function resetId(o) {
         if(o.id) {
             o['@id'] = o.id;
             delete o.id;
         }
         return o;
     }

     this.reduceForm = function reduceForm(form) {
         return $(form).serializeArray().reduce(function(obj, field){
             obj[field.name] = field.value; return obj
         }, {});
     };

     this.handleSubmit = function handleSubmit(event) {
         this.save(this.reduceForm(event.target), event.target.dataset.container);
         event.stopPropagation();
         return false;
     }

     /**
      * Fetches a LDP resource of the given IRI
      * If no context given, takes the default one
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
             this.resetId(object);
             iri = object['@id'];
         }
         context = context || this.context;

         return store.graph(documentIri(iri), {'useEtag': true})
             .then(function(graph) {this.etags[iri]=graph.etag;return serializer.serialize(graph)}.bind(this))
             .then(function (expanded) { return JsonLdUtils.frame(expanded, {}); })
             .then(function (framed) {
                 var frame = framed['@graph'].reduce(function (p, c) { return (c['@id'] == iri ? c : p); }, {});
                 return JsonLdUtils.compact(frame, context);
             });
     };

     this.createContainer = function createContainer(containerName, parentIri) {
         var container = {'@type': 'ldp:BasicContainer'};
         this.add({'Slug': containerName, 'Link': '<http://www.w3.org/ns/ldp#BasicContainer>; rel="type"'}, this.getIri(parentIri), container);
     }

     this.save = function save(object, container) {
         this.resetId(object);
         if(!('@context' in object))
             object['@context'] = this.context;

         if('@id' in object)
             this.put(object);
         else
             this.add(this.getIri(container), object);
     }

     this.list = function list(containerIri) {
         return this.get(containerIri).then(function(container) {
             var objectList = container['ldp:contains'] || [];
             if('@id' in objectList)
                 objectList = [objectList];
             return objectList;
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

     this.getIri = function getIri(iri) {
         if(!iri) return this.container;
         if(iri.startsWith("http://")||iri.startsWith("https://")) return iri;
         return this.container + iri;
     }

     this.render = function render(div, objectIri, template, context, modelName, prefix) {
         var objectIri = this.getIri(objectIri);
         var template = template ? Handlebars.compile(template) : this.mainTemplate;
         var context = context || this.context;
         var fields = modelName ? this.models[modelName].fields : null;

         this.get(objectIri).then(function(object) {
             if (fields) {
               fields.forEach( function(fields) {
                 var propertyName = fields.name;
                 if (prefix) {
                   propertyName = propertyName.replace(prefix, '');
                 }

                 fields.fieldValue = object[propertyName];
               });
             }
             $(div).html(template({object: object}));
         });
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

        return this.objectsToGraph("", param.objects)
            .then(function (graph) { return store.add(documentIri(param.iri), graph, {'method': 'POST', 'headers': param.headers}); }.bind(this))
            .then(function (added, error) {
                return new Promise(function (resolve, reject) {
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

        return this.objectsToGraph(param.iri, param.objects)
            .then(function (graph) { graph.etag=this.etags[param.iri];return store.add(documentIri(param.iri), graph, {'useEtag': true}); }.bind(this))
            .then(function (added, error) {
                return new Promise(function (resolve, reject) {
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

        return this.objectsToGraph(param.iri, param.objects)
            .then(function (graph) { return store.merge(documentIri(param.iri), graph); })
            .then(function (merged, error) {
                return new Promise(function (resolve, reject) {
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
                return new Promise(function (resolve, reject) {
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
};
