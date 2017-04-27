var pull = require('pull-stream')
var { collect, drain, onEnd } = pull
var { src, dest } = require('vinyl-fs')
var { read, write } = require('../')
var bench = require('nanobench')

bench('pull-files reading', b => {

  b.start()
  pull(
    read('../node_modules/**/*', __dirname),
    collect((err, files) => {
      b.end()
      console.log('read', files.length, 'files')
    })
  )

})


var opts = { cwd: __dirname }
bench('vinyl-fs reading', b => {

  b.start()
  var files = []
  src('../node_modules/**/*', opts)
  .on('data', file => files.push(file))
  .on('end', () => {
    b.end()
    console.log('read', files.length, 'files')
  })

})
