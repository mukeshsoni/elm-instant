'use babel'
// @flow

import _ from 'lodash'
import fs from 'fs'
import jsonfile from 'jsonfile'
import path from 'path'
import Promise from 'bluebird'

import {
  cleanUpExpression,
} from './helpers'

const writeJsonFile = Promise.promisify(jsonfile.writeFile)

const writeFile = Promise.promisify(fs.writeFile)
const basePath = path.resolve(__dirname)

const tempFolderPath = `${basePath}/temp`
const codePath = tempFolderPath
import type { Token } from './parser.js'

type ElmPackageJson = {
  "version": string,
  "summary": string,
  "repository": string,
  "license": string,
  "source-directories": string[],
  "exposed-modules": string[],
  "dependencies": string[],
  "elm-version": string
};

export function writeSourcesToElmPackageJson(templateFileContents: ElmPackageJson, basePathForOpenFile: string) {
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
export function updateFileSources(openFilePath: string | null = tempFolderPath, lastOpenFilePath: string, packageJsonTemplateFileContents: ElmPackageJson) {
  if ((openFilePath && lastOpenFilePath === openFilePath) || (!openFilePath && lastOpenFilePath === tempFolderPath)) {
    return Promise.resolve(true)
  } else {
    lastOpenFilePath = openFilePath || tempFolderPath
  }

  return writeSourcesToElmPackageJson(packageJsonTemplateFileContents, openFilePath || tempFolderPath)
}

export function writeCodeToFile(code: string) {
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

export function getGeneratedFrolicFileContent(expression: Token, importStatements: string, statements: string, userModuleName: string) {
  const mainFileTemplateForComponents = `import Html exposing (..)
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

export function getGeneratedMainFileContent(expression: Token, importStatements: string, statements: string, userModuleName: string) {
  const mainFileTemplate = `import Html exposing (..)
import ${userModuleName} exposing (..)
${importStatements}
`

  const mainFileTemplateForComponents = `import Html exposing (..)
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

export function writeFilesForExpressions(tokens: Token[], userModuleName: string, codePath: string, notInCache: Function) {
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

function getToStrings(expression: Token) {
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

function hasSubscribed(code) {
  return code.indexOf('subscriptions') >= 0
}
