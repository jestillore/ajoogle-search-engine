'use strict'

var fs = require('fs');
var path = require('path');
var lwip = require('lwip');

// Usage: chopImage(
//     '/path/to/file.png',
//     function eachChopedFile(filePath, index, next),
//     function done ()
// )

module.exports = function(filePath, eachCb, doneCb) {

    if (fs.existsSync(filePath)) {

        lwip.open(filePath, function(err, image) {

            if (err || !image) {
                console.log(err)
                eachCb(filePath, 0, doneCb)
                return
            }

            var chopH = 768 * 3
            var dims = {width: image.width(), height: image.height()}
            var numH = Math.floor(dims.height / chopH)
            var lastH = dims.height % (chopH)

            console.log(dims)
            console.log(numH)
            console.log(lastH)

            if (numH === 0) {
                // dont process to save memory
                console.log(`No need to process image ${filePath}`)
                eachCb(filePath, 0, doneCb)
                return
            }

            function chop(index) {

                var newFilePath = path.dirname(filePath) + '/' + path.basename(filePath, '.jpg') + '-chunk-' + (new Date()).getTime() + '.jpg'
                image.clone(function(err, clonedImage) {

                    if (err || !clonedImage) {
                        console.log(err)
                        eachCb(filePath, index, doneCb)
                        return
                    }

                    // var top = (dims.height / 2) - (dims.width * index)
                    var top = chopH * index
                    var bottom = index === numH ? top + lastH : top + chopH + 70

                    clonedImage.crop(
                        0,
                        top,
                        dims.width,
                        bottom,
                        // (index === numH) ? lastH : dims.width + 70,
                        function(err, croppedImage) {

                            if (err || !croppedImage) {
                                console.log(err)
                                eachCb(filePath, index, doneCb)
                                return
                            }

                            croppedImage.writeFile(newFilePath, function() {
                                console.log('done chopping (' + (index + 1) + '/' + (numH + 1) + ")" + newFilePath)
                                eachCb(newFilePath, index, function() {
                                    // dont include footer of long pages
                                    if (numH > 0 ? index === numH - 1 : index === numH) {
                                        doneCb()
                                        return
                                    }
                                    chop(index + 1)
                                })
                            })
                        })

                })
            };

            chop(0)

        })



    } else {
        eachCb(filePath, 0, doneCb)
    }

}
