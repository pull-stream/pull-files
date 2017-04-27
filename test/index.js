var test = require('tape')
var exists = require('check-files-exist')
var rimraf = require('rimraf')
var pull = require('pull-stream')
var vfs = require('vinyl-fs')
var diff = require('array-difference')
var { through, onEnd, drain, collect, map } = pull
var { basename, join } = require('path')
var { read, write } = require('../')

test('read and write files', function (t) {
  t.plan(6)
  var reads = 1

  pull(
    read([
      'bar/**.txt',
      'foo/**.{txt,json}',
      '!**/pluto.txt'
    ], __dirname),

    // Check file objects
    through(function (file) {
      var name = basename(file.relative, file.relative === 'mars.json' ? '.json' : '.txt')
      var contents = file.contents.toString()

      t.is(`hello i am ${name}\n`, contents, name + '\'s contents')

      console.log(file)
    }),

    // Check writing results
    write(__dirname + '/qux', function (err) {
      if (err) return t.fail(err)

      // existing files
      exists([
        'qux/earth.txt',
        'qux/mars.json',
        'qux/baz/jupiter.txt',
        'qux/baz/qux/earth.txt'
      ], __dirname)
      .then(() => t.pass('files written'),
      err => t.fail('files written'))

      // neated files
      exists([
        'qux/pluto.txt',
        'qux/pluto.txt'
      ], __dirname)
      .then(() => t.fail('files negated'),
      err => t.pass('files negated'))
    })
  )
})

test('read non existing file', function (t) {
  t.plan(1)

  pull(
    read(['./youhavenotfoundwhatyouwerelookingfor/**.js'], __dirname),
    onEnd(err => {
      t.is(err.code, 'ENOENT', 'errors with non-existing files')
    })
  )
})

test('read single file', function (t) {
  t.plan(2)

  pull(
    read('bar/pluto.txt', __dirname),
    drain(file => {
      console.log(file)
      t.is(file.relative, 'bar/pluto.txt', 'file path')
      t.is(file.contents.toString(), 'hello i am pluto\n', 'file contents')
    })
  )
})

test('read node_modules', function (t) {
  t.plan(1)

  pull(
    read('../node_modules/**/*', __dirname),
    collect((err, files) => {
      if (err) throw err
      t.true(files.length, 'reads node modules')
    })
  )

})

test('vinyl-fs and pull-stream differences', function (t) {

    pull(
      read('../node_modules/**/*', __dirname),
      map(x => join(x.base, x.relative)),
      collect((err, p_files) => {
        if (err) throw err
        var v_files = []
        vfs.src('../node_modules/**/*', { cwd: __dirname })
        .on('data', file => v_files.push(file.path))
        .on('end', () => {

          // console.log(v_files)
          // console.log(p_files)
          console.log(diff(v_files, p_files).length)
          t.end()

        })
      })
    )

})

test.onFinish(function () {
  rimraf(__dirname + '/qux', () => {})
})
