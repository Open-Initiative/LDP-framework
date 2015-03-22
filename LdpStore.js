var Store = function () {
  this.store = new rdf.LdpStore();
  this.serializer = new rdf.JsonLdSerializer();
  this.graph = null;
  this.list = {};
}

Store.prototype.validate = function validate(node) {
  return true;
}

Store.prototype.getType = function getType(type) {
  return this.serializer.serialize(this.graph.match(null, a, type));
}

Store.prototype.get = function get(node) {
  return this.list[node["@id"]];
}

Store.prototype.fetchAll = function fetchAll(url, callback) {
  this.store.graph(url, function(graph) {
    this.graph = graph;
    this.serializer.serialize(this.graph).forEach(function(node) {this.list[node["@id"]] = node}.bind(this));
    if(callback)callback();
  }.bind(this));
}

function schemaPrefix(x) { return rdf.NamedNode("http://schema.org/"+x)};
function rdfsPrefix(x) { return rdf.NamedNode("http://www.w3.org/2000/01/rdf-schema#"+x)};
function rdfPrefix(x) { return rdf.NamedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#"+x)};
a = rdfPrefix("type");
