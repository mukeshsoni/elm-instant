module Render exposing
        ( renderExpression
        , renderAll
        , PreviewItem(..)
        )

import String

import Html exposing (..)
import Html.Attributes exposing (class, style)

import Ast exposing (parseExpression, parseStatement, parse)
import Ast.BinOp exposing (operators)
import Ast.Expression exposing (Expression(..))

type ParseError = UnknownExpression String

type PreviewItem = EmptyLines Int | UserExpression String

charComponent : Char -> Html a
charComponent ch =
    div [ class "character" ] [ text (toString ch) ]

stringComponent : String -> Html a
stringComponent str =
    div [ class "string" ] [ text str ]

integerComponent : Int -> Html a
integerComponent num =
    div [ class "integer" ] [ text (toString num) ]

floatComponent : Float -> Html a
floatComponent num =
    div [ class "float" ] [ text (toString num) ]

errorComponent : String -> Html a
errorComponent str =
    div [ class "error" ] [ text str ]

variableComponent : List String -> Html a
variableComponent names =
    div [ class "var" ] [ text (toString names) ]

listComponent : List Expression -> Html a
listComponent expressions =
    ul [ class "list" ]
       (List.map
        (\expression -> li [] (unpackListCell expression))
        expressions)

lambdaComponent : List String -> Expression -> Html a
lambdaComponent names expression =
    dl [ class "lambda" ]
       [ dt [] [ text (String.join "," (List.map toString names)) ]
       , dd [] [ renderExpression expression ]
       ]

-- binopComponent : Expression -> Expression -> Expression -> Html a
-- binopComponent operator expressionL expressionR =
--     div [ class "operator" ]
--         [ span [ class "operator-is" ] [ renderExpressionDirectly operator ]
--         , div [ class "left-expression" ]  [ renderExpressionDirectly expressionL ]
--         , div [ class "right-expression" ]  [ renderExpressionDirectly expressionR ]
--         ]

notIdentifiedExpressionComponent : String -> Html a
notIdentifiedExpressionComponent expressionString =
    div [ class "not-identitied" ] [ text expressionString ]

emptyLinesComponent : Int -> Html a
emptyLinesComponent howMuch =
    div [ style [ ( "white-space", "pre") ] ]
        [ text (String.repeat howMuch "\n") ]

unpackListCell : Expression -> List (Html a)
unpackListCell cell =
    case cell of
        BinOp op l r -> List.append (unpackListCell l) (unpackListCell r)
        v -> [ renderExpression v ]

getExpressionResult : String -> Result ParseError Expression
getExpressionResult expressionString =
    case parseExpression operators expressionString of
        (Ok r, _) -> Ok r
        _ -> Err (UnknownExpression expressionString)

renderExpression : Expression -> Html a
renderExpression expression =
    case expression of
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
        -- BinOp operator expressionL expressionR ->
            -- (binopComponent operator expressionL expressionR)
        _ -> (notIdentifiedExpressionComponent (toString expression))

renderExpressionFromString : String -> Html a
renderExpressionFromString expressionString  =
    case getExpressionResult expressionString of
        Ok expressionType -> renderExpression expressionType
        Err error ->
            case error of
                UnknownExpression message -> (errorComponent message)

renderPreviewItem : PreviewItem -> Html a
renderPreviewItem previewItem =
    case previewItem of
        UserExpression expressionString ->
            renderExpressionFromString expressionString
        EmptyLines howMuch ->
            emptyLinesComponent howMuch

renderAll : List PreviewItem -> List (Html a)
renderAll previewItems =
    List.map renderPreviewItem previewItems
