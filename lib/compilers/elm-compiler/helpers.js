'use babel'
// @flow

import _ from 'lodash'
import crypto from 'crypto'
import memoize from 'fast-memoize'

import type { Token } from './parser.js'

export function cleanUpExpression(exprValue: string) {
  return _.trimEnd(exprValue.split('--')[0])
}

export function getExpressionValue(expr: Token) {
  if (expr.commands) {
    return expr.commands.reduce((acc, command) => acc + cleanUpExpression(command.value), '')
  } else {
    return cleanUpExpression(expr.value)
  }
}

const hash = memoize(function hash(str) {
  return crypto.createHash('md5').update(str).digest('hex')
})

export const createTokenHash = memoize(function (fileName : string = '', token: Token, code: string) {
  return hash(`${fileName}${getExpressionValue(token)}${hash(code)}`)
})
