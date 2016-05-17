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

now.handleRequest = function handleRequest(config, callback, selector) {
  return new Promise((resolve, reject) => {
    this.request(config)
      .then((res) => {
        const data = selector ? res.data[selector] : res.data;

        resolve(data);
        this.handleCallback(callback, undefined, data);
      })
      .catch((err) => {
        const errData = err.data.err ? err.data.err : err.data;

        reject(errData);
        this.handleCallback(callback, errData);
      });
  });
};

now.deployments = function deployments(callback) {
  return this.handleRequest({ url: '/deployments', method: 'get' }, callback, 'deployments');
};

now.deployment = function deployment(id, callback) {
  return this.handleRequest({ url: `/deployments/${id}`, method: 'get' }, callback);
};

now.files = function files(id, callback) {
  return this.handleRequest({ url: `/deployments/${id}/files`, method: 'get' }, callback);
};

now.file = function file(id, fileId, callback) {
  return this.handleRequest({ url: `/deployments/${id}/files/${fileId}`, method: 'get' }, callback);
};

// DELETE /now/deployments/:id

// POST /now/deployments

module.exports = Now;
