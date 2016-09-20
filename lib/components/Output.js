'use babel'

import { React } from 'react-for-atom'

class Output extends React.Component {
  render () {
    return (
      <div>
        {this.props.output || 'Some output'}
      </div>
    )
  }
}

export default Output
