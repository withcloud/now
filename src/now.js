const path = require('path');
const os = require('os');

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
  MISSING_ALIAS: {
    code: 'missing_body',
    message: 'Missing `alias` parameter',
  },
};

/**
 * Tries to obtain the API token and returns it.
 * If NOW_TOKEN isn't defined, it will search in the user's home directory
 * @return {String} – now API Token
 */
function _getToken() {
  let token = process.env.NOW_TOKEN;

  if (!token) {
    try {
      const configPath = path.join(os.homedir(), '.now.json');
      token = require(configPath).token; // eslint-disable-line global-require
    } catch (e) {
      console.error(`Error: ${e}`);
    }
  }
  return token;
}


/**
 * Initializes the API. Looks for token in ~/.now.json if none is provided.
 * @constructor
 * @param {String} [token] - Your now API token.
 */
function Now(token = _getToken()) {
  if (!token) {
    return console.error(
      'No token found! ' +
      'Supply it as argument or use the NOW_TOKEN env variable. ' +
      '".now.json" will be used, if it\'s found in your home directory.'
    );
  }
  if (!(this instanceof Now)) return new Now(token);
  this.token = token;
  this.axios = axios.create({
    baseURL: 'https://api.zeit.co/now',
    timeout: 5000,
    headers: { Authorization: `Bearer ${token}` },
  });
}

Now.prototype = {
  // Checks if callback is present and fires it
  handleCallback: function handleCallback(callback, err, data) {
    if (typeof callback === 'function') {
      callback(err, data);
    }
  },

  // Handles errors with Promise and callback support
  handleError: function handleError(err, callback) {
    return new Promise((resolve, reject) => {
      reject(err);
      this.handleCallback(callback, err);
    });
  },

  // Processes requests
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

  /**
   * Returns an array with all deployments.
   * @return {Promise}
   * @param  {Function} [callback]     Callback will be called with `(err, deployments)`
   * @see https://zeit.co/api#list-endpoint
   */
  getDeployments: function getDeployments(callback) {
    return this.handleRequest({
      url: '/deployments',
      method: 'get',
    }, callback, 'deployments');
  },

  /**
   * Returns an object with deployment data.
   * @return {Promise}
   * @param  {String} id     ID of deployment
   * @param  {Function} [callback]     Callback will be called with `(err, deployment)`
   * @see https://zeit.co/api#get-endpoint
   */
  getDeployment: function getDeployment(id, callback) {
    if (!id) return this.handleError(ERROR.MISSING_ID, callback);

    return this.handleRequest({
      url: `/deployments/${id}`,
      method: 'get',
    }, callback);
  },

  /**
   * Creates a new deployment and returns its data.
   * @return {Promise}
   * @param  {Object} body     Object a package key (for package.json data).
   * The other keys should represent a file path, with their respective values
   * containing the file contents.
   * @param  {Function} [callback]     Callback will be called with `(err, deployment)`
   * @see https://zeit.co/api#instant-endpoint
   */
  createDeployment: function createDeployment(body, callback) {
    if (!body) return this.handleError(ERROR.MISSING_BODY, callback);
    if (!body.package) return this.handleError(ERROR.MISSING_PACKAGE, callback);

    return this.handleRequest({
      url: '/deployments',
      method: 'post',
      data: body,
    }, callback);
  },

  /**
   * Deletes a deployment and returns its data.
   * @return {Promise}
   * @param  {String} id     ID of deployment
   * @param  {Function} [callback]     Callback will be called with `(err, deployment)`
   * @see https://zeit.co/api#rm-endpoint
   */
  deleteDeployment: function deleteDeployment(id, callback) {
    if (!id) return this.handleError(ERROR.MISSING_ID, callback);

    return this.handleRequest({
      url: `/deployments/${id}`,
      method: 'delete',
    }, callback);
  },

  /**
   * Returns an array with the file structure.
   * @return {Promise}
   * @param  {String} id     ID of deployment
   * @param  {Function} [callback]     Callback will be called with `(err, fileStructure)`
   * @see https://zeit.co/api#file-structure-endpoint
   */
  getFiles: function getFiles(id, callback) {
    if (!id) return this.handleError(ERROR.MISSING_ID, callback);

    return this.handleRequest({
      url: `/deployments/${id}/files`,
      method: 'get',
    }, callback);
  },

  /**
   * Returns the content of a file.
   * @return {Promise}
   * @param  {String} id     ID of deployment
   * @param  {String} fileId     ID of the file
   * @param  {Function} [callback]     Callback will be called with `(err, file)`
   * @see https://zeit.co/api#file--endpoint
   */
  getFile: function getFile(id, fileId, callback) {
    if (!id) return this.handleError(ERROR.MISSING_ID, callback);
    if (!fileId) return this.handleError(ERROR.MISSING_FILE_ID, callback);

    return this.handleRequest({
      url: `/deployments/${id}/files/${fileId}`,
      method: 'get',
    }, callback);
  },

  /**
   * Returns an array with all aliases.
   * @return {Promise}
   * @param  {String|Function} [id OR callback]     ID of deployment or callback
   * @param  {Function} [callback]     Callback will be called with `(err, aliases)`
   * @see https://zeit.co/api#user-aliases
   */
  getAliases: function getAliases(id, callback) {
    let url = '/aliases';
    let _callback = callback; /* eslint no-underscore-dangle: 0 */

    if (typeof id === 'function') {
      _callback = id;
    } else if (typeof id === 'string') {
      url = `/deployments/${id}/aliases`;
    }
    return this.handleRequest({
      url,
      method: 'get',
    }, _callback, 'aliases');
  },

  /**
   * Creates an alias for the given deployment.
   * @return {Promise}
   * @param  {String} id     ID of deployment
   * @param  {String} alias     Hostname or custom url for the alias
   * @param  {Function} [callback]     Callback will be called with `(err, data)`
   * @see https://zeit.co/api#create-alias
   */
  createAlias: function createAlias(id, alias, callback) {
    if (!id) return this.handleError(ERROR.MISSING_ID, callback);
    if (!alias) return this.handleError(ERROR.MISSING_ALIAS, callback);

    return this.handleRequest({
      url: `/deployments/${id}/aliases`,
      method: 'post',
      data: { alias },
    }, callback);
  },

  /**
   * Deletes an alias and returns a status.
   * @return {Promise}
   * @param  {String} id     ID of alias
   * @param  {Function} [callback]     Callback will be called with `(err, status)`
   * @see https://zeit.co/api#delete-user-aliases
   */
  deleteAlias: function deleteAlias(id, callback) {
    if (!id) return this.handleError(ERROR.MISSING_ID, callback);

    return this.handleRequest({
      url: `/aliases/${id}`,
      method: 'delete',
    }, callback);
  },
};

module.exports = Now;
