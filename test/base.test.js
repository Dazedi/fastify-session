'use strict'

const test = require('ava')
const fastifyPlugin = require('fastify-plugin')
const { testServer, request, DEFAULT_OPTIONS, DEFAULT_COOKIE, TIMEOUT_OPTIONS } = require('./util')

test('should set session cookie on post without params', async (t) => {
  t.plan(1)
  const port = await testServer((request, reply) => reply.send(200), DEFAULT_OPTIONS)

  const { statusCode } = await request({
    method: 'POST',
    url: `http://localhost:${port}/test`,
    headers: { 'content-type': 'application/json' }
  })
  t.is(statusCode, 400)
})

test('should set session cookie', async (t) => {
  t.plan(4)
  const port = await testServer((request, reply) => {
    request.session.test = {}
    reply.send(200)
  }, DEFAULT_OPTIONS)

  const { statusCode: statusCode1, cookie: cookie1 } = await request({
    url: `http://localhost:${port}`,
    headers: { 'x-forwarded-proto': 'https' }
  })

  t.is(statusCode1, 200)
  t.regex(cookie1, /sessionId=[\w-]{32}.[\w-%]{43,55}; Path=\/; HttpOnly; Secure/)

  const { statusCode: statusCode2, cookie: cookie2 } = await request({
    url: `http://localhost:${port}`,
    headers: { 'x-forwarded-proto': 'https' }
  })

  t.is(statusCode2, 200)
  t.regex(cookie2, /sessionId=[\w-]{32}.[\w-%]{43,55}; Path=\/; HttpOnly; Secure/)
})

test('should support multiple secrets', async (t) => {
  t.plan(2)
  const options = {
    secret: ['geheim', 'cNaoPYAwF60HZJzkcNaoPYAwF60HZJzk']
  }

  const plugin = fastifyPlugin(async (fastify, opts) => {
    fastify.addHook('preValidation', (request, reply, done) => {
      request.sessionStore.set('aYb4uTIhdBXCfk_ylik4QN6-u26K0u0e', {
        expires: Date.now() + 1000
      }, done)
    })
  })
  function handler (request, reply) {
    request.session.test = {}
    reply.send(200)
  }
  const port = await testServer(handler, options, plugin)

  const { statusCode, cookie } = await request({
    url: `http://localhost:${port}`,
    headers: {
      'x-forwarded-proto': 'https',
      cookie: 'sessionId=aYb4uTIhdBXCfk_ylik4QN6-u26K0u0e.eiVu2YbrcqbTUYTYaANks%2Fjn%2Bjta7QgpsxLO%2BOLN%2F4U; Path=/; HttpOnly; Secure'
    }
  })

  t.is(statusCode, 200)
  t.false(cookie.includes('aYb4uTIhdBXCfk_ylik4QN6-u26K0u0e'))
})

test('should set session cookie using the specified cookie name', async (t) => {
  t.plan(2)
  const options = {
    secret: 'cNaoPYAwF60HZJzkcNaoPYAwF60HZJzk',
    cookieName: 'anothername'
  }
  const port = await testServer((request, reply) => {
    request.session.test = {}
    reply.send(200)
  }, options)

  const { statusCode, cookie } = await request({
    url: `http://localhost:${port}`,
    headers: { 'x-forwarded-proto': 'https' }
  })

  t.is(statusCode, 200)
  t.regex(cookie, /anothername=[\w-]{32}.[\w-%]{43,55}; Path=\/; HttpOnly; Secure/)
})

test('should set session cookie using the default cookie name', async (t) => {
  t.plan(2)
  const plugin = fastifyPlugin(async (fastify, opts) => {
    fastify.addHook('preValidation', (request, reply, done) => {
      request.sessionStore.set('Qk_XT2K7-clT-x1tVvoY6tIQ83iP72KN', {
        expires: Date.now() + 1000,
        sessionId: 'Qk_XT2K7-clT-x1tVvoY6tIQ83iP72KN',
        cookie: { secure: true, httpOnly: true, path: '/' }
      }, done)
    })
  })
  function handler (request, reply) {
    request.session.test = {}
    reply.send(200)
  }
  const port = await testServer(handler, DEFAULT_OPTIONS, plugin)

  const { statusCode, cookie } = await request({
    url: `http://localhost:${port}`,
    headers: {
      cookie: DEFAULT_COOKIE,
      'x-forwarded-proto': 'https'
    }
  })

  t.is(statusCode, 200)
  t.regex(cookie, /sessionId=undefined; Path=\/; HttpOnly; Secure/)
})

test('should create new session on expired session', async (t) => {
  t.plan(2)
  const plugin = fastifyPlugin(async (fastify, opts) => {
    fastify.addHook('preValidation', (request, reply, done) => {
      request.sessionStore.set('Qk_XT2K7-clT-x1tVvoY6tIQ83iP72KN', {
        expires: Date.now() - 1000,
        sessionId: 'Qk_XT2K7-clT-x1tVvoY6tIQ83iP72KN',
        cookie: { secure: true, httpOnly: true, path: '/' }
      }, done)
    })
  })
  function handler (request, reply) {
    reply.send(200)
  }
  const options = {
    secret: 'cNaoPYAwF60HZJzkcNaoPYAwF60HZJzk',
    cookie: { maxAge: 100 }
  }
  const port = await testServer(handler, options, plugin)

  const { statusCode, cookie } = await request({
    url: `http://localhost:${port}`,
    headers: {
      cookie: DEFAULT_COOKIE,
      'x-forwarded-proto': 'https'
    }
  })

  t.is(statusCode, 200)
  t.regex(cookie, /sessionId=.*\..*; Path=\/; Expires=.*; HttpOnly; Secure/)
})

test('should set session.expires if maxAge', async (t) => {
  t.plan(2)
  const options = {
    secret: 'cNaoPYAwF60HZJzkcNaoPYAwF60HZJzk',
    cookie: { maxAge: 42 }
  }
  const plugin = fastifyPlugin(async (fastify, opts) => {
    fastify.addHook('preValidation', (request, reply, done) => {
      request.sessionStore.set('Qk_XT2K7-clT-x1tVvoY6tIQ83iP72KN', {
        expires: Date.now() + 1000
      }, done)
    })
  })
  function handler (request, reply) {
    t.truthy(request.session.expires)
    reply.send(200)
  }
  const port = await testServer(handler, options, plugin)

  const { statusCode } = await request({
    url: `http://localhost:${port}`,
    headers: { cookie: DEFAULT_COOKIE }
  })

  t.is(statusCode, 200)
})

test('should set new session cookie if expired', async (t) => {
  t.plan(3)

  const plugin = fastifyPlugin(async (fastify, opts) => {
    fastify.addHook('preValidation', (request, reply, done) => {
      request.sessionStore.set('Qk_XT2K7-clT-x1tVvoY6tIQ83iP72KN', {
        expires: Date.now() + 1000
      }, done)
    })
  })
  function handler (request, reply) {
    request.session.test = {}
    reply.send(200)
  }
  const port = await testServer(handler, DEFAULT_OPTIONS, plugin)

  const { statusCode, cookie } = await request({
    url: `http://localhost:${port}`,
    headers: {
      cookie: DEFAULT_COOKIE,
      'x-forwarded-proto': 'https'
    }
  })

  t.is(statusCode, 200)
  t.falsy(cookie.includes('Qk_XT2K7-clT-x1tVvoY6tIQ83iP72KN.B7fUDYXU9fXF9pNuL3qm4NVmSduLJ6kzCOPh5JhHGoE'))
  t.regex(cookie, /sessionId=[\w-]{32}.[\w-%]{43,55}; Path=\/; HttpOnly; Secure/)
})

test('should return new session cookie if does not exist in store', async (t) => {
  t.plan(3)
  const options = { secret: 'cNaoPYAwF60HZJzkcNaoPYAwF60HZJzk' }
  const port = await testServer((request, reply) => {
    request.session.test = {}
    reply.send(200)
  }, options)

  const { statusCode, cookie } = await request({
    url: `http://localhost:${port}`,
    headers: {
      cookie: DEFAULT_COOKIE,
      'x-forwarded-proto': 'https'
    }
  })

  t.is(statusCode, 200)
  t.false(cookie.includes('Qk_XT2K7-clT-x1tVvoY6tIQ83iP72KN.B7fUDYXU9fXF9pNuL3qm4NVmSduLJ6kzCOPh5JhHGoE'))
  t.regex(cookie, /sessionId=[\w-]{32}.[\w-%]{43,55}; Path=\/; HttpOnly; Secure/)
})

test('should not set session cookie on invalid path', async (t) => {
  t.plan(2)
  const options = {
    secret: 'cNaoPYAwF60HZJzkcNaoPYAwF60HZJzk',
    cookie: { path: '/path/' }
  }
  const port = await testServer((request, reply) => reply.send(200), options)

  const { response } = await request({
    url: `http://localhost:${port}`,
    headers: { 'x-forwarded-proto': 'https' }
  })

  t.is(response.statusCode, 200)
  t.true(response.headers['set-cookie'] === undefined)
})

test('should create new session if cookie contains invalid session', async (t) => {
  t.plan(3)
  const options = { secret: 'cNaoPYAwF60HZJzkcNaoPYAwF60HZJzk' }
  function handler (request, reply) {
    request.session.test = {}
    reply.send(200)
  }
  const plugin = fastifyPlugin(async (fastify, opts) => {
    fastify.addHook('preValidation', (request, reply, done) => {
      request.sessionStore.set('Qk_XT2K7-clT-x1tVvoY6tIQ83iP72KN', {
        expires: Date.now() + 1000
      }, done)
    })
  })
  const port = await testServer(handler, options, plugin)

  const { statusCode, cookie } = await request({
    url: `http://localhost:${port}`,
    headers: {
      cookie: 'sessionId=Qk_XT2K7-clT-x1tVvoY6tIQ83iP72KN.B7fUDYXx9fXF9pNuL3qm4NVmSduLJ6kzCOPh5JhHGoE; Path=/; HttpOnly; Secure',
      'x-forwarded-proto': 'https'
    }
  })

  t.is(statusCode, 200)
  t.false(cookie.includes('B7fUDYXx9fXF9pNuL3qm4NVmSduLJ6kzCOPh5JhHGoE'))
  t.regex(cookie, /sessionId=[\w-]{32}.[\w-%]{43,55}; Path=\/; HttpOnly; Secure/)
})

test('should not set session cookie if no data in session and saveUninitialized is false', async (t) => {
  t.plan(2)
  const options = {
    secret: 'cNaoPYAwF60HZJzkcNaoPYAwF60HZJzk',
    saveUninitialized: false
  }
  const port = await testServer((request, reply) => reply.send(200), options)

  const { response } = await request({
    url: `http://localhost:${port}`,
    headers: { 'x-forwarded-proto': 'https' }
  })

  t.is(response.statusCode, 200)
  t.true(response.headers['set-cookie'] === undefined)
})

test('session from express should stay intact', async (t) => {
  t.plan(3)
  const EXPRESS_COOKIE = "sessionId=s%3A6x2gHIV9xL7RA3yYDNUR9zigsJINYJR4.%2BV2zopUz3VMVCmJpZP6qu8BhOo7J4%2FnU9VznfWPhC0I; Path=/; Expires=Wed, 08 Sep 2021 10:18:44 GMT; HttpOnly; SameSite=Lax";
  const plugin = fastifyPlugin(async (fastify, opts) => {
    fastify.addHook('preValidation', (request, reply, done) => {
      request.sessionStore.set('6x2gHIV9xL7RA3yYDNUR9zigsJINYJR4', {
        cookie: { // express session contents
          path: '/',
          _expires: new Date(Date.now() + 60), // minute
          originalMaxAge: 3600000,
          httpOnly: true,
          secure: false,
          sameSite: 'lax'
        }
      }, done)
    })
  })
  function handler (request, reply) {
    reply.send(200)
  }
  const options = {
    secret: 'cNaoPYAwF60HZJzkcNaoPYAwF60HZJzk',
    cookie: { 
      maxAge: 3600000,
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
    },
    expressCompat: true,
  }
  const port = await testServer(handler, options, plugin)

  const { statusCode, cookie } = await request({
    url: `http://localhost:${port}`,
    headers: {
      cookie: EXPRESS_COOKIE,
      'x-forwarded-proto': 'https'
    }
  })

  t.is(statusCode, 200)
  t.true(cookie.includes('6x2gHIV9xL7RA3yYDNUR9zigsJINYJR4'))
  t.true(cookie.includes('Expires'))
})

test('should create new session since express session is old', async (t) => {
  t.plan(3)
  const EXPRESS_COOKIE = "sessionId=s%3A6x2gHIV9xL7RA3yYDNUR9zigsJINYJR4.%2BV2zopUz3VMVCmJpZP6qu8BhOo7J4%2FnU9VznfWPhC0I; Path=/; Expires=Wed, 08 Sep 2021 10:18:44 GMT; HttpOnly; SameSite=Lax";
  const plugin = fastifyPlugin(async (fastify, opts) => {
    fastify.addHook('preValidation', (request, reply, done) => {
      request.sessionStore.set('6x2gHIV9xL7RA3yYDNUR9zigsJINYJR4', {
        cookie: { // express session contents
          path: '/',
          _expires: new Date(Date.now() - 1000), // minute
          originalMaxAge: 3600000,
          httpOnly: true,
          secure: false,
          sameSite: 'lax'
        }
      }, done)
    })
  })
  function handler (request, reply) {
    reply.send(200)
  }
  const options = {
    secret: 'cNaoPYAwF60HZJzkcNaoPYAwF60HZJzk',
    cookie: { 
      maxAge: 3600000,
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
    },
    expressCompat: true,
  }
  const port = await testServer(handler, options, plugin)

  const { statusCode, cookie } = await request({
    url: `http://localhost:${port}`,
    headers: {
      cookie: EXPRESS_COOKIE,
      'x-forwarded-proto': 'https'
    }
  })

  t.is(statusCode, 200)
  t.false(cookie.includes('6x2gHIV9xL7RA3yYDNUR9zigsJINYJR4'))
  t.true(cookie.includes('Expires'))
})