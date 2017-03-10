'use strict'

const ENGINES = require('./list')
const request = require('request')
const cheerio = require('cheerio')
let current = 0

class Engine {
  static search (query, cb) {

    if (current >= ENGINES.length) {
      current = 0
    }

    let engine = ENGINES[current]

    current += 1

    console.log(engine)
    console.log(query)

    request({
      url: engine,
      qs: {q: query.q},
      json: true
    }, (error, response, urls) => {
      if (!error && urls && urls.length > 0) {
        cb(null, urls)
      } else {
        Engine.search(query, cb)
      }
    })
  }
}

module.exports = Engine