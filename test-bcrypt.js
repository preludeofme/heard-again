const bcrypt = require('bcrypt');
const hash = '$2a$10$K7L.GeqI.JnBz5Ezu8xXu.O0J.Dz5Wj7YjQ0QmJq7y9VwF.DqDqK';
bcrypt.compare('demo123', hash).then(res => {
  console.log('Match:', res);
});
