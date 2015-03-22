var AddressBox = React.createClass({
  render: function() {
    var address = store.get(this.props.address);
    return (
      <span>
        {address['http://example.com/street']}
        {address['http://example.com/code']}
        {address['http://example.com/city']}
        {address['http://example.com/country']}
      </span>
    );
  }
});

var Profile = React.createClass({
  fetchProfile:  function() {
    this.setState({profile: store.get(store.get(this.props.user)["http://example.com/about"])});
  },
  getInitialState: function() {
    return {profile: {"http://example.com/name": "", "http://example.com/address": []}};
  },
  componentDidMount: function() {
    this.fetchProfile();
  },
  render: function() {
    if(!Array.isArray(this.state.profile["http://example.com/address"]))
      this.state.profile["http://example.com/address"] = [this.state.profile["http://example.com/address"]];
    var addresses = this.state.profile["http://example.com/address"].map(function(address, index) {
        return (
          <AddressBox address={address} key={index} />
        );
      });
    
    return (
      <div className="user">
        {this.state.profile["http://example.com/name"]}:
        {addresses}
      </div>
    );
  }
});

var UserList = React.createClass({
  render: function() {
    var userNodes = this.props.data.map(function(user, index) {
      return (
        <Profile user={user} key={index} />
      );
    });
    return (
      <div className="profileList">
        {userNodes}
      </div>
    );
  }
});

var UserListBox = React.createClass({
  fetchProfiles: function() {
    store.fetchAll(this.props.url, function(){
      this.setState({data: store.getType(schemaPrefix("Person"))});
    }.bind(this));
  },
  getInitialState: function() {
    return {data: []};
  },
  componentDidMount: function() {
    store = new Store();
    this.fetchProfiles();
    setInterval(this.fetchProfiles, this.props.pollInterval);
  },
  render: function() {
    return (
      <div className="profileBox">
        <h2>Profile browser</h2>
        <UserList data={this.state.data} />
      </div>
    );
  }
});

myProfiles = React.render(
  <UserListBox url="http://sylvain-lebon.alwaysdata.net/ldp/directory" pollInterval={60000} />,
  document.getElementById('profilebrowser')
);
