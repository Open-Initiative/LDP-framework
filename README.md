# LDP-Framework
Simple framework for LDP achitectures

This javascript framework enables you to build an application based on the LDP architecture.
Just create js objects and forget about the server. The framework handles that for you!

##Features
See index.html as an example.

### Store Initialization
`new MyStore({options...})`
Allowed options:
* container: iri used as the default container
* context: iri used as the default json-ld context
* template: main template, used as a default for render operations
* partials: other templates to be used in rendering
* models: objects describing the models of the application, used by forms (See below)

### Add resource:
`store.save(object)`

### Get resource
```
store.get(objectIri).then(function(object){
  // Do something with the object
});
```
or to get the full resource when you have a partial or outdated object:
`store.get(object)`

### Update resource
```
object = store.get(objectIri);
object.property = value;
store.save(object);
```

### List resources of a container
```
store.list(containerIri).then(function(list) {
  list.forEach(function(object) {
    // Do something with each object
  });
});
```

### Delete resource
`store.delete(objectIri)`

### Create a container
`store.createContainer(containerName, parentContainer)`

### Render resource with template
```store.render('#div', resourceIri, '#template-script', context)```
Only the first parameter is required. For the others, the default given in initiatilization will be used.

### Asynchronous rendering
`{{{ldpeach object.ldp:contains "div"}}}`
Retrives all the resources of the given array, and renders them as they arrive. They are render in an element of the given tag. 

### Form handling
`{{{form 'mymodel'}}}`
Renders a form with the model. When submitted, the object is automatically created in the container given in the model.

#### Models
A model is described by a JSON object, containing possibly a container uri, and a set of fields, each of which containing a title and a name. For the todos used in the example, the model looks like this:
```
{'todos': {
    fields: [
        {title: "What do you need to do today?", name: "todos:label"},
        {title: "Who should do it?", name: "todos:assignee"}
    ],
    container: "todos/"
}}
```

For more information on how all this works, please check the wiki:
-> https://github.com/Open-Initiative/LDP-framework/wiki

## Installation process (for developers)
If you would like to contribute, please note that the main file (mystore.js) is compiled (and minified ?) using Browserify.

So if you fork the project, all modifications/contributions should be done in the non-compiled sources. The main source file is the ldpstore.js one, containing the MyStore class.

To compile the sources, you will need to install all the dependencies using NPM.
To be able able to compile, first install NodeJS and NPM:
```
sudo apt-get install nodejs npm
```

Then, launch the installation of all the dependencies from the root of the project folder using:
```
npm install
```

This command should create a node_modules folders containing the sources of all the dependencies listed in the package.json file (locate at the root of the project).
If you got error about the node command unknown (useful on Ubuntu for example) you will need to create an alias from the nodejs command to the node one:
```
sudo ln -s /usr/bin/nodejs /usr/bin/node
```

Then, install browserify:
```
sudo npm install -g browserify
```

Browserify will allow you to compile the sources right after you made modifications, to test on the compiled version and keep a setup close to production.
To compile the sources, use the following command:
```
browserify ldpstore.js -o mystore.js
```

##Dependencies

###Server side
You need an LDP server in order to serve data to your application.
This application has been tested with RwwPlay!
See https://github.com/Open-Initiative/LDP-Todo-List/wiki/Notes-on-installing-RwwPlay for installation

You can also test read-only templating features with RDF files served by a standard HTTP server.

###Client side
* RDF Extenstions
* RDF-Interface
* JSON-LD
* N3
* JQuery
* ES6 promises
* Handlebars
