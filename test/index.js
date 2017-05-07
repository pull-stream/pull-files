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
    ], {
      cwd: __dirname
    }),

    // Check file objects
    through(function (file) {
      var name = basename(file.path, '.txt')
      if (name === 'mars.json') name = basename(name, '.json')

      var data = file.data.toString()
      
      t.is(`hello i am ${name}\n`, data, name + '\'s data')

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
    read(['./youhavenotfoundwhatyouwerelookingfor/**.js'], { cwd: __dirname }),
    onEnd(err => {
      t.is(err.code, 'ENOENT', 'errors with non-existing files')
    })
  )
})

test('read single file', function (t) {
  t.plan(2)

  pull(
    read('bar/pluto.txt', { cwd: __dirname }),
    drain(file => {
      console.log(file)
      t.is(file.path, '/home/jamen/jamen/pull-files/test/bar/pluto.txt', 'file path')
      t.is(file.data.toString(), 'hello i am pluto\n', 'file data')
    })
  )
})

test('read node_modules', function (t) {
  t.plan(1)

  pull(
    read('../node_modules/**/*', { cwd: __dirname }),
    collect((err, files) => {
      if (err) throw err
      t.true(files.length, 'reads node modules')
    })
  )

})

test('vinyl-fs and pull-stream differences', function (t) {

    pull(
      read('../node_modules/**/*', { cwd: __dirname }),
      map(({ base, path }) => base ? join(base, path) : path),
      collect((err, p_files) => {
        if (err) throw err
        var v_files = []
        vfs.src('../node_modules/**/*', { cwd: __dirname })
        .on('data', file => v_files.push(file.path))
        .on('end', () => {

          // console.log(v_files)
          // console.log(p_files)
          // console.log(diff(v_files, p_files).length)
          t.end()

        })
      })
    )

})

test('stream mode', t => {
  t.plan(4)
  
  pull(
    read('foo/**/*', { cwd: __dirname, stream: true }),
    drain(file => {
      t.is(typeof file.data, 'function', 'got stream data')
    }, err => {
      if (err) return t.end(err)
      else t.pass('finished')
    })
  )

})

test.onFinish(function () {
  rimraf(__dirname + '/qux', () => {})
})
