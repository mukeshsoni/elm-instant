module Render exposing (renderExpression, renderAllExpressions)

import String

import Html exposing (..)
import Html.Attributes exposing (class)

import Ast exposing (parseExpression, parseStatement, parse)
import Ast.BinOp exposing (operators)
import Ast.Expression exposing (Expression(..))
import Ast.Helpers exposing (Name)

type ParseError = UnknownExpression String

charComponent : Char -> Html a
charComponent ch =
    span [ class "character" ] [ text (toString ch) ]

stringComponent : String -> Html a
stringComponent str =
    span [ class "string" ] [ text str ]

integerComponent : Int -> Html a
integerComponent num =
    span [ class "integer" ] [ text (toString num) ]

floatComponent : Float -> Html a
floatComponent num =
    span [ class "float" ] [ text (toString num) ]

errorComponent : String -> Html a
errorComponent str =
    span [ class "error" ] [ text str ]

variableComponent : List Name -> Html a
variableComponent names =
    span [ class "var" ] [ text (toString names) ]

listComponent : List Expression -> Html a
listComponent expressions =
    ul [ class "list" ]
       (List.map renderExpressionDirectly expressions)

lambdaComponent : List Name -> Expression -> Html a
lambdaComponent names expression =
    dl [ class "lambda" ]
       [ dt [] [ text (String.join "," (List.map toString names)) ]
       , dd [] [ renderExpressionDirectly expression ]
       ]

notIdentifiedExpressionComponent : String -> Html a
notIdentifiedExpressionComponent expressionString =
    span [ class "not-identitied" ] [ text expressionString ]

getExpressionResult : String -> (String, Result ParseError Expression)
getExpressionResult expressionString =
    case parseExpression operators expressionString of
        (Ok r, _) -> (expressionString, Ok r)
        _ -> (expressionString, Err (UnknownExpression expressionString))

renderExpressionDirectly : Expression -> Html a
renderExpressionDirectly expression =
    renderExpression ("?",  Ok expression)

renderExpression : (String, Result ParseError Expression) -> Html a
renderExpression (expressionString, expressionResult)  =
    case expressionResult of
        Ok expressionType ->
            case expressionType of
                Character ch -> (charComponent ch)
                String str -> (stringComponent str)
                Integer int -> (integerComponent int)
                Float float -> (floatComponent float)
                Variable names -> (variableComponent names)
                --   | Range Expression Expression
                List expressions -> (listComponent expressions)
                --   | Access Expression (List Name)
                --   | Record (List (Name, Expression))
                --   | RecordUpdate Name (List (Name, Expression))
                --   | If Expression Expression Expression
                --   | Let (List (Name, Expression)) Expression
                --   | Case Expression (List (Expression, Expression))
                Lambda names expression -> (lambdaComponent names expression)
                --   | Application Expression Expression
                --   | BinOp Expression Expression Expression
                _ -> (notIdentifiedExpressionComponent expressionString)

        Err error ->
            case error of
                UnknownExpression message -> (errorComponent message)

renderAllExpressions : List String -> List (Html a)
renderAllExpressions expressionStrings =
    List.map renderExpression (List.map getExpressionResult expressionStrings)