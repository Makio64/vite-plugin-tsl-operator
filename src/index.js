import {createRequire} from 'module'
import path from 'path'
const require = createRequire(import.meta.url)

const { parse } = require('@babel/parser')
const traverse = require('@babel/traverse').default
const generate = require('@babel/generator').default

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

const isFloatCall = node =>
  t.isCallExpression(node) && t.isIdentifier(node.callee, {name: 'float'})

const inheritComments = (newNode, oldNode) => {
  newNode.leadingComments = oldNode.leadingComments
  newNode.innerComments = oldNode.innerComments
  newNode.trailingComments = oldNode.trailingComments
  return newNode
}

const transformExpression = (node, isLeftmost = true) => {
  // If already wrapped, don’t wrap again
  if(isFloatCall(node)) return node

  if(t.isBinaryExpression(node) && opMap[node.operator]) {
    // Skip Math.* expressions
    const leftMost = getLeftMostOperand(node)
    if(t.isMemberExpression(leftMost) && t.isIdentifier(leftMost.object, {name:'Math'}))
      return node

    // Flatten nested + or - in right child
    if((node.operator==='+' || node.operator==='-') &&
       t.isBinaryExpression(node.right) &&
       (node.right.operator==='+' || node.right.operator==='-')) {
      const A = transformExpression(node.left, true)
      const B = transformExpression(node.right.left, true)
      const C = transformExpression(node.right.right, false)
      let newNode
      if(node.operator==='+') {
        newNode = t.callExpression(
          t.memberExpression(
            t.callExpression(t.memberExpression(A, t.identifier('add')), [B]),
            t.identifier(node.right.operator==='+' ? 'add' : 'sub')
          ),
          [C]
        )
      }
      else if(node.operator==='-' && node.right.operator==='+') {
        newNode = t.callExpression(
          t.memberExpression(
            t.callExpression(t.memberExpression(A, t.identifier('sub')), [B]),
            t.identifier('sub')
          ),
          [C]
        )
      }
      return inheritComments(newNode, node)
    }
    const left = transformExpression(node.left, true)
    const right = transformExpression(node.right, false)
    const newNode = t.callExpression(
      t.memberExpression(left, t.identifier(opMap[node.operator])),
      [right]
    )
    return inheritComments(newNode, node)
  }
  else if(t.isUnaryExpression(node) && node.operator==='-') {
    if(t.isNumericLiteral(node.argument)) {
      const newNode = t.callExpression(t.identifier('float'), [t.numericLiteral(-node.argument.value)])
      return inheritComments(newNode, node)
    }
    const arg = transformExpression(node.argument, true)
    const newNode = t.callExpression(
      t.memberExpression(arg, t.identifier('mul')),
      [t.unaryExpression('-', t.numericLiteral(1))]
    )
    return inheritComments(newNode, node)
  }
  else if(t.isParenthesizedExpression(node)) {
    return transformExpression(node.expression, isLeftmost)
  }
  else if(t.isConditionalExpression(node)) {
    const newNode = t.conditionalExpression(
      transformExpression(node.test, false),
      transformExpression(node.consequent, true),
      transformExpression(node.alternate, true)
    )
    return inheritComments(newNode, node)
  }
  else if(t.isCallExpression(node)) {
    // In function calls, arguments aren’t in an operator chain
    const newCallee = transformExpression(node.callee, false)
    const newArgs = node.arguments.map(arg => transformExpression(arg, false))
    const newNode = t.callExpression(newCallee, newArgs)
    return inheritComments(newNode, node)
  }
	else if(t.isMemberExpression(node)){
    const newObj = transformExpression(node.object, false)
    const newNode = t.memberExpression(newObj, node.property, node.computed)
    return inheritComments(newNode, node)
  }
  else if(t.isArrowFunctionExpression(node)) {
    const newBody = transformBody(node.body)
    const newNode = t.arrowFunctionExpression(node.params, newBody, node.async)
    return inheritComments(newNode, node)
  }
  else if(isLeftmost && t.isNumericLiteral(node))
    return inheritComments(t.callExpression(t.identifier('float'), [node]), node)
  else return node
}

const transformBody = body => {
  if(t.isBlockStatement(body)) {
    body.body = body.body.map(stmt => {
      if(t.isReturnStatement(stmt) && stmt.argument)
        stmt.argument = isPureNumeric(stmt.argument)
          ? stmt.argument
          : transformExpression(stmt.argument, true)
      else if(t.isVariableDeclaration(stmt))
        stmt.declarations.forEach(decl => {
          if(decl.init)
            decl.init = t.isArrowFunctionExpression(decl.init)
              ? transformExpression(decl.init, true)
              : (isPureNumeric(decl.init)
                  ? decl.init
                  : transformExpression(decl.init, true))
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
          if(t.isIdentifier(path.node.callee, {name: 'Fn'})) {
            const fnArg = path.node.arguments[0]
            if(t.isArrowFunctionExpression(fnArg)) {
              const originalBodyNode = t.cloneNode(fnArg.body, true)
              const originalBodyCode = generate(originalBodyNode, {retainLines: true}).code
              fnArg.body = transformBody(fnArg.body)
              const newBodyCode = generate(fnArg.body, {retainLines: true}).code
              if(logs && originalBodyCode !== newBodyCode){
								const orig = originalBodyCode.split('\n')
								const nw = newBodyCode.split('\n')
								const diff = []
								for(let i = 0; i < Math.max(orig.length, nw.length); i++){
									const o = orig[i]?.trim() ?? ''
									const n = nw[i]?.trim() ?? ''
									if(o !== n)
										diff.push(`\x1b[31mBefore:\x1b[0m ${prettifyLine(o)}\n\x1b[32mAfter: \x1b[0m ${prettifyLine(n)}`)
								}
								if(diff.length)
									console.log(`\x1b[33m[tsl-operator-plugin]\x1b[0m ${filename}:\n` + diff.join('\n'))
							}
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
