[![Build Status](https://travis-ci.org/timolins/now-api.svg)](https://travis-ci.org/timolins/now-api)

# 𝚫 now API

Node.js module to interact with official [𝚫 now API](https://zeit.co/api). You need to provide your API token, which you can find in `~/.now.json`.


```sh
npm install now-api
```
## Example
```js
var Now = require('now-api');

var now = Now('YOUR TOKEN');

// Supports Promises
now.getDeployments().then((deployments) => {
    console.log(deployments);
}).catch((err) => {
    console.error(err);
});

// Or go old-school with callbacks
now.getDeployments(function(err, deployments) {
    if (err) throw err;
    console.log(deployments);
});
```

## API Reference
**Kind**: global class  

* [Now](#Now)
    * [new Now(token)](#new_Now_new)
    * [.getDeployments([callback])](#Now+getDeployments) ⇒ <code>Promise</code>
    * [.getDeployment(id, [callback])](#Now+getDeployment) ⇒ <code>Promise</code>
    * [.createDeployment(body, [callback])](#Now+createDeployment) ⇒ <code>Promise</code>
    * [.deleteDeployment(id, [callback])](#Now+deleteDeployment) ⇒ <code>Promise</code>
    * [.getFiles(id, [callback])](#Now+getFiles) ⇒ <code>Promise</code>
    * [.getFile(id, fileId, [callback])](#Now+getFile) ⇒ <code>Promise</code>
    * [.getAliases([id OR callback], [callback])](#Now+getAliases) ⇒ <code>Promise</code>
    * [.createAlias(id, alias, [callback])](#Now+createAlias) ⇒ <code>Promise</code>
    * [.deleteAlias(id, [callback])](#Now+deleteAlias) ⇒ <code>Promise</code>

<a name="new_Now_new"></a>

### new Now(token)
Initializes the API.


| Param | Type | Description |
| --- | --- | --- |
| token | <code>String</code> | Your now API token. |

<a name="Now+getDeployments"></a>

### now.getDeployments([callback]) ⇒ <code>Promise</code>
Returns an array with all deployments.

**Kind**: instance method of <code>[Now](#Now)</code>  
**See**: https://zeit.co/api#list-endpoint  

| Param | Type | Description |
| --- | --- | --- |
| [callback] | <code>function</code> | Callback will be called with `(err, deployments)` |

<a name="Now+getDeployment"></a>

### now.getDeployment(id, [callback]) ⇒ <code>Promise</code>
Returns an object with deployment data.

**Kind**: instance method of <code>[Now](#Now)</code>  
**See**: https://zeit.co/api#get-endpoint  

| Param | Type | Description |
| --- | --- | --- |
| id | <code>String</code> | ID of deployment |
| [callback] | <code>function</code> | Callback will be called with `(err, deployment)` |

<a name="Now+createDeployment"></a>

### now.createDeployment(body, [callback]) ⇒ <code>Promise</code>
Creates a new deployment and returns its data.

**Kind**: instance method of <code>[Now](#Now)</code>  
**See**: https://zeit.co/api#instant-endpoint  

| Param | Type | Description |
| --- | --- | --- |
| body | <code>Object</code> | Object a package key (for package.json data). The other keys should represent a file path, with their respective values containing the file contents. |
| [callback] | <code>function</code> | Callback will be called with `(err, deployment)` |

<a name="Now+deleteDeployment"></a>

### now.deleteDeployment(id, [callback]) ⇒ <code>Promise</code>
Deletes a deployment and returns its data.

**Kind**: instance method of <code>[Now](#Now)</code>  
**See**: https://zeit.co/api#rm-endpoint  

| Param | Type | Description |
| --- | --- | --- |
| id | <code>String</code> | ID of deployment |
| [callback] | <code>function</code> | Callback will be called with `(err, deployment)` |

<a name="Now+getFiles"></a>

### now.getFiles(id, [callback]) ⇒ <code>Promise</code>
Returns an array with the file structure.

**Kind**: instance method of <code>[Now](#Now)</code>  
**See**: https://zeit.co/api#file-structure-endpoint  

| Param | Type | Description |
| --- | --- | --- |
| id | <code>String</code> | ID of deployment |
| [callback] | <code>function</code> | Callback will be called with `(err, fileStructure)` |

<a name="Now+getFile"></a>

### now.getFile(id, fileId, [callback]) ⇒ <code>Promise</code>
Returns the content of a file.

**Kind**: instance method of <code>[Now](#Now)</code>  
**See**: https://zeit.co/api#file--endpoint  

| Param | Type | Description |
| --- | --- | --- |
| id | <code>String</code> | ID of deployment |
| fileId | <code>String</code> | ID of the file |
| [callback] | <code>function</code> | Callback will be called with `(err, file)` |

<a name="Now+getAliases"></a>

### now.getAliases([id OR callback], [callback]) ⇒ <code>Promise</code>
Returns an array with all aliases.

**Kind**: instance method of <code>[Now](#Now)</code>  
**See**: https://zeit.co/api#user-aliases  

| Param | Type | Description |
| --- | --- | --- |
| [id OR callback] | <code>String</code> &#124; <code>function</code> | ID of deployment or callback |
| [callback] | <code>function</code> | Callback will be called with `(err, aliases)` |

<a name="Now+createAlias"></a>

### now.createAlias(id, alias, [callback]) ⇒ <code>Promise</code>
Creates a new alias for the given deployment.

**Kind**: instance method of <code>[Now](#Now)</code>  
**See**: https://zeit.co/api#create-alias  

| Param | Type | Description |
| --- | --- | --- |
| id | <code>String</code> | ID of deployment |
| alias | <code>String</code> | Hostname or custom url for the alias |
| [callback] | <code>function</code> | Callback will be called with `(err, data)` |

<a name="Now+deleteAlias"></a>

### now.deleteAlias(id, [callback]) ⇒ <code>Promise</code>
Deletes a alias and returns a status.

**Kind**: instance method of <code>[Now](#Now)</code>  
**See**: https://zeit.co/api#delete-user-aliases  

| Param | Type | Description |
| --- | --- | --- |
| id | <code>String</code> | ID of alias |
| [callback] | <code>function</code> | Callback will be called with `(err, status)` |

