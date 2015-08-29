var async = require('async')
var Twit = require('twit')
var extend = require('xtend')
var fs = require('fs')
var yaml = require('yamljs')

var config = yaml.load('./config.yml')


function MetaTwit(auths){
  this.auths = auths
  this.twits = auths.map(function(auth){ return new Twit(auth) })
  this._currentTwitIndex = 0
  this._currentTwit = this.twits[0]
}

MetaTwit.prototype.get = function(endpoint, opts, cb) {
  var self = this
  this._currentTwit.get(endpoint, opts, function(err){
    if (err) {
      console.log('rotating auth...')
      // rotate auth
      self.rotateAuth(function(){
        // try again
        self.get(endpoint, opts, cb)
      })
    } else {
      // call cb normally
      cb.apply(null, arguments)
    }
  })
}

MetaTwit.prototype.rotateAuth = function(cb) {
  this._currentTwitIndex++
  if (this._currentTwitIndex >= this.auths.length) {
    // that was the last auth, wait then roll over
    console.log('hit rate limit...', new Date())
    this._currentTwitIndex = 0
    setTimeout(cb, 15*60*1000) // 15min
  } else {
    console.log('using next twit...')
    // use next twit
    this._currentTwit = this.twits[this._currentTwitIndex]
    setTimeout(cb)
  }
}

// =======================================================

var targetUsername = process.argv[2]

var T = new MetaTwit(config.auths)
dumpFollowers(targetUsername)

// =======================================================

function dumpFollowers(name){
  var filename = './dumps/'+name +'.json'
  console.log('dumping followers for '+name+' to '+filename+'....')
  getFollowers({ screen_name: name }, function(err, result){
    var data = JSON.stringify(result, null, 2)
    console.log('complete. saving....')
    fs.writeFileSync(filename, data)
  })
}

function getFollowers(opts, cb) {
  var followers = []
  getFollowerIds(opts, function(err, ids){
    var chunks = chunkify(ids, 100)
    async.eachSeries(chunks, function(chunk, cb){
      lookupUsers(chunk, function(err, users){
        followers = followers.concat(users)
        cb()
      })
    }, function(){
      cb(null, followers)
    })
  })
}

function lookupUsers(chunk, cb){
  console.log('(req) lookup users by chunk ('+chunk.length+')')
  T.get('users/lookup', { user_id: chunk },  function (err, data, response) {
    cb(null, data)
  })
}


function getFollowerIds(opts, cb){
  var ids = []
  console.log('get followers list')
  recurseRequest('followers/ids', opts, function(err, result){
    result.forEach(function(data){
      ids = ids.concat(data.ids)
    })
    console.log('found followers ('+ids.length+')')
    cb(null, ids)
  })
}

function recurseRequest(endpoint, opts, cb){
  var result = []
  performRequest(0)

  function performRequest(cursor){
    if (cursor) {
      opts = extend(opts, { cursor: cursor })
    }
    console.log('(req) requesting chunk')
    T.get(endpoint, opts,  function (err, data, response) {
      // got result
      result.push(data)
      // still cursing
      if (data.next_cursor) {
        performRequest(data.next_cursor)
      // completed
      } else {
        cb(null, result)
      }
    })
  }
}

function chunkify(arr, maxSize){
  var arr = arr.slice()
  var chunks = []
  while(arr.length) {
    chunks.push(arr.splice(0,maxSize))
  }
  return chunks
}
