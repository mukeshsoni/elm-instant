'use babel'

import Playground from './components/Playground.js'
import { React, ReactDOM } from 'react-for-atom'

export default class PlaygroundView {

  constructor (serializedState) {
    // Create root element
    this.element = document.createElement('div')
    this.element.classList.add('react-instant')
    this.element.getTitle = function () { return 'Playground' }
    // Create message element
    const message = document.createElement('div')
    message.textContent = "The ReactInstant package is Alive! It's ALIVE!"
    message.classList.add('message')
    this.element.appendChild(message)

    ReactDOM.render(<Playground abc />, this.element)
  }

  // Returns an object that can be retrieved when package is activated
  serialize () {}

  // Tear down any state and detach
  destroy () {
    this.element.remove()
  }

  getElement () {
    return this.element
  }

}
