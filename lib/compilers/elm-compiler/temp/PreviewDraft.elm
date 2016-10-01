module Main exposing (..)

import Html exposing (..)
import UserCode exposing (..)

import Render exposing (renderAll, PreviewItem(..))

add2 : Int -> Int -> Int
add2 a b = a + b

previewItems : List PreviewItem
previewItems = [
      UserExpression (toString (add 1))
    , UserExpression (toString (add2 3))
    , EmptyLines 3
    , UserExpression (toString (add2 3 5))
    ]

main : Html Msg
main =
    div [] (renderAll previewItems)
