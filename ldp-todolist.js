var converter = new Showdown.converter();

var Todo = React.createClass({
  render: function() {
    var rawMarkup = converter.makeHtml(this.props.children.toString());
    return (
      <div className="todo">
        <h4><span dangerouslySetInnerHTML={{__html: rawMarkup}} /></h4>
        {this.props.assignee}
      </div>
    );
  }
});

var TodoList = React.createClass({
  render: function() {
    var todoNodes = this.props.data.map(function(todo) {
      return (
        <Todo assignee={todo.assignee}>
          {todo.label}
        </Todo>
      );
    });
    return (
      <div className="todoList">
        {todoNodes}
      </div>
    );
  }
});

var TodoForm = React.createClass({
  handleSubmit: function(e) {
    e.preventDefault();
    var assignee = this.refs.assignee.getDOMNode().value.trim();
    var label = this.refs.label.getDOMNode().value.trim();
    if(!assignee || !label) return;
    
    this.props.onNewTodo({assignee: assignee, label: label});
    this.refs.assignee.getDOMNode().value = '';
    this.refs.label.getDOMNode().value = '';
  },
  render: function() {
    return (
      <form className="todoForm" onSubmit={this.handleSubmit}>
        <h4>Add a new task</h4>
        <input type="text" placeholder="The task assignee" ref="assignee" />
        <input type="text" placeholder="What do you need to do today?" ref="label" />
        <input type="submit" value="Post" />
      </form>
    );
  }
});

var TodoBox = React.createClass({
  fetchTodos: function() {
    fetchAll(this.props.url, this.setState.bind(this));
  },
  handleNewTodo: function(todo) {
    this.setState({data: this.state.data.concat([todo])});
    store.add(this.props.url, todoParser([todo]), function(){});
  },
  getInitialState: function() {
    return {data: []};
  },
  componentDidMount: function() {
    this.fetchTodos();
//    setInterval(this.fetchTodos, this.props.pollInterval);
  },
  render: function() {
    return (
      <div className="todoBox">
        <h2>Todo List!</h2>
        <TodoList data={this.state.data} />
        <TodoForm onNewTodo={this.handleNewTodo}/>
      </div>
    );
  }
});

myTodos = React.render(
  <TodoBox url="https://localhost:8443/2013/todos/" pollInterval={2000} />,
  document.getElementById('todolist')
);

