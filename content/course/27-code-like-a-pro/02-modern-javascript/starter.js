// Works, but it's written like 2010. Rewrite it as subscriberEmails(users) in modern style,
// and return each address only once.
function getEmails(users) {
  var result = [];
  for (var i = 0; i < users.length; i++) {
    if (users[i].subscribed == true) {
      if (users[i].email != null && users[i].email != "") {
        result.push(users[i].email.toLowerCase());
      }
    }
  }
  return result;
}
