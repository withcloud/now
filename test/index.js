const Now = require('../lib/now');

const TOKEN = process.env.TEST_NOW_TOKEN;

const now = Now(TOKEN);

now.deployments().then((data) => {
  console.log(data);
}).catch((err) => {
  console.log(err);
});
