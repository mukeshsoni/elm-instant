'use babel'

import { React, ReactDOM } from 'react-for-atom'

import Output from './components/Output.js'

let errorPlaceholder = <noscript />

var __DEV__ = true
if (__DEV__) {
  errorPlaceholder = (
    <span style={{ background: 'red', color: 'white' }}>Render error!</span>
  )
}

function logError (Component, error) {
  const errorMsg = `Error while rendering component. Check render() method of component '${Component.displayName || Component.name || '[unidentified]'}'.`

  console.error(errorMsg, 'Error details:', error); // eslint-disable-line
}

function monkeypatchRender (prototype) {
  if (prototype && prototype.render && !prototype.render.__handlingErrors) {
    const originalRender = prototype.render

    prototype.render = function monkeypatchedRender () {
      // console.log('monkey')
      try {
        return originalRender.call(this)
      } catch (error) {
        logError(prototype.constructor, error)

        return errorPlaceholder
      }
    }

    prototype.render.__handlingErrors = true // flag render method so it's not wrapped multiple times
  }
}

const originalCreateElement = React.createElement
React.createElement = (Component, ...rest) => {
  if (typeof Component === 'function') {
    if (typeof Component.prototype.render === 'function') {
      monkeypatchRender(Component.prototype)
    }

    // stateless functional component
    if (!Component.prototype.render) {
      const originalStatelessComponent = Component
      Component = (...args) => {
        try {
          return originalStatelessComponent(...args)
        } catch (error) {
          logError(originalStatelessComponent, error)

          return errorPlaceholder
        }
      }
    }
  }

  return originalCreateElement.call(React, Component, ...rest)
}

// allowing hot reload
const originalForceUpdate = React.Component.prototype.forceUpdate
React.Component.prototype.forceUpdate = function monkeypatchedForceUpdate () {
  monkeypatchRender(this)
  originalForceUpdate.call(this)
}

export default class OutputView {

  constructor (serializedState) {
    // Create root element
    this.element = document.createElement('div')
    this.element.getTitle = function () { return 'Preview' }
    this.onOutputChange('')
  }

  // Returns an object that can be retrieved when package is activated
  serialize () {}

  // Tear down any state and detach
  destroy () {
    ReactDOM.unmountComponentAtNode(this.element)
  }

  getElement () {
    return this.element
  }

  onOutputChange (output) {
    try {
      ReactDOM.render(<Output output={output} />, this.element)
    } catch (e) {
      console.log('error rendering component', e)
    }
  }
}
