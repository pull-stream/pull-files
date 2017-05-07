# pull-files

> Read and write directories of files with pull-stream

```js
var pull = require('pull-stream')
var { read, write } = require('pull-files')

pull(
  // Read js files out of `node_modules`
  read('node_modules/**/*.js'),

  // Compile files' contents
  pull.through(file => {
    file.data = compile(file.data)
  }),

  // Write them to `out` directory
  write('out', err => {
    console.log('finished')
  })
)
```

The file objects are a minimal take on [`Vinyl`](https://github.com/gulpjs/vinyl) containing only properties that are necessary:

```
{ base: '/home/jamen/jamen/pull-files/test',
  path: 'bar/pluto.txt',
  data: <Buffer 68 65 6c 6c 6f 20 69 20 61 6d 20 70 6c 75 74 6f 0a> }
```

This lets you create them without any dependencies, and you may also add custom properties not concerned with this module

## Installation

```shell
npm install --save pull-files
```

## Usage

### `read(glob, options?)`

Read files from a glob or path (or arrays of either) using [`micromatch`](https://github.com/micromatch/micromatch) patterns.  Supply `cwd` if your paths are relative and will change depending on where you execute `node` (most likely want `__dirname`)

Options can contain:

 - `cwd`: Used to resolve relative paths (commonly set as `__dirname`)
 - `stream`: Enable stream mode, where `file.data` is a source stream

```js
pull(
  // Read js files from node_modules, excluding pull-files directory
  read([ 'node_modules/**/*.js', '!node_modules/pull-files' ], { cwd: __dirname }),
  drain(file => console.log(file))
)
```

### `write(dest, done?)`

Write files to `dest` and calls `done(err?)` when finished

```js
pull(
  values([
    { path: 'earth.js', data: 'hello earth' },
    { path: 'mars.js', data: 'hello mars' },
    { path: 'pluto.js', data: 'hello pluto' },
  ]),

  write('example', err => {
    // wrote all 3 files to `example/...`
  })
)
```

Here you can see that files don't have to be created from `read` either, but can be from anywhere.  Nor do you have to provide `base` for unglobbed files.

### `{ base, path, data }`

These Represent files, where:

 - `base` is an optional property present if `path` is relative.  It allows you to retain directory structure and move the base (e.g. to an `out/` folder if you're compiling)
 - `path`: The path of the data.  Either absolute or relative.  If absolute, `base` will be `null`.
 - `data`: A buffer or stream of the file's data.

For a simple way to get a file's full path, regardless of relativity, do:

```js
var full = base ? join(base, path) : path
```

---

_Maintained by [Jamen Marz](https://git.io/jamen) (See on [Twitter](https://twitter.com/jamenmarz) and [GitHub](https://github.com/jamen) for questions & updates)_
