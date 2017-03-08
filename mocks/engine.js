'use strict'

let links = [
    'https://www.youtube.com/xxxxx',
    'https://en.wikipedia.org/wiki/Albert_Einstein',
    'http://adonespitogo.com',
    // 'http://www.azlyrics.com/lyrics/brunomars/versaceonthefloor.html',
]

module.exports = {
    search: (query, cb) => {
        cb(null, links)
    }
}
