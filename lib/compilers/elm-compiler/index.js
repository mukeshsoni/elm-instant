'use babel'
// @flow

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

import { tokenize } from './parser.js'
import {
  createTokenHash,
  cleanUpExpression,
} from './helpers'

Promise.config({
  cancellation: true
})

const basePath = path.resolve(__dirname)
const tempFolderPath = `${basePath}/temp`
const codePath = tempFolderPath
const promisifiedExec = Promise.promisify(exec)

import {
  writeSourcesToElmPackageJson,
  updateFileSources,
  writeCodeToFile,
  getGeneratedMainFileContent,
  getGeneratedFrolicFileContent,
  writeFilesForExpressions,
} from './fileWriters.js'

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
        background: '#D8000C',
        color: 'white',
        display: 'block',
        clear: 'both'
      }}
    >
      {correctedErrorString}
    </div>
  )
}

let lastOpenFilePath = ''

function inCache(token) {
  return Boolean(cachedSources[token.hash])
}

const notInCache = _.negate(inCache)

let elmMakePromises = Promise.resolve()

function reflect(promise){
  return promise.then(function(v){ return {v:v, status: "resolved" }}
                      , function(e){ return {e:e, status: "rejected" }});
}

function handleCancel() {
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
}

function resultToComponent(expressions, results) {
  const elmMakeErrors = results.filter(r => r.status === 'rejected')
  const errorIndices = results.map((r, i) => i).filter(i => results[i].status === 'rejected')
  const sources = expressions
                  .filter((a, i) => !errorIndices.includes(i))
                  .map((expression, index) => getSource(module, expression, index))

  const elmComponents = sources.map((source, index) => {
    // only return elm component is source is not corrupted
    // style={{display: 'flex', justifyContent: 'center'}}
    if (source && source.embed) {
      return (
        <div
          key={expressions[index].hash}
          style={{
            clear: 'both'
          }}
          >
          <Elm key={expressions[index].hash} src={source} />
        </div>
      )
    } else {
      console.log('error in elm make', source)
      return <span>{source}</span>
    }
  })

  const elmErrorComponents = elmMakeErrors.map((elmMakeError) => getFormattedError(elmMakeError.e))

  return subscriber.next({
    output: elmComponents.concat(elmErrorComponents),
    compiling: false,
    error: elmMakeErrors.map(e => e.e.toString())
  })
}

function compileElmFiles(expressions) {
  const allPromises = expressions.map((expression) => {
    const fileName = `F${expression.hash}`
    return promisifiedExec(`cd ${codePath} && elm-make --yes ${fileName}.elm --output=${fileName}.js`)
  })

  return allPromises
}

export function compile(code: string = '', playgroundCode: string = '', openFilePath: string) {
  if(elmMakePromises && elmMakePromises.cancel) {
      elmMakePromises.cancel()
  }

  // get folder path from file path
  const openFileFolderPath = openFilePath
    ? _.initial(openFilePath.split('/')).join('/')
    : null

  const tokens = tokenize(playgroundCode.trim())
  const tokensWithHashes = tokens.map((token) => ({
    ...token,
    hash: createTokenHash(openFilePath || '', token, code.trim())
  }))

  subscriber.next({compiling: true})

  return updateFileSources(openFileFolderPath, lastOpenFilePath, packageJsonTemplateFileContents)
    .then(() => writeCodeToFile(code))
    .then((userModuleName) => writeFilesForExpressions(tokensWithHashes, userModuleName, codePath, notInCache))
    .then((expressions) => ({allPromises: compileElmFiles(expressions), expressions}))
    .then(({allPromises, expressions}) => { // eslint-disable-line
      return new Promise((resolve, reject, onCancel) => {
        // on cancellation of promise
        if(onCancel) {
          onCancel(handleCancel)
        }

        return Promise.all(allPromises.map(reflect))
          .then(resultToComponent.bind(null, expressions))
          .then(resolve)
          .catch(reject)
      })
    })
    .catch((err) => {
      console.log('elm compilation error', err.toString()) // eslint-disable-line no-console
      subscriber.next({
        error: getFormattedError(err)
      })
    })
}

function onNewFileLoad(openFilePath: string) {
  const openFileFolderPath = openFilePath
    ? _.initial(openFilePath.split('/')).join('/')
    : null
  updateFileSources(openFileFolderPath, lastOpenFilePath, packageJsonTemplateFileContents)
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

function formatCode(code: string) {
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

let subscriber = { next: () => null, complete: () => null }

function getObservable() {
  return Rx.Observable.create((o) => {
    subscriber = o
  })
}

function onCodeChange(code: string, playgroundCode: string, openFilePath: string) {
  return this.compile(code, playgroundCode, openFilePath)
}

function onPlaygroundCodeChange(code: string, playgroundCode: string, openFilePath: string) {
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

function getSource(module, expression, index): React$Element<any> {
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
