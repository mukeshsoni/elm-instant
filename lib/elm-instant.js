'use babel'
/* global atom */

import OutputView from './output-view'
import _ from 'lodash'
// import PlaygroundView from './playground-view.js'
import { CompositeDisposable } from 'atom'
import { compiler as elmCompiler } from './compilers/elm-compiler/index.js'

import path from 'path'

const compiler = elmCompiler()

export default {
  OutputView: null,
  reactInstantView: null,
  modalPanel: null,
  subscriptions: null,
  playgroundEditor: null,
  codeEditor: null,
  codePath: null,

  activate: function (state) {
    this.OutputView = new OutputView(state.elmInstantViewState)

    // get code editor
    this.codeEditor = atom.workspace.getActivePane().activeItem
    // hook up it's save event to compile
    this.codeEditor.onDidSave(this.activeFileSaved.bind(this))
    this.codePath = this.codeEditor.getPath()
    this.playgroundEditor = atom.workspace.buildTextEditor('Playground')
    this.playgroundEditor.onDidStopChanging(this.playgroundCodeChanged.bind(this))

    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    this.subscriptions = new CompositeDisposable()
    compiler.outputStream.subscribe(this.handleOutput.bind(this))

    // Register command that toggles this view
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'elm-instant:toggle': () => this.toggle()
    }))
  },

  handleOutput: function (output) {
    console.log('output changed', output)
    this.OutputView.onOutputChange(output)
  },

  getFilePath: function () {
    return this.codePath
  },

  activeFileSaved() {
    console.log('active file saved')
    this.compile()
  },

  deactivate: function () {
    this.subscriptions.dispose()
    this.OutputView.destroy()
    this.previewPanel && this.previewPanel.destroyItems()
    this.playgroundPanel && this.playgroundPanel.destroyItems()
  },

  serialize: function () {
    return {
      elmInstantViewState: this.OutputView.serialize()
    }
  },

  canPreview: function () {
    return !this.previewPanel && !this.playgroundPanel && !this.previewPanel && !this.playgroundPanel
  },

  splitPane: function () {
    const activePane = atom.workspace.getActivePane()

    this.previewPanel = activePane.splitRight({
      items: [this.OutputView.getElement()]
    })

    this.playgroundPanel = activePane.splitRight({
      items: [this.playgroundEditor]
    })
  },

  playgroundCodeChanged: function (changes) {
    console.log('playground code changed', this.playgroundEditor.getText())
    this.compile()
  },

  compile () {
    if (_.last(this.codePath.split('.')) === 'elm') {
      compiler.onCodeChange(
        this.codeEditor.getText(),
        this.playgroundEditor.getText(),
        this.getFilePath())
    }
  },

  toggle: function () {
    console.log('elm-instant was toggled!', this.previewPanel)
    if(this.previewPanel && this.previewPanel.activeItem) {
      this.previewPanel.destroyItems()
      this.playgroundPanel.destroyItems()
    } else {
      this.splitPane()
    }
  }
}
