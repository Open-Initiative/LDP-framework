function todoSerializer(graph) {
  return serializer.serialize(graph).map(function(node) {
    return {assignee: node[todoPrefix("assignee")], label: node[rdfsPrefix("label")]}
  });
}

function todoParser(todoList) {
  var graph = rdf.createGraph();
  graph.etag = etag;
  
  todoList.forEach(function(todo) {
    var id = rdf.NamedNode("");
    graph.add(rdf.createTriple(id, a, todoPrefix("Todo")));
    graph.add(rdf.createTriple(id, todoPrefix("assignee"), rdf.NamedNode(todo.assignee)));
    graph.add(rdf.createTriple(id, rdfsPrefix("label"), rdf.Literal(todo.label)));
  });
  
  return graph;
}

function fetchAll(url, callback) {
  list = [];
  store.graph(url, function(graph) {
    serializer.serialize(graph).map(function(node) {
      store.graph(node["@id"], function(graph){
        serializer.serialize(graph).map(function(node) {
          if(node[todoPrefix("assignee")] && node[rdfsPrefix("label")])
            list.push({assignee: node[todoPrefix("assignee")], label: node[rdfsPrefix("label")]});
        });
        callback({data: list});
      });
    });
    etag = graph.etag;
  });
}

function todoPrefix(x) { return rdf.NamedNode("http://openinitiative.com/owl/todos#"+x)};
function rdfsPrefix(x) { return rdf.NamedNode("http://www.w3.org/2000/01/rdf-schema#"+x)};
function rdfPrefix(x) { return rdf.NamedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#"+x)};
a = rdfPrefix("type");

store = new rdf.LdpStore();
serializer = new rdf.JsonLdSerializer();
