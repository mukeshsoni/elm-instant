'use babel'
/* global atom */

import OutputView from './output-view'
import _ from 'lodash'
// import PlaygroundView from './playground-view.js'
import { CompositeDisposable } from 'atom'
import { compiler as elmCompiler } from './compilers/elm-compiler/index.js'

const compiler = elmCompiler()

export default {
  OutputView: null,
  reactInstantView: null,
  modalPanel: null,
  subscriptions: null,
  playgroundEditor: null,
  playgroundCode: '',
  codeEditor: null,
  codePath: null,

  activate: function (state) {
    this.OutputView = new OutputView(state.elmInstantViewState)

    this.initUI()
    this.setupActiveEditorDetails()
    atom.workspace.onDidStopChangingActivePaneItem(this.handleActivePaneChange.bind(this))

    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    this.subscriptions = new CompositeDisposable()
    compiler.outputStream.subscribe(this.handleOutput.bind(this))

    // Register command that toggles this view
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'elm-instant:toggle': () => this.toggle()
    }))
  },

  setupActiveEditorDetails: function () {
    // get code editor
    this.codeEditor = atom.workspace.getActivePane().activeItem
    // hook up it's save event to compile
    this.codeEditor.onDidSave(this.activeFileSaved.bind(this))
    this.codePath = this.codeEditor.getPath()
  },

  handleActivePaneChange: function (newPaneItem) {
    if (atom.workspace.isTextEditor(newPaneItem) && newPaneItem.id !== this.playgroundEditor.id && this.previewPanel && this.previewPanel.isVisible()) {
      this.setupActiveEditorDetails()
      this.compile()
    }
  },

  handleOutput: function (output) {
    console.log('output changed', output)
    this.OutputView.onOutputChange(output)
  },

  activeFileSaved: function () {
    console.log('active file saved')
    this.compile()
  },

  deactivate: function () {
    this.subscriptions.dispose()
    this.OutputView && this.OutputView.destroy()
    this.previewPanel && this.previewPanel.destroy()
    this.playgroundPane && this.playgroundPane.destroy()
  },

  serialize: function () {
    return {
      elmInstantViewState: this.OutputView.serialize()
    }
  },

  canPreview: function () {
    return !this.previewPane && !this.playgroundPane && !this.previewPane && !this.playgroundPane
  },

  initUI: function () {
    this.previewPanel = atom.workspace.addRightPanel({
      item: this.OutputView.getElement(),
      visible: false
    })
  },

  createPlaygroundPane: function () {
    const activePane = atom.workspace.getActivePane()
    this.playgroundEditor = atom.workspace.buildTextEditor()
    this.playgroundEditor.setText(this.playgroundCode)
    this.playgroundEditor.setGrammar(atom.grammars.grammarForScopeName('source.elm'))
    this.playgroundEditor.onDidStopChanging(this.playgroundCodeChanged.bind(this))
    this.playgroundPane = activePane.splitRight({
      items: [this.playgroundEditor]
    })
    console.log('playgroundPane id', this.playgroundPane.id)
  },

  playgroundCodeChanged: function (changes) {
    this.playgroundCode = this.playgroundEditor.getText()
    this.compile()
  },

  compile: function () {
    if (_.last(this.codeEditor.getPath().split('.')) === 'elm') {
      compiler.onCodeChange(
        this.codeEditor.getText(),
        this.playgroundCode,
        this.codeEditor.getPath())
    } else if (this.previewPanel.isVisible()) {
      compiler.onCodeChange(
        '',
        this.playgroundEditor.getText(),
        this.codeEditor.getPath())
    }
  },

  toggle: function () {
    if (this.previewPanel && this.previewPanel.isVisible()) {
      this.previewPanel.hide()
      this.playgroundPane.destroy()
    } else {
      this.createPlaygroundPane()
      this.previewPanel.show()
    }
  }
}
