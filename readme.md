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
    file.contents = compile(file.contents)
  }),

  // Write them to `out` directory
  write('out', err => {
    console.log('finished')
  })
)
```

The file objects are a minimal take on [`Vinyl`](https://github.com/gulpjs/vinyl) containing only properties that are necessary:

```js
{ base: '/home/jamen/jamen/pull-files/test',
  relative: 'bar/pluto.txt',
  contents: <Buffer 68 65 6c 6c 6f 20 69 20 61 6d 20 70 6c 75 74 6f 0a> }
```

This lets you create them without any dependencies, and you may also add custom properties not concerned with this module

## Installation

```shell
npm install --save pull-files
```

## Usage

### `read(glob, cwd?)`

Read files from a glob or path (or arrays of either) using [`micromatch`](https://github.com/micromatch/micromatch) patterns.  Supply `cwd` if your paths are relative and will change depending on where you execute `node` (most likely want `__dirname`)

```js
pull(
  // Read js files from node_modules, excluding pull-files directory
  read([ 'node_modules/**/*.js', '!node_modules/pull-files' ], __dirname),
  drain(file => console.log(file))
)
```

### `write(dest, done?)`

Write files to `dest` and calls `done(err?)` when finished

```js
pull(
  values([
    { base: 'foo', relative: 'earth.js', contents: 'hello earth' },
    { base: 'foo', relative: 'mars.js', contents: 'hello mars' },
    { base: 'baz', relative: 'pluto.js', contents: 'hello pluto' },
  ]),

  write('example', err => {
    // wrote all 3 files to `example/...`
  })
)
```

Here you can see that files don't have to be created from `read` either, but can be from anywhere

### `{ base, relative, contents }`

Files are represented as plain objects with the properties:

 - `base`: The base path of the file.  Typically where the globbing started
 - `relative`: The file's path relative to `base`.  So you can retain directory structure
 - `contents`: A buffer of the file's contents

If you want to get a file's full path, simple do:

```js
var file_path = path.join(file.base, file.relative)
```

You can also stick this on `file.path` if you want to.  But be careful about mutating `base`/`relative` afterwards!

---

_Maintained by [Jamen Marz](https://git.io/jamen) (See on [Twitter](https://twitter.com/jamenmarz) and [GitHub](https://github.com/jamen) for questions & updates)_
