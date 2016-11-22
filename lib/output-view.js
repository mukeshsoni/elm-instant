'use babel'

import { React, ReactDOM } from 'react-for-atom'

import Output from './components/Output.js'

export default class OutputView {

  constructor (serializedState) {
    // Create root element
    this.element = document.createElement('div')
    this.element.style.width = '500px'
    this.element.style.overflow = 'auto'
    this.element.style.contain = 'strict'
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
    this.output = output.output
    try {
      ReactDOM.render(<Output output={output.output || this.output} compiling={output.compiling} />, this.element)
    } catch (e) {
      console.log('error rendering component', e)
    }
  }
}
