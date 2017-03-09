'use strict'

let links = [
    'http://localhost:5000',
    'http://localhost:5000',
    'http://localhost:5000',
]

module.exports = {
    search: (query, cb) => {
        cb(null, links)
    }
}
