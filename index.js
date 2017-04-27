const pull = require('pull-stream')
const { values, asyncMap, drain, onEnd } = pull
const pushable = require('pull-pushable')
const paramap = require('pull-paramap')
const { readdir, stat, readFile, writeFile } = require('fs')
const { join, resolve, relative: relative_path, dirname } = require('path')
const mkdirp = require('mkdirp')
const glob_parse = require('glob-base')
const mm = require('micromatch')
const filter = pull.filter()

exports.read = read
exports.write = write

var ALLOW = { dot: true }

function read (globs, cwd) {
  if (!Array.isArray(globs)) globs = [globs]
  if (!cwd) cwd = process.cwd()

  // Source stream used to collect entry paths recursively (files and dirs)
  // Also tracking amount of pending reads, so we know when to end the stream
  const files = pushable()
  let pending = 0

  // Parse globs to { glob, negated, base, pattern } to check if pattern has negation,
  // and push the non-negated base directory paths to start off the pipeline
  for (var i = globs.length; i--;) {
    const glob = globs[i]
    const ast = glob_parse(glob)
    const pattern = ast.glob
    const negated = pattern[0] === '!'
    const base = ast.base
    const is_glob = ast.isGlob


    globs[i] = { glob, negated, base, pattern }

    // If glob isn't negated, kickstart the stream with it's base directory
    // or file path
    if (!negated) {
      if (is_glob) {
        files.push({ base, relative: null })
      } else {
        files.push({ base: cwd, relative: glob })
      }
    }
  }

  // Handle directory and file paths, recursively adding more into the stream
  var accumulator = paramap((file, _done) => {
    const base = resolve(cwd, file.base)
    const relative = file.relative

    // Typically would always have `relative`, but dirs pushed from the glob
    // section above are the base dirs of rest to come and have no relative
    const path = relative ? join(base, relative) : base

    // A little helper that decrements `pending` for us
    const done = (err, file) => {_done(err, file); pending--}

    // If path is directory, read their children and push more onto `paths`
    // This is the recursive operation that creates more file in the pipeline
    function directory_path () {
      readdir(path, (err, children) => {
        if (err) return done(err)

        // Push children into pipeline, order is not important
        for (var i = children.length; i--;) {
          const child = relative ? join(relative, children[i]) : children[i]
          files.push({ base, relative: child })
        }

        // Filter directory out of pipeline after adding children files
        done(null, null)
      })
    }

    // If path is file, verify against globs
    function file_path () {
      for (var i = globs.length; i--;) {
        const glob = globs[i]
        const glob_full = glob.glob
        const glob_base = glob.base
        const glob_negated = glob.negated
        const glob_pattern = glob.pattern
        if (relative === glob_full || mm.isMatch(path, glob_pattern, ALLOW)) {
          return done(null, file)
        }
      }

      // Did not match globs
      done(null, null)
    }

    // New read
    pending++
    if (relative) {
      stat(path, (err, stat) => {
        // Handle path by type
        if (err) return done(err)
        else if (stat.isDirectory()) directory_path()
        else if (stat.isFile()) file_path()
        else done(null, null)
      })
    } else {
      // If we have no relative path that would imply it is a directory, so we
      // can save some time by skipping fs.stat call
      directory_path()
    }
  }, 5)

  // Adds contents to { base, relative } from accumulator
  // Skipped when in stream mode
  var reader = paramap((file, done) => {
    readFile(join(file.base, file.relative), (err, contents) => {
      if (err) return done(err)

      // Add contents and pass onwards
      file.contents = contents
      done(null, file)

      // If there is no more pending reads, end stream
      if (!pending) {
        files.end()
      }
    })
  })

  // Pull all the pieces together
  return pull(files, accumulator, filter, reader)
}

function write (base, done) {
  if (typeof base === 'function') {
    done = base
  }

  const written_dirs = []

  return pull(
    paramap((file, next) => {
      const relative = file.relative
      const contents = file.contents
      const dest = join(base || file.base, relative)
      const dir = dirname(dest)

      if (written_dirs.indexOf(dir) === -1) {
        mkdirp(dir, err => {
          if (err) return next(err)
          written_dirs.push(dir)
          writeFile(dest, contents, next)
        })
      } else {
        writeFile(dest, contents, next)
      }
    }),
    onEnd(done)
  )
}
