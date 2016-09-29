module Main exposing (..)

import Html exposing (..)
import UserCode exposing (..)

import Ast exposing (parseExpression, parseStatement, parse)
import Ast.BinOp exposing (operators)
import Ast.Expression exposing (Expression(..))

add2 : Int -> Int -> Int
add2 a b = a + b

type ParseError = UnknownExpression String

charComponent : Char -> Html Msg
charComponent ch =
    span [] [ text (toString ch) ]

getExpressionResult : String -> (String, Result ParseError Expression)
getExpressionResult expressionString =
    case parseExpression operators expressionString of
        (Ok r, _) -> (expressionString, Ok r)
        _ -> (expressionString, Err (UnknownExpression expressionString))

renderExpression : (String, Result ParseError Expression) -> Html Msg
renderExpression (expressionString, expressionResult)  =
    case expressionResult of
        Ok expressionType ->
            case expressionType of
                Character ch -> (charComponent ch)
                _ -> (div [] [ text expressionString ])
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
        Err error ->
            case error of
                UnknownExpression message -> span [] [ text message ]

renderAllExpressions : List String -> List (Html Msg)
renderAllExpressions expressionStrings =
    List.map renderExpression (List.map getExpressionResult expressionStrings)

expressions : List String
expressions = [
      toString (add 1)
    , toString (add2 3)
    , toString (add2 3 5)
    ]

main : Html Msg
main =
    div [] (renderAllExpressions expressions)
