'use babel'

import { React } from 'react-for-atom'
import Promise from 'bluebird'
import Elm from 'react-elm-components'
import _ from 'lodash'
const ps = require('ps-node')
const Rx = require('rxjs/Rx')
const packageJsonTemplateFileContents = require('./temp/elm-package-template.js')
const path = require('path')
const exec = require('child_process').exec
const fs = require('fs')
const jsonfile = require('jsonfile')

import { tokenize } from './parser.js'
import {
  createTokenHash,
  cleanUpExpression,
} from './helpers'

Promise.config({
  cancellation: true
})

const writeJsonFile = Promise.promisify(jsonfile.writeFile)

const writeFile = Promise.promisify(fs.writeFile)
const basePath = path.resolve(__dirname)

const tempFolderPath = `${basePath}/temp`
const codePath = tempFolderPath
const promisifiedExec = Promise.promisify(exec)


const numLinesAddedToPlaygroundFile = 5
function getFormattedError(error) {
  const errorString = error.toString()
  const correctedErrorString = _.drop(errorString.split('\n'))
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

  return (
    <div
      style={{
        height: '100%',
        background: '#D8000C'
      }}
    >
      <pre>{correctedErrorString}</pre>
    </div>
  )
}

let lastOpenFilePath = ''

function writeSourcesToElmPackageJson(templateFileContents, basePathForOpenFile) {
  const packageJsonFilePath = `${tempFolderPath}/elm-package.json`

  let packageJsonFileContents = {
    ...templateFileContents,
    'source-directories': _.uniq(templateFileContents['source-directories'].concat([path.resolve(tempFolderPath), path.resolve(basePathForOpenFile)]))
  }

  if (basePathForOpenFile !== path.resolve(tempFolderPath)) {
    let folderToCheck = basePathForOpenFile
    let filesInFolderToCheck
    let depth = 0
    const maxDepth = 25
    while (true && depth < maxDepth) {
      depth += 1
      filesInFolderToCheck = fs.readdirSync(folderToCheck)
      if (_.includes(filesInFolderToCheck, 'elm-package.json')) {
        const tempPackageJsonContent = jsonfile.readFileSync(`${folderToCheck}/elm-package.json`)
        const sourceDirectories = tempPackageJsonContent['source-directories']

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

  return writeJsonFile(packageJsonFilePath, packageJsonFileContents, { spaces: 4 })
}

/*
 * Update elm-package.json src property to include path from where the file is loaded
 */
function updateFileSources(openFilePath = tempFolderPath) {
  if ((openFilePath && lastOpenFilePath === openFilePath) || (!openFilePath && lastOpenFilePath === tempFolderPath)) {
    return Promise.resolve(true)
  } else {
    lastOpenFilePath = openFilePath || tempFolderPath
  }

  return writeSourcesToElmPackageJson(packageJsonTemplateFileContents, openFilePath || tempFolderPath)
}

function writeCodeToFile(code) {
  const moduleName = 'UserCode'
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
    .then(() => moduleName
          , (err) => console.log('error writing file', `${codePath}/${moduleName}.elm`, err.toString())) // eslint-disable-line no-console
}

function hasSubscribed(code) {
  return code.indexOf('subscriptions') >= 0
}

function getToStrings(expression) {
  return expression.commands.map((command) => {
    if (command.value.trim().length === 0) {
      return '"\n"'
    } else {
      const newLines = _.times(command.newlines, _.constant('\n')).map(() => '"\n"').join(',')
      return `Basics.toString (${cleanUpExpression(command.value)}),${newLines}`
    }
  }).join(',')
}

function getSimpleExpressionChunk(expression) {
  return `(String.concat [${getToStrings(expression)}])`
}

function getGeneratedFrolicFileContent(expression, importStatements, statements, userModuleName) {
  const mainFileTemplateForComponents = `import Html.App as Html
import Html.App exposing (beginnerProgram, program)
import Html exposing (..)
${importStatements}
import ${userModuleName} exposing (..)`

  let fileContent = ''
  if (expression.value.startsWith('$view')) {
    fileContent = `module F${expression.hash} exposing (..)
${mainFileTemplateForComponents}
${statements}

frolicSpecialUpdate model _ = model
frolicSpecialView _ = ${_.trim(_.drop(expression.value.split(' ')).join(' '))}
main =
    beginnerProgram { model = 1 , view = frolicSpecialView , update = frolicSpecialUpdate }
`
  }

  return fileContent
}

function getGeneratedMainFileContent(expression, importStatements, statements, userModuleName) {
  const mainFileTemplate = `import Html.App as Html
import Html exposing (..)
import ${userModuleName} exposing (..)
${importStatements}
`

  const mainFileTemplateForComponents = `import Html.App as Html
import Html.App exposing (beginnerProgram, program)
import Html exposing (..)
${importStatements}
import ${userModuleName} exposing (..)`

  let fileContent = ''
  if (expression.type === 'frolicExpression') {
    fileContent = getGeneratedFrolicFileContent(expression, importStatements, statements, userModuleName)
  } else if (expression.type === 'renderExpression') {
    const appProgram = hasSubscribed(expression.value) ? 'program' : 'beginnerProgram'

    fileContent = `module F${expression.hash} exposing (..)
${mainFileTemplateForComponents}
${statements}
main =
    ${appProgram} ${_.drop(expression.value.split(' ')).join(' ')}`
  } else {
    fileContent = `module F${expression.hash} exposing (..)
import String
${mainFileTemplate}
${statements}
main =
    pre []
        [ text ${getSimpleExpressionChunk(expression)} ]`
  }

  return fileContent
}

function inCache(token) {
  return Boolean(cachedSources[token.hash])
}

const notInCache = _.negate(inCache)

function writeFilesForExpressions(tokens, userModuleName, codePath) {
  const importStatements = tokens
                            .filter(notInCache)
                            .filter((token) => token.type === 'importStatement')
                            .map((token) => token.value)
                            .join('\n')
  const statements = tokens
                      .filter(notInCache)
                      .filter((token) => token.type === 'assignment')
                      .map((token) => token.value)
                      .join('\n')
  const allExpressions = tokens.filter((token) => token.type === 'expression' || token.type === 'renderExpression' || token.type === 'frolicExpression')
  const expressions = allExpressions.filter(notInCache)

  const fileWritePromises = expressions.map((expression, index) => writeFile(`${codePath}/F${expression.hash}.elm`, getGeneratedMainFileContent(expression, importStatements, statements, userModuleName, index)))
  return Promise.all(fileWritePromises).then(() => allExpressions)
}

let elmMakePromises = Promise.resolve()

export function compile(code, playgroundCode, openFilePath) {
  elmMakePromises.cancel()
  // get folder path from file path
  const openFileFolderPath = openFilePath
    ? _.initial(openFilePath.split('/')).join('/')
    : null

  const tokens = tokenize(playgroundCode.trim())
  const tokensWithHashes = tokens.map((token) => ({
    ...token,
    hash: createTokenHash(openFilePath || '', token, code.trim())
  }))

  return updateFileSources(openFileFolderPath)
    .then(() => writeCodeToFile(code))
    .then((userModuleName) => writeFilesForExpressions(tokensWithHashes, userModuleName, codePath))
    .then((expressions) => { // eslint-disable-line
      return new Promise(() => {
        const allPromises = expressions.map((expression) => {
          const fileName = `F${expression.hash}`
          return promisifiedExec(`cd ${codePath} && elm-make --yes ${fileName}.elm --output=${fileName}.js`)
        })

        elmMakePromises = new Promise((resolve, reject, onCancel) => {
          // on cancellation of promise
          onCancel(() => {
            ps.lookup({
              command: 'elm-make',
              psargs: 'ax'
            }, (err, resultList) => {
              if (err) {
                console.log('error getting command info', err.toString()) // eslint-disable-line no-console
              } else {
                resultList.forEach((process) => {
                  ps.kill(process.pid, (errorGettingProcessInfo) => {
                    if (errorGettingProcessInfo) {
                      console.error('Error killing process ', errorGettingProcessInfo.toString()) // eslint-disable-line no-console
                    }
                  })
                })
              }
            })
          })

          return Promise.all(allPromises)
            .then(resolve)
            .then(() => {
              let sources = []

              sources = expressions.map((expression, index) => getSource(module, expression, index))

              const elmComponents = sources.map((source, index) => {
                // only return elm component is source is not corrupted
                // style={{display: 'flex', justifyContent: 'center'}}
                if (source && source.embed) {
                  return (
                    <div key={expressions[index].hash}>
                      <Elm key={expressions[index].hash} src={source} />
                    </div>
                  )
                } else {
                  return <span>{source}</span>
                }
              })

              subscriber.next(elmComponents)
            })
            .catch(reject)
        })
        .catch((err) => {
          console.log('elm compilation error', err.toString()) // eslint-disable-line no-console
          subscriber.next(getFormattedError(err))
        })

        return elmMakePromises
      })
    })
}

function onNewFileLoad(openFilePath) {
  const openFileFolderPath = openFilePath
    ? _.initial(openFilePath.split('/')).join('/')
    : null
  updateFileSources(openFileFolderPath)
}

function cleanUp() {
  if (subscriber) {
    subscriber.complete()
  }
}

// // TODO - to be done
function generateTests() {
  return '-- to be implemented'
}

function formatCode(code) {
  const cmd = `${basePath}/elm-format --stdin`

  function execFormat(callback) {
    const child = exec(cmd, callback)
    child.stdin.write(code)
    child.stdin.end()
    return child
  }

  return Promise.promisify(execFormat)()
  // .then((formattedCode) => _.drop(formattedCode.split('\n'), 2).join('\n'))
}

let subscriber = null
function getObservable() {
  return Rx.Observable.create((o) => {
    subscriber = o
  })
}

function onCodeChange(code, playgroundCode, openFilePath) {
  return this.compile(code, playgroundCode, openFilePath)
}

function onPlaygroundCodeChange(code, playgroundCode, openFilePath) {
  return this.compile(code, playgroundCode, openFilePath)
}

// do some initialization work here
export function compiler() {
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

let cachedNonEvaledFiles = {}
let cachedSources = {} // eslint-disable-line vars-on-top, prefer-const
const vm = require('vm')

function getSource(module, expression, index) {
  // if(!cachedSources[getExpressionValue(expression)]) {
  const fileName = `F${expression.hash}`

  if(!cachedSources[expression.hash]) {
    cachedSources[expression.hash] = fs.readFileSync(`${codePath}/${fileName}.js`).toString()
  } else {
    console.log('serving source from cache for expression', expression.value)
  }

  let previousEval
  try {
    // const bundle = fs.readFileSync(bundleFilePath).toString()
    previousEval = global.eval // eslint-disable-line no-eval
    global.eval = (source) => vm.runInThisContext(source) // eslint-disable-line no-eval
    // }
    eval(cachedSources[expression.hash]) // eslint-disable-line no-eval
  } catch (e) {
    console.error('error evaluating bundle', e.toString()) // eslint-disable-line no-console
    // return subscriber.next(getFormattedError(e))
    return getFormattedError(e)
    // throw e
  } finally {
    global.eval = previousEval // eslint-disable-line no-eval
  }

  return global.module.exports[_.capitalize(fileName)]
}
