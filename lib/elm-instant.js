'use babel'
/* global atom */

import OutputView from './output-view'
import _ from 'lodash'
import { CompositeDisposable } from 'atom'
import { compiler as elmCompiler } from './compilers/elm-compiler/index.js'
import fs from 'fs'
import path from 'path'

const compiler = elmCompiler()
const playgroundCodeFilePath = path.join(__dirname, 'playgroundCode.json')

export default {
  OutputView: null,
  reactInstantView: null,
  modalPanel: null,
  subscriptions: null,
  playgroundEditor: null,
  playgroundCode: {Untitled: ''},
  codeEditor: null,
  codePath: null,

  activate: function (state) {
    this.OutputView = new OutputView(state.elmInstantViewState)
    try {
        const cachedPlaygroundCode = JSON.parse(fs.readFileSync(playgroundCodeFilePath).toString())
        this.playgroundCode = cachedPlaygroundCode
    } catch(e) {
        console.log('Error parsing playground code file', e.toString())
    }

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
    if (this.codeEditor && this.codeEditor.onDidSave) {
      this.codeEditor.onDidSave(this.activeFileSaved.bind(this))
      this.codePath = this.codeEditor.getPath()
    }
  },

  handleActivePaneChange: function (newPaneItem) {
    if (atom.workspace.isTextEditor(newPaneItem) && newPaneItem.id !== this.playgroundEditor.id && this.previewPanel && this.previewPanel.isVisible()) {
      this.setupActiveEditorDetails()
      if (!this.playgroundCode[this.getCodePath()]) {
        this.playgroundCode[this.getCodePath()] = ''
      }
      this.playgroundEditor.setText(this.getPlaygroundCode())
      this.compile()
    }
  },

  handleOutput: function (output) {
    this.OutputView.onOutputChange(output)
  },

  activeFileSaved: function () {
    console.log('active file saved')
    this.compile()
  },

  deactivate: function () {
      console.log('deactivate')
      fs.writeFileSync(playgroundCodeFilePath, JSON.stringify(this.playgroundCode))
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
    const codeEditorPane = atom.workspace.getActivePane()
    this.playgroundEditor = atom.workspace.buildTextEditor()
    this.playgroundEditor.buffer.onWillSave(() => console.log('playground code going to be saved'))
    this.playgroundEditor.setText(this.getPlaygroundCode())
    this.playgroundEditor.setGrammar(atom.grammars.grammarForScopeName('source.elm'))
    this.playgroundEditor.onDidStopChanging(this.playgroundCodeChanged.bind(this))
    this.playgroundPane = codeEditorPane.splitRight({
      items: [this.playgroundEditor]
    })

    // if a file is opened in the playground pane, move it to editor pane
    this.playgroundPane.onDidAddItem((pane) => {
      if (atom.workspace.isTextEditor(pane.item) && pane.item.id !== this.playgroundEditor.id && this.playgroundPane.isActive()) {
        // if i don't wait for 100 ms, weird thing happens. The code for the opened file is pasted in the playground editor
        setTimeout(() => {
          this.playgroundPane.moveItemToPane(pane.item, codeEditorPane, 0)
          codeEditorPane.activate()
          codeEditorPane.activateItem(pane.item)
        }, 100)
      }
    })
  },

  getCodePath: function () {
    if (this.codeEditor &&
      this.codeEditor.getPath &&
      _.isString(this.codeEditor.getPath())) {
      return this.codeEditor.getPath()
    } else {
      return 'Untitled'
    }
  },

  setPlaygroundCode: function () {},

  getPlaygroundCode: function () {
    return this.playgroundCode[this.getCodePath()] || ''
  },

  playgroundCodeChanged: function (changes) {
    this.playgroundCode[this.getCodePath()] = this.playgroundEditor.getText()
    this.compile()
  },

  compile: function () {
    if (this.codeEditor &&
      this.codeEditor.getPath &&
      _.isString(this.codeEditor.getPath()) &&
      _.last(this.codeEditor.getPath().split('.')) === 'elm') {
      compiler.onCodeChange(
        this.codeEditor.getText(),
        this.getPlaygroundCode(),
        this.codeEditor.getPath())
    } else if (this.previewPanel.isVisible()) {
      compiler.onCodeChange(
        this.codeEditor && this.codeEditor.getText ? this.codeEditor.getText() : '',
        this.getPlaygroundCode(),
        this.codeEditor && this.codeEditor.getPath ? this.codeEditor.getPath() : null)
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
