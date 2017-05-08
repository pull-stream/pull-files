const pull = require('pull-stream')
const { values, asyncMap, drain, onEnd } = pull
const pushable = require('pull-pushable')
const paramap = require('pull-paramap')
const { readdir, stat, readFile, writeFile } = require('fs')
const { join, resolve, relative: relative_path, dirname, normalize, basename } = require('path')
const mkdirp = require('mkdirp')
const glob_parse = require('glob-base')
const mm = require('micromatch')
const absolute = require('is-absolute')
const filter = pull.filter()

exports.read = read
exports.write = write

var ALLOW = { dot: true }

function read (globs, options) {
  if (!Array.isArray(globs)) globs = [globs] 
  if (!options) options = {}
  const cwd = options.cwd || process.cwd()
  const stream_mode = options.stream !== undefined && options.stream

  // Source stream used to collect entry paths recursively (files and dirs)
  // Also tracking amount of pending reads, so we know when to end the stream
  const files = pushable()
  let pending = 0

  // Parse globs to { glob, negated, base, pattern } to check if pattern has negation,
  // and push the non-negated base directory paths to start off the pipeline
  for (var i = globs.length; i--;) {
    const glob = resolve(cwd, globs[i])
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
        files.push({ base, path: null, data: null })
      } else {
        files.push({ base: absolute(glob) ? null : cwd, path: glob, data: null })
      }
    }
  }

  // Handle directory and file paths, recursively adding more into the stream
  var accumulator = paramap((file, done) => {
    const base = file.base
    const path = file.path
    const entry = base ? (path ? resolve(base, path) : base) : path

    // If path is directory, read their children and push more onto `paths`
    // This is the recursive operation that creates more file in the pipeline
    function directory_path () {
      pending++
      readdir(entry, (err, children) => {
        if (err) return done(err)

        // Push children into pipeline, order is not important
        for (var i = children.length; i--;) {
          if (path !== null && base !== null) {
            files.push({ base, path: join(path, children[i]) })
          } else if (path !== null) {
            files.push({ base: null, path: join(path, children[i]) })
          } else {
            files.push({ base, path: children[i] })
          }
        }

        // Filter directory out of pipeline after adding children files
        pending--
        done(null, null)
      })
    }

    // If path is file, verify against globs
    function file_path () {
      pending++
      for (var i = globs.length; i--;) {
        const glob = globs[i]
        const glob_full = glob.glob
        const glob_base = glob.base
        const glob_negated = glob.negated
        const glob_pattern = glob.pattern
        if (entry === glob_full || mm.isMatch(entry, glob_pattern, ALLOW)) {
          return done(null, file)
        }
      }

      // Did not match globs
      pending--
      done(null, null)
    }

    // New read
    if (path) {
      stat(entry, (err, stat) => {
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
    const base = file.base
    const path = file.path

    if (stream_mode) {
      function data_stream (end, cb) {
        if (end) return cb(end)
        readFile(base ? join(base, path) : path, (err, buf) => {
          if (err) return cb(end)
          cb(null, buf)
          cb(true)
        })
      }
      file.data = data_stream  
      // console.log(pending)
      done(null, file)
      pending--
      if (!pending) files.end()
    } else {
      readFile(base ? join(base, path) : path, (err, buf) => {
        if (err) return done(err)
        file.data = buf
        done(null, file)
        pending--
        if (!pending) files.end()
      })
    }
  })

  // Pull all the pieces together
  return pull(files, accumulator, filter, reader)
}

function write (new_base, done) {
  if (typeof base === 'function') {
    done = base
  }

  const written_dirs = []

  return pull(
    paramap((file, next) => {
      const path = file.path
      const base = file.base
      const data = file.data


      let dest = path
      if (new_base && !base) {
        dest = join(new_base, basename(path))
      } else if (base) {
        dest = join(new_base || base, path)
      }

      const dir = dirname(dest)

      if (written_dirs.indexOf(dir) === -1) {
        mkdirp(dir, err => {
          if (err) return next(err)
          written_dirs.push(dir)
          writeFile(dest, data, next)
        })
      } else {
        writeFile(dest, data, next)
      }
    }, 5),
    onEnd(done)
  )
}
