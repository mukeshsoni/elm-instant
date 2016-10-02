# elm-instant

atom package link - https://atom.io/packages/elm-instant

elm-instant is an atom package inspired by [haskell for mac](http://haskellformac.com). It provides both a visual REPL to try your elm code as well as a preview pane to immediately see the output of calling functions you have in your elm files.

With elm-instant, you can start typing expressions and immediately see results in the output panel without any glue code. Plus, it works for ui stuff too!

## Features

- Immediate feedback
- Quick way for someone new to the language to try it out
- Mix of ui views + normal expressions
- Has around 38 packages built in (the list is below). E.g. Just do `import Http` and it will work.
- Can load files from the disk and the dependencies will be resolved automatically
- Can try multiple expressions for the same function. i like how [clojurescript devcards](https://github.com/bhauman/devcards) describes themselves - visual REPL.

![Elm counter pairs from elm-architechture examples](https://raw.githubusercontent.com/mukeshsoni/elm-instant/master/images/showcase.gif)

elm-instant was inspired by [haskell for mac](http://haskellformac.com). The primary idea is to have a playground panel where users can type out code expressions and see the result instantaneously without any setup. There is a similar thing currently for elm ([elm-lang.org/try](elm-lang.org/try)) but it has limited functionality and doesn't work without having the ui layer (model, view, update, main etc.).

## Setup

```
npm install elm -g -- in case you don't have elm installed already
apm install elm-instant
```

**Note**
To test out your views just copy whatever you would assign to `main`. E.g. if your code has -

```
main =
  Html.program
    { init = init
    , view = view
    , update = update
    , subscriptions = subscriptions
    }
```

copy this to the playground -

```
Html.program
  { init = init
  , view = view
  , update = update
  , subscriptions = subscriptions
  }
```

## Dev setup

```
npm install elm -g -- in case you don't have elm installed already
git clone https://github.com/mukeshsoni/elm-instant
cd elm-instant
npm install
npm run install-elm-packages
apm link
```

## Packages included by default
- elm-lang/animation-frame
- elm-lang/core
- elm-lang/dom
- elm-lang/geolocation
- elm-lang/html
- elm-lang/keyboard
- elm-lang/lazy
- elm-lang/mouse
- elm-lang/navigation
- elm-lang/page-visibility
- elm-lang/svg
- elm-lang/trampoline
- elm-lang/websocket
- elm-lang/window
- evancz/elm-http
- evancz/elm-markdown
- elm-community/undo-redo
- elm-community/easing-functions
- elm-community/elm-lazy-list
- elm-community/elm-linear-algebra
- elm-community/elm-material-icons
- elm-community/elm-webgl
- elm-community/graph
- elm-community/intdict
- elm-community/list-split
- elm-community/html-extra
- elm-community/json-extra
- elm-community/maybe-extra
- elm-community/random-extra
- elm-community/result-extra
- elm-community/string-extra
- elm-community/svg-extra
- elm-community/array-extra
- elm-community/basics-extra
- elm-community/dict-extra

## Maintainers

- [Mukesh Soni](https://github.com/mukeshsoni)

## License
MIT © [Mukesh Soni](https://github.com/mukeshsoni)
