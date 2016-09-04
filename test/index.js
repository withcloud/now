const chai = require('chai')
const Now = require('../dist/now')

chai.should()

const TOKEN = process.env.TEST_NOW_TOKEN

if (!TOKEN) {
  throw new Error('now token not provided')
}

describe('Now', function tests() {
  this.timeout(60000) // Wait 1 minute, since deleting a deployment takes forever.

  const now = new Now(TOKEN)

  let instanceId
  let fileId
  let aliasId

  it('should create deployment', done => {
    now.createDeployment({
      package: {
        name: 'test-deployment',
        scripts: {
          start: 'node index'
        }
      },
      'index.js': 'console.log("Unit Test!")'
    })
    .then(data => {
      data.should.be.an('object')
      instanceId = data.uid
      done()
    })
    .catch(err => {
      done(new Error(err.message))
    })
  })

  it('should retrieve deployments', done => {
    now.getDeployments()
    .then(data => {
      data.should.be.an('array')
      done()
    }).catch(err => {
      done(new Error(err.message))
    })
  })

  it('should return error on timeout (and other network errors)', () => {
    const nowWithShortTimeout = new Now(TOKEN)
    nowWithShortTimeout.axios.defaults.timeout = 1
    return nowWithShortTimeout.getDeployments().then(() => {
      throw new Error('promise should be rejected due to timeout')
    }).catch(err => {
      err.should.be.a('string')
    })
  })

  it('should retrieve deployments via callback', done => {
    now.getDeployments((err, data) => {
      if (err) {
        return done(new Error(err.message))
      }

      data.should.be.an('array')
      return done()
    })
  })

  it('should retrieve single deployment', done => {
    now.getDeployment(instanceId)
    .then(data => {
      data.should.be.an('object')
      done()
    }).catch(err => {
      done(new Error(err.message))
    })
  })

  it('should retrieve file list from deployment', done => {
    now.getFiles(instanceId)
    .then(data => {
      data.should.be.an('array')
      const file = data[0]
      file.type.should.be.a('string')

      fileId = file.uid

      done()
    }).catch(err => {
      done(new Error(err.message))
    })
  })

  it('should retrieve file content from deployment', done => {
    now.getFile(instanceId, fileId)
    .then(data => {
      data.should.be.a('string')

      done()
    }).catch(err => {
      done(new Error(err.message))
    })
  })

  it('should create alias', done => {
    now.createAlias(instanceId, `${instanceId}.now.sh`)
    .then(data => {
      data.should.be.an('object')
      aliasId = data.uid
      aliasId.should.be.a('string')
      done()
    })
    .catch(err => {
      done(new Error(err.message))
    })
  })

  it('should retrieve aliases', done => {
    now.getAliases()
    .then(data => {
      data.should.be.an('array')
      done()
    }).catch(err => {
      done(new Error(err.message))
    })
  })

  it('should retrieve aliases via callback', done => {
    now.getAliases((err, data) => {
      if (err) {
        return done(new Error(err.message))
      }

      data.should.be.an('array')
      return done()
    })
  })

  it('should retrieve aliases from deployment', done => {
    now.getAliases(instanceId)
    .then(data => {
      data.should.be.an('array')
      data[0].uid.should.equal(aliasId)
      done()
    }).catch(err => {
      done(new Error(err.message))
    })
  })

  it('should remove alias', done => {
    now.deleteAlias(aliasId)
    .then(data => {
      data.should.be.an('object')
      data.status.should.equal('SUCCESS')

      done()
    }).catch(err => {
      done(new Error(err.message))
    })
  })

  it('should remove deployment', done => {
    now.deleteDeployment(instanceId)
    .then(data => {
      data.should.be.an('object')
      data.uid.should.equal(instanceId)
      data.state.should.equal('DELETED')

      done()
    }).catch(err => {
      done(new Error(err.message))
    })
  })
})
