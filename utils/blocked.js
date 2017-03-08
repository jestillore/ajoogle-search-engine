let blocked = [
  'wow.com',
  'when.com',
  'youtube.com',
  'about.com',
]

let reg = blocked.join('|')

module.exports = new RegExp(reg)