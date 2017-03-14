const config = require('config')
const ENV = process.env.NODE_ENV || 'development'
const SERVER = process.env.SERVER || config.get('server')
const PORT = process.env.PORT || config.get('port')
const SERVER_URL = (ENV === 'development') ? `${SERVER}:${PORT}` : SERVER
const phantom = require('phantom')
const path = require('path')
const fs = require('fs')
const adblock = require('./adblock')
const shotSize = {
    width: 1024,
    height: 1024 * (3 / 2) // aspec ratio 3:2
}
const viewportSize = {
    top: 0,
    left: 0,
    width: 1024,
    height: 768
}
const javascriptEnabled = true
const delay = 2000
const customJs = fs.readFileSync(path.join(__dirname, 'webshot-script.js'), 'utf8')
const format = 'jpg'

class WebShot {

    constructor(url) {
        this.url = url
        this.page = null;
        this.phInstance = null;
        this.imageUrls = []
        this.dimension = viewportSize
        this.numClips = 0
        return this
    }

    filePrefix(filePrefix) {
        this.filePrefix = filePrefix
        return this
    }

    includeImages(includeImages) {
        console.log(`Include Images: ${includeImages}`)
        this.includeImages = includeImages
        return this
    }

    capture(cb) {
        this.doneCb = cb
        this.preparePhantom()
    }

    preparePhantom() {
        console.log(`Preparing phantom`)
        phantom.create()
            .then(instance => {
                console.log(`Phantom ready.`)
                this.phInstance = instance
                return instance.createPage()
            })
            .then(page => {
                console.log(`Page ready.`)
                this.page = page
                this.outObj = this.phInstance.createOutObject()
                this.outObj.adblock = adblock
                page.on('onResourceRequested', true, function(requestData, networkRequest, out) {
                    // dont load ads and images
                    if (out.adblock(requestData.url) || (new RegExp(/(.*\.(?:png|jpg|gif|jpeg))/i)).test(requestData.url)) {
                        // console.log('Aborting resource: ' + requestData.url)
                        networkRequest.abort()
                    }
                }, this.outObj)
                this.setupPage()
            })
            .catch(err => {
                this.onError
            })
    }

    setupPage() {

        this.page.setting('javascriptEnabled', javascriptEnabled)
            .then(() => {
                this.page.property('viewportSize', viewportSize)
                    .then(() => {
                        console.log(`Openning URL: ${this.url}`)
                        this.page.open(this.url)
                            .then(status => {
                                if (status === 'success') {
                                    console.log(`Done loading URL: ${this.url}`)
                                    this.page.evaluateJavaScript(customJs)
                                        .then((dimsStr) => {
                                            this.dimension = JSON.parse(dimsStr)
                                            this.numClips = Math.round(this.dimension.height / shotSize.height)
                                            this.shotClipViews()
                                        })
                                        .catch(err => {
                                            this.onError(err)
                                        })
                                } else {
                                    let err = new Error(`Failed loading URL: ${this.url}`)
                                    this.onError(err)
                                }
                            })
                            .catch(err => {
                                this.onError(err)
                            })
                    })
                    .catch(err => {
                        this.onError
                    })
            })
            .catch(err => {
                this.onError
            })
    }

    shotClipViews(index) {
        index = index || 0
        let baseName = `${this.filePrefix}-${(new Date()).getTime()}.${format}`
        let fileName = path.join(__dirname, '../public', baseName)
        let top = index * shotSize.height
        let bottom = (index === this.numClips) ? (this.dimension.height % shotSize.height) : shotSize.height + 20

        this.page.property('clipRect', {
                top: top,
                left: 0,
                width: shotSize.width,
                height: bottom
            })
            .then(() => {
                this.page.render(fileName)
                    .then(() => {
                        console.log(`File saved ${fileName}`)
                        this.imageUrls.push(`${SERVER_URL}/${baseName}`)
                        if (this.numClips > 0 ? index === this.numClips - 1 : index === this.numClips) {
                            // done take webshots
                            if (this.includeImages) {
                                // retreive image urls as well
                                setTimeout(() => {

                                    this.page.evaluate(function() {
                                            var list,
                                                max = 20,
                                                images = [],
                                                index,
                                                minSize = 150;

                                            list = document.getElementsByTagName("img");
                                            for (index = 0; index < list.length && images.length < max; ++index) {
                                                var img = list[index]
                                                var src = img.getAttribute('src')
                                                var width = img.clientWidth
                                                var height = img.clientHeight
                                                if (src && (src.indexOf('http') > -1) && (width >= minSize) && (height >= minSize))
                                                    images.push(src)
                                            }

                                            return images
                                        })
                                        .then((urls) => {
                                            this.imageUrls = this.imageUrls.concat(urls)
                                            this.doneCb(null, this.imageUrls)
                                            this.exit()
                                        })
                                        .catch(err => {
                                            this.onError(err)
                                        })
                                }, delay)
                            } else {
                                this.doneCb(null, this.imageUrls)
                                this.exit()
                                return
                            }

                        } else {
                            this.shotClipViews(index + 1)
                        }


                    })
                    .catch(err => {
                        this.onError(err)
                    })
            })
            .catch(err => {
                this.onError(err)
            })

    }

    onError(err) {
        this.exit()
        this.doneCb(err)
    }

    exit() {

        this.page.close().then(() => {
            if (this.phInstance) {
                this.phInstance.exit()
                this.phInstance = null
            }
        }).catch(() => {
            if (this.phInstance) {
                this.phInstance.exit()
                this.phInstance = null
            }
        })

    }

    stop() {
        try {
            this.exit()
        } catch (e) {
            console.log(`Error killing phantom instance: ${e.toString()}`)
        }
    }

}

module.exports = WebShot
