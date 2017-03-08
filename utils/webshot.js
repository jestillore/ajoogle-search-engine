var phantom = require('phantom')
var path = require('path')

var shotSize = {
    width: 1024,
    height: 768 * 2.5
}

var viewportSize = {
    top: 0,
    left: 0,
    width: 1024,
    height: 768
}

var format = 'jpg'

function preparePhantom(done, errCb) {

    var sitepage = null;
    var phInstance = null;

    phantom.create()
        .then(instance => {
            phInstance = instance
            return instance.createPage()
        })
        .then(page => {
            done(phInstance, page)
        })
        .catch(function(err) {
            errCb(err, phInstance, page)
        })
}


function processUrl(url, filePrefix, doneCb) {

    var resultFiles = []

    preparePhantom(function(phInstance, page) {

        page.property('viewportSize', viewportSize).then(() => {

            console.log(`Openning URL: ${url}`)
            page.open(url).then(function() {
                console.log(`Done loading page: ${url}`)

                page.evaluate(function() {
                        // set default background to white
                        var style = document.createElement('style');
                        var text = document.createTextNode('body { background: #fff }');
                        style.setAttribute('type', 'text/css');
                        style.appendChild(text);
                        document.head.insertBefore(style, document.head.firstChild);

                        return JSON.stringify({
                            width: Math.max(
                                document.body.offsetWidth,
                                document.body.scrollWidth,
                                document.documentElement.clientWidth,
                                document.documentElement.scrollWidth,
                                document.documentElement.offsetWidth
                            ),
                            height: Math.max(
                                document.body.offsetHeight,
                                document.body.scrollHeight,
                                document.documentElement.clientHeight,
                                document.documentElement.scrollHeight,
                                document.documentElement.offsetHeight
                            )
                        })
                    })
                    .then((dimension) => {

                        page.setting('javascriptEnabled', false).then(() => {

                            var dims = JSON.parse(dimension)
                            var numH = Math.floor(dims.height / shotSize.height)

                            shot(0)

                            function shot(index) {

                                var fileName = `${filePrefix}-${(new Date()).getTime()}.${format}`
                                fileName = path.join(__dirname, '../public', fileName)
                                var top = index * shotSize.height
                                var bottom = index === numH ? dims.height % shotSize.height : shotSize.height + 20

                                page.property('clipRect', {
                                        top: top,
                                        left: 0,
                                        width: shotSize.width,
                                        height: bottom
                                    })
                                    .then(() => {
                                        page.render(fileName)
                                            .then(function() {
                                                console.log(`File saved ${fileName}`)
                                                console.log(`File exists: ${fileName}: ${require('fs').existsSync(fileName)}`)
                                                resultFiles.push(fileName)
                                                if (numH > 0 ? index === numH - 1 : index === numH) {
                                                    doneCb(null, resultFiles)
                                                    phInstance.exit()
                                                    return
                                                }
                                                shot(index + 1)
                                            })
                                            .catch(function() {
                                                if (numH > 0 ? index === numH - 1 : index === numH) {
                                                    doneCb(null, resultFiles)
                                                    phInstance.exit()
                                                    return
                                                }
                                                shot(index + 1)
                                            })
                                    })
                            }

                        })



                    })

            })
        })

    }, function(err, phInstance, page) {
        phInstance.exit()
        doneCb(err)

    })

}

module.exports = processUrl

// processUrl('https://github.com/amir20/phantomjs-node', 123456, function (err, results) {
//   console.log(results)
// })
