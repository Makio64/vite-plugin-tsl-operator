import {createRequire} from 'module'
import path from 'path'
const require = createRequire(import.meta.url)
const {parse} = require('@babel/parser')
import traverse from '@babel/traverse'
import generate from '@babel/generator'
import * as t from '@babel/types'

const opMap = { '+': 'add', '-': 'sub', '*': 'mul', '/': 'div', '%': 'mod' }

const prettifyLine = line =>
  line.replace(/\(\s*/g, '( ').replace(/\s*\)/g, ' )')

const isPureNumeric = node => {
  if(t.isNumericLiteral(node)) return true
  if(t.isBinaryExpression(node) && opMap[node.operator])
    return isPureNumeric(node.left) && isPureNumeric(node.right)
  if(t.isUnaryExpression(node) && node.operator==='-')
    return isPureNumeric(node.argument)
  if(t.isParenthesizedExpression(node))
    return isPureNumeric(node.expression)
  return false
}

const getLeftMostOperand = node => {
  while(t.isBinaryExpression(node) && opMap[node.operator])
    node = node.left
  return node
}

const transformExpression = (node, isLeftmost = true) => {
  if(t.isBinaryExpression(node) && opMap[node.operator]){
    const leftMost = getLeftMostOperand(node)
    if(t.isMemberExpression(leftMost) && t.isIdentifier(leftMost.object, {name:'Math'}))
      return node
    if((node.operator==='+' || node.operator==='-') &&
       t.isBinaryExpression(node.right) &&
       (node.right.operator==='+' || node.right.operator==='-')){
      const A = transformExpression(node.left, true)
      const B = transformExpression(node.right.left, true)
      const C = transformExpression(node.right.right, false)
      if(node.operator==='+' ){
        if(node.right.operator==='+')
          return t.callExpression(
            t.memberExpression(
              t.callExpression(
                t.memberExpression(A, t.identifier('add')),
                [B]
              ),
              t.identifier('add')
            ),
            [C]
          )
        if(node.right.operator==='-')
          return t.callExpression(
            t.memberExpression(
              t.callExpression(
                t.memberExpression(A, t.identifier('add')),
                [B]
              ),
              t.identifier('sub')
            ),
            [C]
          )
      }
      else if(node.operator==='-' && node.right.operator==='+')
        return t.callExpression(
          t.memberExpression(
            t.callExpression(
              t.memberExpression(A, t.identifier('sub')),
              [B]
            ),
            t.identifier('sub')
          ),
          [C]
        )
    }
    const left = transformExpression(node.left, true)
    const right = transformExpression(node.right, false)
    return t.callExpression(
      t.memberExpression(left, t.identifier(opMap[node.operator])),
      [right]
    )
  }
  else if(t.isUnaryExpression(node) && node.operator==='-'){
    if(t.isNumericLiteral(node.argument))
      return t.callExpression(t.identifier('float'), [t.numericLiteral(-node.argument.value)])
    const arg = transformExpression(node.argument, true)
    return t.callExpression(
      t.memberExpression(arg, t.identifier('mul')),
      [t.unaryExpression('-', t.numericLiteral(1))]
    )
  }
  else if(t.isParenthesizedExpression(node))
    return transformExpression(node.expression, isLeftmost)
  else if(t.isConditionalExpression(node))
    return t.conditionalExpression(
      transformExpression(node.test, false),
      transformExpression(node.consequent, true),
      transformExpression(node.alternate, true)
    )
  else
    return isLeftmost && t.isNumericLiteral(node)
      ? t.callExpression(t.identifier('float'), [node])
      : node
}

const transformBody = body => {
  if(t.isBlockStatement(body)){
    body.body = body.body.map(stmt => {
      if(t.isReturnStatement(stmt) && stmt.argument)
        stmt.argument = isPureNumeric(stmt.argument)
          ? stmt.argument
          : transformExpression(stmt.argument, true)
      else if(t.isVariableDeclaration(stmt))
        stmt.declarations.forEach(decl => {
          if(decl.init)
            decl.init = isPureNumeric(decl.init)
              ? decl.init
              : transformExpression(decl.init, true)
        })
      else if(t.isExpressionStatement(stmt))
        stmt.expression = isPureNumeric(stmt.expression)
          ? stmt.expression
          : transformExpression(stmt.expression, true)
      return stmt
    })
    return body
  }
  return isPureNumeric(body) ? body : transformExpression(body, true)
}

export default function TSLOperatorPlugin({logs = true} = {}) {
  return {
    name: 'tsl-operator-plugin',
    transform(code, id) {
      if(!/\.(js|ts)x?$/.test(id)) return null
      const filename = path.basename(id)
      const ast = parse(code, {sourceType: 'module', plugins: ['jsx']})
      traverse(ast, {
        CallExpression(path) {
          if(t.isIdentifier(path.node.callee, {name: 'Fn'})){
            const fnArg = path.node.arguments[0]
            if(t.isArrowFunctionExpression(fnArg)){
              const originalBodyNode = t.cloneNode(fnArg.body, true)
              const originalBodyCode = generate(originalBodyNode, {retainLines: true}).code
              fnArg.body = transformBody(fnArg.body)
              const newBodyCode = generate(fnArg.body, {retainLines: true}).code
              if(logs && originalBodyCode !== newBodyCode)
                console.log(
                  `\x1b[33m[tsl-operator-plugin]\x1b[0m ${filename}:\n` +
                  `\x1b[31mBefore:\x1b[0m ${originalBodyCode}\n` +
                  `\x1b[32mAfter: \x1b[0m ${newBodyCode
                    .split('\n')
                    .map(line => prettifyLine(line))
                    .join('\n')}\n`
                )
            }
          }
        }
      })
      const output = generate(ast, {retainLines: true}, code)
      const generatedCode = output.code.replace(/;(\n|$)/g, '$1')
      return {code: generatedCode, map: output.map}
    }
  }
}
