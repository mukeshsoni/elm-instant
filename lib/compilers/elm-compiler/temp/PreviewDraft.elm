module Main exposing (..)

import String
import Html.App as Html
import Html exposing (..)
import UserCode exposing (..)
import Html.App exposing (beginnerProgram, program)

import Ast exposing (parseExpression, parseStatement, parse)
import Ast.Expression exposing (Expression(..))
import Ast.Statement exposing (ExportSet(..), Type(..), Statement(..))

add2 : Int -> Int -> Int
add2 a b = a + b

charComponent : Char -> Html
charComponent ch =
    span ch

renderExpression : String -> Expression -> Html
renderExpression expressionString expressionType  =
    case expressionType of
        Character ch -> charComponent ch
        _ -> div expressionString
    --   | String String
    --   | Integer Int
    --   | Float Float
    --   | Variable (List Name)
    --   | Range Expression Expression
    --   | List (List Expression)
    --   | Access Expression (List Name)
    --   | Record (List (Name, Expression))
    --   | RecordUpdate Name (List (Name, Expression))
    --   | If Expression Expression Expression
    --   | Let (List (Name, Expression)) Expression
    --   | Case Expression (List (Expression, Expression))
    --   | Lambda (List Name) Expression
    --   | Application Expression Expression
    --   | BinOp Expression Expression Expression

renderAllExpressions : List String -> Html
renderAllExpressions =
    List.map (\expressionString -> (renderExpression expressionString parseExpression))

expressions = [
      toString (add 1)
    , toString (add2 3)
    , toString (add2 3 5)
    ]

main =
    renderAllExpressions expressions
