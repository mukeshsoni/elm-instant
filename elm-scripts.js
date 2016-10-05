var Promise = require('bluebird')
const writeFile = Promise.promisify(require('fs').writeFile)
var path = require('path')
var exec = Promise.promisify(require('child_process').exec)

process.chdir('lib/compilers/elm-compiler/temp')
var elmPackageJson = require(path.join(process.cwd(), 'elm-package-template.js'))

exec('rimraf elm-stuff elm-package.json')
.then(() => writeFile('elm-package.json', JSON.stringify(elmPackageJson)))
.then(() => exec('elm-package install -y'))
.then(console.log)
.catch(console.error)
