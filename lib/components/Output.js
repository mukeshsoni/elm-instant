'use babel'

import { React } from 'react-for-atom'

class Output extends React.Component {
  render () {
    return (
      <div
        style={{contain: 'strict'}}>
        {this.props.output || 'Some output'}
      </div>
    )
  }
}

export default Output
