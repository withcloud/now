const axios = require('axios');

const ERROR = {
  MISSING_ID: {
    code: 'missing_id',
    message: 'Missing `id` parameter',
  },
  MISSING_FILE_ID: {
    code: 'missing_file_id',
    message: 'Missing `fileId` parameter',
  },
  MISSING_BODY: {
    code: 'missing_body',
    message: 'Missing `body` parameter',
  },
  MISSING_PACKAGE: {
    code: 'missing_package',
    message: 'Missing `package` object in body',
  },
};

function Now(token) {
  if (!(this instanceof Now)) return new Now(token);
  this.token = token;
  this.axios = axios.create({
    baseURL: 'https://api.zeit.co/now',
    timeout: 5000,
    headers: { Authorization: `Bearer ${token}` },
  });
}

Now.prototype = {
  handleCallback: function handleCallback(callback, err, data) {
    if (typeof callback === 'function') {
      callback(err, data);
    }
  },

  handleError: function handleCallback(err, callback) {
    return new Promise((resolve, reject) => {
      reject(err);
      this.handleCallback(callback, err);
    });
  },

  handleRequest: function handleRequest(config, callback, selector) {
    return new Promise((resolve, reject) => {
      this.axios.request(config)
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
  },

  getDeployments: function getDeployments(callback) {
    return this.handleRequest({
      url: '/deployments',
      method: 'get',
    }, callback, 'deployments');
  },

  getDeployment: function getDeployment(id, callback) {
    if (!id) return this.handleError(ERROR.MISSING_ID, callback);

    return this.handleRequest({
      url: `/deployments/${id}`,
      method: 'get',
    }, callback);
  },

  createDeployment: function createDeployment(body, callback) {
    if (!body) return this.handleError(ERROR.MISSING_BODY, callback);
    if (!body.package) return this.handleError(ERROR.MISSING_PACKAGE, callback);

    return this.handleRequest({
      url: '/deployments',
      method: 'post',
      data: body,
    }, callback);
  },

  deleteDeployment: function deleteDeployment(id, callback) {
    if (!id) return this.handleError(ERROR.MISSING_ID, callback);

    return this.handleRequest({
      url: `/deployments/${id}`,
      method: 'delete',
    }, callback);
  },

  getFiles: function getFiles(id, callback) {
    if (!id) return this.handleError(ERROR.MISSING_ID, callback);

    return this.handleRequest({
      url: `/deployments/${id}/files`,
      method: 'get',
    }, callback);
  },

  getFile: function getFile(id, fileId, callback) {
    if (!id) return this.handleError(ERROR.MISSING_ID, callback);
    if (!fileId) return this.handleError(ERROR.MISSING_FILE_ID, callback);

    return this.handleRequest({
      url: `/deployments/${id}/files/${fileId}`,
      method: 'get',
    }, callback);
  },
};

module.exports = Now;
