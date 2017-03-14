'use strict'

const env = process.env.NODE_ENV || 'development'
const config = require('config')
const MAIN_SERVER = process.env.MAIN || config.get('main')
const PORT = process.env.PORT || config.get('port')
const WebShot = require('./webshot')
const request = require('request')
const del = require('del')

class QueryProcessor {

    constructor(engine, sender_id, query, query_id, max) {
        this.engine = engine
        this.sender_id = sender_id
        this.query = query
        this.query_id = query_id
        this.max = max
        this.successCount = 0
        this.linkProcessIndex = 0
        this.imageSendIndex = 0
        this.stopped = false
        this.processQuery()

        return this
    }

    getQueryId() {
        return this.query_id
    }

    processQuery() {
        this.engine.search({
            q: this.query,
            max: 10
        }, (err, result) => {
            console.log('Search results')
            console.log(result)
            if (err) {
                this.finished(err)
                return
            }

            this.links = result

            if (this.links.length === 0) {
                this.finished()
                return
            }

            this.max = this.links.length > this.max ? this.max : this.links.length

            if (this.canContinue())
              this.generateImageUrls()
            else
              this.finished()
        })
    }

    generateImageUrls() {

        let link = this.links[this.linkProcessIndex]
        this.webshot = new WebShot(link)
        this.webshot
            .filePrefix(this.sender_id)
            .includeImages(this.includeImages())
            .capture((err, image_urls) => {
                if (err) {
                    console.log('Webshot error: ', err)
                    this.nextLink()
                } else {
                    this.successCount += 1
                    this.eachLinkResult(image_urls)
                }
            })

    }

    eachLinkResult(image_urls) {
        console.log(image_urls)
        if (image_urls.length > 0) {
            this.imageSendIndex = 0
            this.sendBatchImage(image_urls)
        } else {
          this.nextLink()
        }
    }

    nextLink() {
      if (this.canContinue()) {
        this.linkProcessIndex += 1
        this.generateImageUrls()
      } else {
        if (!this.stopped)
          this.finished()
      }
    }

    canContinue() {
        return (this.successCount < this.max) && (this.linkProcessIndex <= this.links.length - 2) && !this.stopped
    }

    includeImages() {
        let image_keywords = [
            'photo',
            'image',
            'picture',
            'pic',
            'background',
            'wallpaper',
            'graphic',
            'logo',
            'icon',
            'design',
            'animate',
        ]

        let imgReg = new RegExp(`(\\s)?(${image_keywords.join('|')})(\\s|s)?`)

        return imgReg.test(this.query.toLowerCase())
    }

    sendText(text) {
        if (this.stopped) return
        request({
            baseUrl: MAIN_SERVER,
            uri: '/send-text',
            qs: {
                sender_id: this.sender_id,
                text,
                query_id: this.query_id
            }
        }, function(err) {
            if (err)
                console.log(err.toString())
            else
                console.log(`Successfully sent message: ${text}`)
        })
    }

    sendImage(image_url, callback) {
        if (this.stopped) return
        request({
            baseUrl: MAIN_SERVER,
            uri: '/send-image',
            qs: {
                sender_id: this.sender_id,
                image_url,
                query_id: this.query_id
            }
        }, (err) => {
            if (err)
                console.log(err.toString())
            else
                console.log(`Successfully sent ${image_url}`)

            callback()

        })
    }

    sendBatchImage(image_urls) {

        this.sendImage(image_urls[this.imageSendIndex], () => {
            if (this.imageSendIndex < image_urls.length - 1) {
                this.imageSendIndex += 1
                setTimeout(() => {
                    this.sendBatchImage(image_urls)
                }, 1500)
            } else {
                this.imageSendIndex = 0
                this.nextLink()
            }
        })

    }

    finished() {
        setTimeout(() => {
            if (this.successCount > 0)
                this.sendText(`End of search results for "${this.query}".`)
            else
                this.sendText(`No results found for "${this.query}".`)
        }, 2500)
        this.doneCallback()
    }

    stop() {
        this.stopped = true
        if (this.webshot) this.webshot.stop()
        if (this.doneCallback) this.doneCallback()
        console.log('Stopped query: ' + this.query)
    }

    done(fn) {
        this.doneCallback = fn
    }

}

module.exports = QueryProcessor
