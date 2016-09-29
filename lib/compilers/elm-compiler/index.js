'use babel'

import { React } from 'react-for-atom'
import Promise from 'bluebird'
import Elm from 'react-elm-components'
import _ from 'lodash'
var Rx = require('rxjs/Rx')
var packageJsonTemplateFileContents = require('./temp/elm-package-template.js')

var path = require('path')
var exec = require('child_process').exec
var fs = require('fs')
var jsonfile = require('jsonfile')
var writeJsonFile = Promise.promisify(jsonfile.writeFile)

var writeFile = Promise.promisify(fs.writeFile)
const basePath = path.resolve(__dirname)

const tempFolderPath = basePath + '/temp'
const codePath = tempFolderPath
const promisifiedExec = Promise.promisify(exec)

const previewFileName = 'Preview';

function isAssignment (command) {
  return command.split(' ').indexOf('=') >= 0
}

function isTypeDeclaration (command) {
  return command.split(' ').indexOf(':') === 1
}

function isImportStatement (command) {
  return command.startsWith('import ')
}

const numLinesAddedToPlaygroundFile = 5
function getFormattedError (error) {
  const errorStringPrefix = 'Error: Command failed: cd temp && elm-make Main.elm --output=main.js && node main.js'
  const errorString = error.toString()
  const correctedErrorString = errorString.split('\n')
    .map((str) => {
      if (str.match(/^\d+\|/)) {
        const indexOfPipe = str.indexOf('|')
        const lineNumber = str.split('|')[0]
        const newLineNumber = lineNumber - numLinesAddedToPlaygroundFile
        return newLineNumber + str.slice(indexOfPipe)
      } else {
        return str
      }
    })
    .join('\n')
    .slice(errorStringPrefix.length)

  return (
    <div style={{height: '100%', background: '#D8000C'}}>
      <pre>{correctedErrorString}</pre>
    </div>
  )
}

let lastOpenFilePath = ''

function writeSourcesToElmPackageJson (packageJsonTemplateFileContents, basePath) {
  const packageJsonFilePath = `${tempFolderPath}/elm-package.json`

  let packageJsonFileContents = {
    ...packageJsonTemplateFileContents,
    'source-directories': _.uniq(packageJsonTemplateFileContents['source-directories'].concat(path.resolve(basePath)))
  }

  if (basePath !== path.resolve(tempFolderPath)) {
    let folderToCheck = basePath
    let filesInFolderToCheck
    let depth = 0
    const maxDepth = 25
    while (true && depth < maxDepth) {
      depth += 1
      filesInFolderToCheck = fs.readdirSync(folderToCheck)
      if (_.includes(filesInFolderToCheck, 'elm-package.json')) {
        const tempPackageJsonContent = jsonfile.readFileSync(`${folderToCheck}/elm-package.json`)
        let sourceDirectories = tempPackageJsonContent['source-directories']

        packageJsonFileContents = {
          ...packageJsonFileContents,
          'source-directories': _.uniq(packageJsonFileContents['source-directories'].concat(_.trimEnd(`${folderToCheck}/${sourceDirectories}`, '/.')))
        }
        break
      } else {
        if (folderToCheck === '/') {
          break
        }

        // something line '/Users' will result in ''. hence the ||
        folderToCheck = _.initial(folderToCheck.split('/')).join('/') || '/'
      }
    }
  }

  return writeJsonFile(packageJsonFilePath, packageJsonFileContents, {spaces: 4})
}

/*
 * Update elm-package.json src property to include path from where the file is loaded
 */
function updateFileSources (openFilePath) {
  openFilePath = openFilePath || tempFolderPath
  if (lastOpenFilePath === openFilePath) {
    return Promise.resolve(true)
  } else {
    lastOpenFilePath = openFilePath
  }

  return writeSourcesToElmPackageJson(packageJsonTemplateFileContents, openFilePath)
}

function writeCodeToFile (code, codePath) {
  let moduleName = 'UserCode'
  let codeToWrite = code.trim()

  // if module declaration is there in the panel, don't add it again
  if (code.startsWith('module ')) {
    const inlineModuleName = _.words(code)[1]
    codeToWrite = code.replace(`module ${inlineModuleName}`, 'module UserCode')
  } else if (code.trim() === '') { // if code panel is empty, insert a random function
    codeToWrite = `module ${moduleName} exposing (..)

randomIdentityFunction x = x`
  } else {
    codeToWrite = `module ${moduleName} exposing (..)

${code}`
  }

  return writeFile(`${codePath}/${moduleName}.elm`, codeToWrite)
    .then(() => moduleName) // return the moduleName for playgroundFileWriter
    .catch((err) => console.log('error writing file', `${codePath}/${moduleName}.elm`, err.toString()))
}

function isRenderExpression (code) {
  return code.startsWith('render ')
    || code.startsWith('Html.beginnerProgram')
    || code.startsWith('beginnerProgram')
    || code.startsWith('Html.program')
    || code.startsWith('App.program')
    || code.startsWith('program')
}

function getType (code) {
  if (isImportStatement(code)) {
    return 'importStatement'
  } else if (isRenderExpression(code)) {
    return 'renderExpression'
  } else if (isAssignment(code)) {
    return 'assignment'
  } else if (isTypeDeclaration(code)) {
    return 'assignment'
  } else {
    return 'expression'
  }
}

function tokenize (code) {
  return code.split('\n')
    .reduce((acc, line, index) => {
      if (cleanUpExpression(line)[0] === ' ' && index !== 0) {
        return acc.slice(0, acc.length - 1).concat({
          ...acc[acc.length - 1],
          newlines: acc[acc.length - 1].newlines + 1,
          value: acc[acc.length - 1].value + ' ' + _.trim(cleanUpExpression(line))
        })
      }

      return acc.concat({
        newlines: 1,
        lineNumber: index,
        value: cleanUpExpression(line)
      })
    }, [])
    .map((command) => {
      return {
        ...command,
        type: getType(command.value)
      }
    })
    .reduce((acc, command, index) => { // bunch up expressions
      if (index !== 0 && command.type === 'expression' && _.last(acc).type === 'expression') {
        return [
          ..._.initial(acc),
          {
            ..._.last(acc),
            commands: _.last(acc).commands.concat(command)
          }
        ]
      }

      return acc.concat({
        ...command,
        commands: [command]
      })
    }, [])
}

function hasSubscribed (code) {
  return code.indexOf('subscriptions') >= 0
}

function getToStrings (expression) {
  return expression.commands.map((command) => {
    if (command.value.trim().length === 0) {
      return '"\n"'
    } else {
      return `Basics.toString (${cleanUpExpression(command.value)}),` + _.times(command.newlines, _.constant('\n')).map(() => '"\n"').join(',')
    }
  }).join(',')
}

function cleanUpExpression (expr) {
  return _.trimEnd(expr.split('--')[0])
}

function getSimpleExpressionChunk (expression) {
  return `(String.concat [${getToStrings(expression)}])`
}

function getGeneratedMainFileContent (expressions, importStatements, statements, userModuleName) {
  const hasRenderExpressions = expressions.reduce(function(count, expression) {
     return (expression.type === 'renderExpression') ? count + 1 : count;
  }, 0);

  let fileContent = `module Preview exposing (..)

import Html exposing (..)
import ${userModuleName} exposing (..)

import Render exposing (renderAllExpressions)

${importStatements}`

  if (hasRenderExpressions) {
    fileContent += `import Html.App exposing (beginnerProgram, program)`
  }

  fileContent += '\n\n' + statements;

  fileContent += '\n\n' + `expressions = [` + '\n';

  var totalCommands = 0;

  fileContent += expressions.map(function(expression, index) {
    /*if (expression.type === 'renderExpression') {
    const appProgram = hasSubscribed(expression.value) ? 'program' : 'beginnerProgram'

    // replacement for render expression
    return `module Main${counter} exposing (..)
${mainFileTemplateForComponents}
${statements}
main =
    ${appProgram} ${_.drop(expression.value.split(' ')).join(' ')}`

} else { */

    var result = '';

    console.log(index, expression.type, expression.value, expression.commands, expression);

    if (expression.type === 'expression') {
        result += expression.commands
            .filter(function(command) {
                return (command.value.trim() !== "");
            })
            .map(function(command) {
                var newLines = _.times(command.newlines, _.constant('\n')).map(() => '"\n"').join(',');
                var cleanExpression = cleanUpExpression(command.value);
                totalCommands++;
                return (totalCommands > 1)
                    ? `    , toString (${cleanExpression})`
                    : `      toString (${cleanExpression})`;
            }).join('\n');
    } else if (expression.type === 'renderExpression') {

    }

    return result;
  }).join('\n')

  fileContent += `    ]

main =
    div [] (renderAllExpressions expressions)`;

  console.log(fileContent);

  return fileContent;
}

function writeFilesForExpressions (playgroundCode, userModuleName, codePath) {
  const tokenizedCode = tokenize(playgroundCode)
  console.log('tokenizedCode', tokenizedCode)
  const importStatements = tokenizedCode.filter((code) => code.type === 'importStatement').map((code) => code.value).join('\n')
  const statements = tokenizedCode.filter((code) => code.type === 'assignment').map((code) => code.value).join('\n')
  const expressions = tokenizedCode.filter((code) => code.type === 'expression' || code.type === 'renderExpression')

  const fileWritePromises = [
    writeFile(`${codePath}/${previewFileName}.elm`, getGeneratedMainFileContent(expressions, importStatements, statements, userModuleName))
  ];
  /* const fileWritePromises = expressions.map((expression, index) => {
    return writeFile(`${codePath}/main${index}.elm`, getGeneratedMainFileContent(expression, importStatements, statements, userModuleName, index))
}) */
  return Promise.all(fileWritePromises).then(() => expressions)
}

let cachedCode = ''
let cachedComponentKeys = {}

function getExpressionValue (expr) {
  if (expr.commands) {
    return expr.commands.reduce((acc, command) => acc + cleanUpExpression(command.value), '')
  } else {
    return cleanUpExpression(expr.value)
  }
}
/*
 * if the key for the component is not cached and generated afresh every time, two bad things happen
 * 1. All components lose all their state
 * 2. All components are redrawn by react, which leads to flashing of all components on each compile
 * But caching needs to take into consideration both the expression in the playground as well as the code in the code panel
 * TODO - Caching based on expression.value is both wrong and useless because we now combine expressions together into a single expression
 * Any expression in a chain changing would lead to cache busting of all other expressions (they are all in a single component anyways)
 */
function getComponentKey (elmCode, code) {
  /* if (cachedCode.trim() !== code.trim() || !cachedComponentKeys[getExpressionValue(expressions[index]) + index]) {
    cachedComponentKeys[getExpressionValue(expressions[index]) + index] = Math.floor(Math.random() * 10000) + '_' + index
  } else {
    console.log('serving cached key', cachedComponentKeys[getExpressionValue(expressions[index]) + index])
  }

  return cachedComponentKeys[getExpressionValue(expressions[index]) + index]*/
  return new Date().getTime();
}

var cachedSources = {}
var vm = require('vm')

function getSource (module, expressions, codePath) {
  // if(!cachedSources[expression.value] || true) {
  var previousEval
  try {
    // const bundle = fs.readFileSync(bundleFilePath).toString()
    previousEval = global.eval
    global.eval = (source) => vm.runInThisContext(source)
    // TODO - instead do require(bundle.js)
    eval(fs.readFileSync(`${codePath}/${previewFileName}.js`).toString());
  // var bundle = require(bundleFilePath)
  } catch (e) {
    console.log('error evaluating bundle', e.toString())
    return subscriber.next(e)
  } finally {
    global.eval = previousEval
  }

  var timestamp = new Date().getTime();

  console.log(timestamp, _.capitalize(previewFileName), global.module.exports, global.module.exports[_.capitalize(previewFileName)]);

  //cachedSources[getExpressionValue(expression)] = global.module.exports[_.capitalize(fileName)]
  cachedSources[timestamp] = global.module.exports[_.capitalize(previewFileName)]
  // } else {
  //     console.log('feed source from cache', expression.value, cachedSources[expression.value])
  // }

  //return cachedSources[getExpressionValue(expression)]
  return { source: cachedSources[timestamp],
           timestamp: timestamp };
}

export function compile (code, playgroundCode, openFilePath) {
  // get folder path from file path
  openFilePath = openFilePath ? _.initial(openFilePath.split('/')).join('/') : null
  subscriber.next('Compiling...')
  return updateFileSources(openFilePath)
    .then(() => writeCodeToFile(code, codePath))
    .then((userModuleName) => writeFilesForExpressions(playgroundCode.trim(), userModuleName, codePath))
    .then((elmCode) => {
      return new Promise((resolve, reject) => {
        return promisifiedExec(`cd ${codePath} && elm-make --yes ${previewFileName}.elm --output=${previewFileName}.js`)
          .then(() => {
            let s = getSource(module, elmCode, codePath);

            // bust all keys if user code has changed
            if (cachedCode !== code) {
                cachedCode = code
                cachedComponentKeys = {}
            }

            let elmComponent = <span>&lt;Empty&gt;</span>;

            console.log('sourceData is', s);

            // only return elm component is source is not corrupted
            // style={{display: 'flex', justifyContent: 'center'}}
            if (s && s.source && s.source.embed) {
                elmComponent = (
                  <div key={s.timestamp}>
                    <Elm key={s.timestamp} src={s.source} />
                  </div>
                )
            }

            subscriber.next(elmComponent)
          })
          .catch((err) => {
            console.log('elm compilation error', err.toString())
            subscriber.next(getFormattedError(err))
          })
      })
    })
}
//
function onNewFileLoad (openFilePath) {
  openFilePath = openFilePath ? _.initial(openFilePath.split('/')).join('/') : null
  updateFileSources(openFilePath)
}
//
function cleanUp () {
  console.log('cleaning up elm compiler folder')
  if (subscriber) {
    subscriber.complete()
  }
// const files = fs.readdirSync(tempFolderPath)
// files.filter((file) => file !== 'Main.elm' && (file.split('.')[1] === 'elm' || file.split('.')[1] === 'js'))
//         .map((file) => fs.unlink(tempFolderPath + '/' + file))
}
//
// // TODO - to be done
function generateTests (code, playgroundCode, openFilePath) {
  return '-- to be implemented'
}

function formatCode (code) {
  return promisifiedExec(`echo "${code}" | ${basePath}/elm-format --stdin`)
// .then((formattedCode) => _.drop(formattedCode.split('\n'), 2).join('\n'))
}
//
var subscriber = null
function getObservable () {
  return Rx.Observable.create((o) => {
    subscriber = o
  })
}

function onCodeChange (code, playgroundCode, openFilePath) {
  return this.compile(code, playgroundCode, openFilePath)
}

function onPlaygroundCodeChange (code, playgroundCode, openFilePath) {
  return this.compile(code, playgroundCode, openFilePath)
}

// do some initialization work here
export function compiler () {
  return {
    compile,
    cleanUp,
    onNewFileLoad,
    generateTests,
    formatCode,
    outputStream: getObservable(),
    onCodeChange,
    onPlaygroundCodeChange,
    editorMode: 'elm',
    extensions: ['elm'],
    sampleCode: 'add x y = x + y',
    samplePlaygroundCode: 'add 1 2'
  }
}
