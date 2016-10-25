'use babel'
// @flow

import { React, ReactDOM } from 'react-for-atom'

class Playground extends React.Component {
  handleClick: () => void;
  constructor() {
    super()
    this.handleClick = this.handleClick.bind(this)
  }

  handleClick() {
    alert('no more to show :(')
  }

  render() {
    return (
      <div>
          This seems to work, yup it does
          <button onClick={this.handleClick}>Show more</button>
      </div>
    )
  }
}

export default Playground
