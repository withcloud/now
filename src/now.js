const axios = require('axios');

function Now(token) {
  if (!(this instanceof Now)) return new Now(token);
  this.token = token;
  this.request = axios.create({
    baseURL: 'https://api.zeit.co/now',
    timeout: 3000,
    headers: { Authorization: `Bearer ${token}` },
  });
}

const now = Now.prototype;

now.handleCallback = function handleCallback(callback, err, data) {
  if (typeof callback === 'function') {
    callback(err, data);
  }
};

now.handleRequest = function handleRequest(path, selector, callback) {
  return new Promise((resolve, reject) => {
    this.request.get(path)
      .then((res) => {
        const data = selector ? res.data[selector] : res.data;

        resolve(data);
        this.handleCallback(callback, undefined, data);
      })
      .catch((err) => {
        const errData = err.data.err;
        reject(errData);
        this.handleCallback(callback, errData);
      });
  });
};

now.deployments = function deployments(callback) {
  return this.handleRequest('/deployments', 'deployments', callback);
};

module.exports = Now;
