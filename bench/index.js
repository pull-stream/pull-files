var pull = require('pull-stream')
var { collect, drain, onEnd } = pull
var { src, dest } = require('vinyl-fs')
var { read, write } = require('../')
var bench = require('nanobench')

var opts = { cwd: __dirname }

bench('pull-files reading', b => {

  b.start()
  pull(
    read('../node_modules/**/*', opts),
    collect((err, files) => {
      b.end()
      console.log('read', files.length, 'files')
    })
  )

})


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
