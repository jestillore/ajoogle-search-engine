'use strict'


// https://devcenter.heroku.com/articles/node-concurrency
const throng = require('throng')
const WORKERS = process.env.WEB_CONCURRENCY || 1;
const config = require('config')
const maxClient = process.env.MAX_CLIENT || config.get('maxClient')
var clientCount = 0

throng({
    start: start,
    workers: WORKERS,
    lifetime: Infinity
});

function start() {

    const env = process.env.NODE_ENV || 'development'
    const express = require('express')
    const request = require('request')
    const webshot = require('webshot')
    const path = require('path')
    const del = require('del')
    const chopImage = require('./utils/chop-image')
    const MAIN = process.env.MAIN || config.get('main')
    const SERVER = process.env.SERVER || config.get('server')
    const PORT = process.env.PORT || config.get('port')
    const TOKEN = process.env.TOKEN || config.get('token')

    let engine = require('./engines/ddg')

    // mock some services on local
    if (env === 'development') {
        engine = require('./mocks/engine')
    }

    let webshotOptions = {
        screenSize: {
            width: 1024,
            height: 768
        },
        shotSize: {
            width: 1024,
            height: 'all'
        },
        streamType: 'jpg'
    }

    const app = express()

    function validateToken(req, res, next) {
        if (req.query.token !== TOKEN)
            res.status(401).send()
        else
            next()
    }

    app.use(express.static('public'))

    app.get('/', validateToken, function(req, res) {

        if (clientCount >= maxClient) {
            var e = `\n\nMax client limit (${maxClient}) reached!!!\n\n`
            console.log(e)
            res.status(422).json({ message: e })
            return
        }
        clientCount++

        console.log(`Received request: ${JSON.stringify(req.query)}`)

        let sender_id = req.query.sender_id
        let q = req.query.query
        let max = req.query.max * 1

        engine.search({
            q,
            max: 10
        }, (err, links) => {

            console.log(links)
            if (err) {
                console.log(err.toString())
                clientCount = clientCount - 1
                return sendText(sender_id, `No search results can be foud for "${q}"`)
            }

            max = links.length > max ? max : links.length

            processLinks(links, 0, sender_id, max, 0, function() {
                clientCount = clientCount - 1
                setTimeout(() => {
                    sendText(sender_id, `End of search results for "${q}"`)
                    console.log(`Deleting files ./public/${sender_id}*`)
                    if (env === 'production') {
                        del([`./public/${sender_id}*`]).then(paths => {
                            console.log('Deleted file:\n', paths.join('\n'));
                        })
                    }
                }, 2500)
            })

        })

        res.send()

    })

    function processLinks(links, index, sender_id, max, successCount, doneCallback) {
        let link = links[index]

        getWebsiteImage(link, sender_id, function(err, filename) {

            console.log(filename)

            if (err) {
                console.log(err.toString())
                next()
                return
            }

            successCount += 1

            processImage(filename, sender_id, next)

        })

        function next() {
            console.log(`successCount: ${successCount}`)
            if (successCount >= max || index >= links.length) {
                doneCallback()
            } else {
                processLinks(links, index + 1, sender_id, max, successCount, doneCallback)
            }
        }
    }

    function getWebsiteImage(link, sender_id, callback) {
        var resultFile = `./public/${sender_id}-${(new Date()).getTime()}.jpg`

        console.log(`Capturing ${link}`)
        webshot(link, resultFile, webshotOptions, function(err) {

            if (!err) console.log(`Image saved to ${resultFile}`)

            callback(err, resultFile)
        })
    }

    function processImage(filePath, sender_id, callback) {

        let image_urls = []

        chopImage(filePath, function each(choppedFile, index, next) {

            let base_url = (env === 'development') ? `${SERVER}:${PORT}` : SERVER
            let image_url = `${base_url}/${path.basename(choppedFile)}`
                // let postback_url = `${base_url}/postback?sender_id=sender_id&filename=${path.basename(choppedFile)}&token=${TOKEN}`

            image_urls.push(image_url)

            next()

            // sendImage(sender_id, image_url, postback_url, function() {
            //     next()
            // })

        }, function done() {

            sendBatchImage(sender_id, image_urls, 0, function() {
                setTimeout(function() {
                    callback()
                }, 1500)
            })


        })

    }

    function sendBatchImage(sender_id, image_urls, index, callback) {

        sendImage(sender_id, image_urls[index], function() {
            if (index < image_urls.length - 1) {
                setTimeout(function() {
                    sendBatchImage(sender_id, image_urls, index + 1, callback)
                }, 1500)
            } else {
                if (callback) callback()
            }
        })

    }

    function sendImage(sender_id, image_url, callback) {
        request({
            baseUrl: MAIN,
            uri: '/send-image',
            qs: {
                sender_id,
                image_url
            }
        }, function(err) {
            if (err)
                console.log(err.toString())
            else
                console.log(`Successfully sent ${image_url}`)
            if (callback) callback()
        })
    }


    function sendText(sender_id, text, callback) {
        request({
            baseUrl: MAIN,
            uri: '/send-text',
            qs: {
                sender_id,
                text
            }
        }, function(err) {
            if (err)
                console.log(err.toString())
            else
                console.log(`Successfully sent message: ${text}`)
            if (callback) callback()
        })
    }

    // app.get('/postback', validateToken, function(req, res) {
    //     console.log(`Postback: ${JSON.stringify(req.query)}`)
    //         // del([`./public/${req.query.filename}`]).then(paths => {
    //         //     console.log('Deleted file:\n', paths.join('\n'));
    //         // })
    //     res.send()
    // })

    app.listen(PORT, () => {
        console.log('Node app is running on port', PORT)
    })

}
