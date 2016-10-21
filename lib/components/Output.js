'use babel'

import { React } from 'react-for-atom'

class Output extends React.Component {
  render () {
    return (
      <div
        style={{
          contain: 'strict'
        }}
        >
        <ul is="atom-tabs" className="list-inline tab-bar inset-panel" tabindex="-1">
          <li
            is="tabs-tab"
            style={{
              display: 'flex',
              width: '100%',
              justifyContent: 'space-between'
            }}
            className="texteditor tab sortable active"
            data-type="TextEditor"
            >
            <div class="title">Preview</div>
            {this.props.compiling ? <div>Compiling...</div> : null}
            <div class="close-icon">
            </div>
          </li>
        </ul>
        <div>
          {this.props.output || 'Write some code in playground pane (middle one) to see instant output'}
        </div>
      </div>
    )
  }
}

export default Output
