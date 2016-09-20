'use babel'
/* global atom */

import OutputView from './output-view'
import _ from 'lodash'
// import PlaygroundView from './playground-view.js'
import { CompositeDisposable } from 'atom'
// import { compiler as reactCompiler } from './compilers/react-compiler/index.js'
import { compiler as elmCompiler } from './compilers/elm-compiler/index.js'

import path from 'path'
// console.log('react compiler', reactCompiler)
// const compiler = reactCompiler()
const compiler = elmCompiler()

export default {
  OutputView: null,
  reactInstantView: null,
  modalPanel: null,
  subscriptions: null,
  playgroundEditor: null,

  activate: function (state) {
    this.OutputView = new OutputView(state.reactInstantViewState)
    // this.playgroundView = new PlaygroundView(state.reactInstantViewState)
    this.playgroundEditor = atom.workspace.buildTextEditor()

    this.modalPanel = atom.workspace.addModalPanel({
      item: this.OutputView.getElement(),
      visible: false
    })

    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    this.subscriptions = new CompositeDisposable()
    compiler.outputStream.subscribe(this.handleOutput.bind(this))

    // Register command that toggles this view
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'react-instant:toggle': () => this.toggle()
    }))
  },

  handleOutput: function (output) {
    this.OutputView.onOutputChange(output)
  },

  currentFilePath: null,

  getFilePath: function () {
    const activeTextEditor = atom.workspace.getActiveTextEditor()
    const currentFilePath = activeTextEditor && activeTextEditor.getPath()

    if (currentFilePath) {
      this.currentFilePath = path.resolve(currentFilePath)
    }

    return this.currentFilePath
  },

  activeFileChanged: function (changes) {
    const filePath = this.getFilePath()
    console.log('filePath', filePath, _.last(filePath.split('.')))
    if (_.last(filePath.split('.')) === 'elm') {
      compiler.onCodeChange(
        atom.workspace.getActiveTextEditor().buffer.cachedText,
        this.playgroundEditor.buffer.cachedText,
        this.getFilePath())
    }
  },

  deactivate: function () {
    this.modalPanel.destroy()
    this.subscriptions.dispose()
    this.OutputView.destroy()
  },

  serialize: function () {
    return {
      reactInstantViewState: this.OutputView.serialize()
    }
  },

  canPreview: function () {
    return true
  },

  splitPane: function () {
    if (this.canPreview()) {
      const activePane = atom.workspace.getActivePane()
      // this.reactComponentPreviewView = this.getView()

      this.previewPanel = activePane.splitRight({
        items: [this.OutputView.getElement()]
      })

      this.previewPanel2 = activePane.splitRight({
        items: [this.playgroundEditor]
      })

      activePane.activate()
      this.subscriptions.add(atom.workspace.onDidStopChangingActivePaneItem(this.activeFileChanged.bind(this)))
      atom.workspace.getActiveTextEditor().onDidStopChanging(this.activeFileChanged.bind(this))
      this.playgroundEditor.onDidStopChanging(this.playgroundCodeChanged.bind(this))
    // this.subscribeToFileEvents()
    }
  },

  playgroundCodeChanged: function (changes) {
    console.log('playground code changed', this.playgroundEditor.buffer.cachedText)
    this.compile()
  },

  compile () {
    compiler.onCodeChange(
      atom.workspace.getActiveTextEditor().buffer.cachedText,
      this.playgroundEditor.buffer.cachedText,
      this.getFilePath())
  },

  toggle: function () {
    console.log('ReactInstant was toggled!')
    this.splitPane()
  }
}
