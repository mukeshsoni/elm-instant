module Main exposing (..)

import Html exposing (..)
import UserCode exposing (..)

import Render exposing (renderAllExpressions)

add2 : Int -> Int -> Int
add2 a b = a + b

expressions : List String
expressions = [
      toString (add 1)
    , toString (add2 3)
    , toString (add2 3 5)
    ]

main : Html Msg
main =
    div [] (renderAllExpressions expressions)
