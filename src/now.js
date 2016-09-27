const path = require('path')
const os = require('os')

const axios = require('axios')

const ERROR = {
  MISSING_ID: {
    code: 'missing_id',
    message: 'Missing `id` parameter'
  },
  MISSING_FILE_ID: {
    code: 'missing_file_id',
    message: 'Missing `fileId` parameter'
  },
  MISSING_BODY: {
    code: 'missing_body',
    message: 'Missing `body` parameter'
  },
  MISSING_ALIAS: {
    code: 'missing_body',
    message: 'Missing `alias` parameter'
  },
  MISSING_NAME: {
    code: 'missing_name',
    message: 'Missing `name` parameter'
  },
  MISSING_VALUE: {
    code: 'missing_value',
    message: 'Missing `value` parameter'
  }
}

/**
 * Tries to obtain the API token and returns it.
 * If NOW_TOKEN isn't defined, it will search in the user's home directory
 * @return {String} – now API Token
 */
function _getToken() {
  let token = process.env.NOW_TOKEN

  if (!token) {
    try {
      const configPath = path.join(os.homedir(), '.now.json')
      token = require(configPath).token // eslint-disable-line global-require
    } catch (err) {
      console.error(`Error: ${err}`)
    }
  }

  return token
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
      '"~/.now.json" will be used, if it\'s found in your home directory.'
    )
  }

  if (!(this instanceof Now)) {
    return new Now(token)
  }

  this.token = token

  this.axios = axios.create({
    baseURL: 'https://api.zeit.co/now',
    timeout: 30000,
    headers: {
      Authorization: `Bearer ${token}`
    }
  })
}

Now.prototype = {
  // Checks if callback is present and fires it
  handleCallback: function handleCallback(callback, err, data) {
    if (typeof callback === 'function') {
      callback(err, data)
    }
  },

  // Handles errors with Promise and callback support
  handleError: function handleError(err, callback) {
    return new Promise((resolve, reject) => {
      reject(err)
      this.handleCallback(callback, err)
    })
  },

  // Processes requests
  handleRequest: function handleRequest(config, callback, selector) {
    return new Promise((resolve, reject) => {
      this.axios.request(config)
        .then(res => {
          const data = selector ? res.data[selector] : res.data
          resolve(data)
          this.handleCallback(callback, undefined, data)
        })

        .catch(err => {
          let errData
          if (err.data && err.data.err) {
            errData = err.data.err
          } else if (err.data) {
            errData = err.data
          } else {
            errData = err.toString()
          }
          reject(errData)
          this.handleCallback(callback, errData)
        })
    })
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
      method: 'get'
    }, callback, 'deployments')
  },

  /**
   * Returns an object with deployment data.
   * @return {Promise}
   * @param  {String} id     ID of deployment
   * @param  {Function} [callback]     Callback will be called with `(err, deployment)`
   * @see https://zeit.co/api#get-endpoint
   */
  getDeployment: function getDeployment(id, callback) {
    if (!id) {
      return this.handleError(ERROR.MISSING_ID, callback)
    }

    return this.handleRequest({
      url: `/deployments/${id}`,
      method: 'get'
    }, callback)
  },

  /**
   * Creates a new deployment and returns its data.
   * @return {Promise}
   * @param  {Object} body
   * The keys should represent a file path, with their respective values
   * containing the file contents.
   * @param  {Function} [callback]     Callback will be called with `(err, deployment)`
   * @see https://zeit.co/api#instant-endpoint
   */
  createDeployment: function createDeployment(body, callback) {
    if (!body) {
      return this.handleError(ERROR.MISSING_BODY, callback)
    }

    return this.handleRequest({
      url: '/deployments',
      method: 'post',
      data: body
    }, callback)
  },

  /**
   * Deletes a deployment and returns its data.
   * @return {Promise}
   * @param  {String} id     ID of deployment
   * @param  {Function} [callback]     Callback will be called with `(err, deployment)`
   * @see https://zeit.co/api#rm-endpoint
   */
  deleteDeployment: function deleteDeployment(id, callback) {
    if (!id) {
      return this.handleError(ERROR.MISSING_ID, callback)
    }

    return this.handleRequest({
      url: `/deployments/${id}`,
      method: 'delete'
    }, callback)
  },

  /**
   * Returns an array with the file structure.
   * @return {Promise}
   * @param  {String} id     ID of deployment
   * @param  {Function} [callback]     Callback will be called with `(err, fileStructure)`
   * @see https://zeit.co/api#file-structure-endpoint
   */
  getFiles: function getFiles(id, callback) {
    if (!id) {
      return this.handleError(ERROR.MISSING_ID, callback)
    }

    return this.handleRequest({
      url: `/deployments/${id}/files`,
      method: 'get'
    }, callback)
  },

  /**
   * Returns the content of a file either as string or object, depending on the filetype.
   * @return {Promise}
   * @param  {String} id     ID of deployment
   * @param  {String} fileId     ID of the file
   * @param  {Function} [callback]     Callback will be called with `(err, fileContent)`
   * @see https://zeit.co/api#file--endpoint
   */
  getFile: function getFile(id, fileId, callback) {
    if (!id) {
      return this.handleError(ERROR.MISSING_ID, callback)
    }

    if (!fileId) {
      return this.handleError(ERROR.MISSING_FILE_ID, callback)
    }

    return this.handleRequest({
      url: `/deployments/${id}/files/${fileId}`,
      method: 'get'
    }, callback)
  },

  /**
   * Returns an array with all aliases.
   * @return {Promise}
   * @param  {String|Function} [id OR callback]     ID of deployment or callback
   * @param  {Function} [callback]     Callback will be called with `(err, aliases)`
   * @see https://zeit.co/api#user-aliases
   */
  getAliases: function getAliases(id, callback) {
    let url = '/aliases'
    let _callback = callback /* eslint no-underscore-dangle: 0 */

    if (typeof id === 'function') {
      _callback = id
    } else if (typeof id === 'string') {
      url = `/deployments/${id}/aliases`
    }

    return this.handleRequest({
      url,
      method: 'get'
    }, _callback, 'aliases')
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
    if (!id) {
      return this.handleError(ERROR.MISSING_ID, callback)
    }

    if (!alias) {
      return this.handleError(ERROR.MISSING_ALIAS, callback)
    }

    return this.handleRequest({
      url: `/deployments/${id}/aliases`,
      method: 'post',
      data: {
        alias
      }
    }, callback)
  },

  /**
   * Deletes an alias and returns a status.
   * @return {Promise}
   * @param  {String} id     ID of alias
   * @param  {Function} [callback]     Callback will be called with `(err, status)`
   * @see https://zeit.co/api#delete-user-aliases
   */
  deleteAlias: function deleteAlias(id, callback) {
    if (!id) {
      return this.handleError(ERROR.MISSING_ID, callback)
    }

    return this.handleRequest({
      url: `/aliases/${id}`,
      method: 'delete'
    }, callback)
  },

  /**
   * Returns an array with all secrets.
   * @return {Promise}
   * @param  {String|Function} [id OR callback]     ID of deployment or callback
   * @param  {Function} [callback]     Callback will be called with `(err, secrets)`
   * @see https://zeit.co/api#get-now-secrets
   */
  getSecrets: function getSecrets(callback) {
    return this.handleRequest({
      url: '/secrets',
      method: 'get'
    }, callback, 'secrets')
  },

  /**
   * Creates a secret and returns its ID.
   * @return {Promise}
   * @param  {String} name     name for the secret
   * @param  {String} value     value for the secret
   * @param  {Function} [callback]     Callback will be called with `(err, data)`
   * @see https://zeit.co/api#post-now-secrets
   */
  createSecret: function createSecret(name, value, callback) {
    if (!name) {
      return this.handleError(ERROR.MISSING_NAME, callback)
    }

    if (!value) {
      return this.handleError(ERROR.MISSING_VALUE, callback)
    }

    return this.handleRequest({
      url: '/secrets',
      method: 'post',
      data: {
        name,
        value
      }
    }, callback)
  },

  /**
   * Changes the name of the given secret and returns its ID and name.
   * @return {Promise}
   * @param  {String} id     id or name of the secret
   * @param  {String} name     new name for the secret
   * @param  {Function} [callback]     Callback will be called with `(err, data)`
   * @see https://zeit.co/api#patch-now-secrets
   */
  renameSecret: function renameSecret(id, name, callback) {
    if (!id) {
      return this.handleError(ERROR.MISSING_ID, callback)
    }

    if (!name) {
      return this.handleError(ERROR.MISSING_NAME, callback)
    }

    return this.handleRequest({
      url: `/secrets/${id}`,
      method: 'patch',
      data: {
        name
      }
    }, callback)
  },

  /**
   * Deletes a secret and returns its ID.
   * @return {Promise}
   * @param  {String} id     ID or name of the secret
   * @param  {Function} [callback]     Callback will be called with `(err, status)`
   * @see https://zeit.co/api#delete-now-secrets
   */
  deleteSecret: function deleteSecret(id, callback) {
    if (!id) {
      return this.handleError(ERROR.MISSING_ID, callback)
    }

    return this.handleRequest({
      url: `/secrets/${id}`,
      method: 'delete'
    }, callback)
  }
}

module.exports = Now
