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

const isFloatCall = node =>
  t.isCallExpression(node) && t.isIdentifier(node.callee, {name: 'float'})

const inheritComments = (newNode, oldNode) => {
  newNode.leadingComments = oldNode.leadingComments
  newNode.innerComments = oldNode.innerComments
  newNode.trailingComments = oldNode.trailingComments
  return newNode
}

const transformExpression = (node, isLeftmost = true, scope, pureVars = new Set()) => {
  if(isFloatCall(node)) return node

  if(t.isBinaryExpression(node) && opMap[node.operator]) {
		// If left is a Math property, skip transforming this binary expression.
		if(t.isMemberExpression(node.left) && t.isIdentifier(node.left.object, {name: 'Math'}))
			return node
		const left = transformExpression(node.left, true, scope, pureVars)
		const right = transformExpression(node.right, false, scope, pureVars)
		return inheritComments(
			t.callExpression(
				t.memberExpression(left, t.identifier(opMap[node.operator])),
				[right]
			),
			node
		)
	}	
  else if(t.isAssignmentExpression(node)){
    const left = transformExpression(node.left, false, scope, pureVars)
    const right = transformExpression(node.right, true, scope, pureVars)
    return inheritComments(
      t.assignmentExpression(node.operator, left, right),
      node
    )
  }
  else if(t.isUnaryExpression(node) && node.operator==='-'){
    if(t.isNumericLiteral(node.argument))
      return inheritComments(
        t.callExpression(t.identifier('float'), [t.numericLiteral(-node.argument.value)]),
        node
      )
    if(t.isIdentifier(node.argument)){
      const binding = scope && scope.getBinding(node.argument.name)
      const isPure = (binding && t.isVariableDeclarator(binding.path.node) && isPureNumeric(binding.path.node.init))
        || (pureVars && pureVars.has(node.argument.name))
      if(isPure){
        const newArg = t.callExpression(t.identifier('float'), [node.argument])
        return inheritComments(
          t.callExpression(
            t.memberExpression(newArg, t.identifier('mul')),
            [t.unaryExpression('-', t.numericLiteral(1))]
          ),
          node
        )
      }
    }
    const arg = transformExpression(node.argument, true, scope, pureVars)
    return inheritComments(
      t.callExpression(
        t.memberExpression(arg, t.identifier('mul')),
        [t.unaryExpression('-', t.numericLiteral(1))]
      ),
      node
    )
  }
  else if(t.isParenthesizedExpression(node))
    return transformExpression(node.expression, isLeftmost, scope, pureVars)
  else if(t.isConditionalExpression(node)){
    const newNode = t.conditionalExpression(
      transformExpression(node.test, false, scope, pureVars),
      transformExpression(node.consequent, true, scope, pureVars),
      transformExpression(node.alternate, true, scope, pureVars)
    )
    return inheritComments(newNode, node)
  }
  else if(t.isCallExpression(node)){
    const newCallee = transformExpression(node.callee, false, scope, pureVars)
    const newArgs = node.arguments.map(arg => transformExpression(arg, false, scope, pureVars))
    return inheritComments(
      t.callExpression(newCallee, newArgs),
      node
    )
  }
  else if(t.isMemberExpression(node)){
    if(t.isIdentifier(node.object, {name:'Math'}))
      return node
    const newObj = transformExpression(node.object, false, scope, pureVars)
    return inheritComments(
      t.memberExpression(newObj, node.property, node.computed),
      node
    )
  }
  else if(t.isArrowFunctionExpression(node)){
    const newBody = transformBody(node.body, scope, pureVars)
    return inheritComments(
      t.arrowFunctionExpression(node.params, newBody, node.async),
      node
    )
  }
  else if(isLeftmost && t.isNumericLiteral(node))
    return inheritComments(
      t.callExpression(t.identifier('float'), [node]),
      node
    )
  else if(isLeftmost && t.isIdentifier(node) && node.name !== 'Math'){
    const binding = scope && scope.getBinding(node.name)
    if((binding && t.isVariableDeclarator(binding.path.node) && isPureNumeric(binding.path.node.init))
       || (pureVars && pureVars.has(node.name)))
      return inheritComments(t.callExpression(t.identifier('float'), [node]), node)
    return node
  }
  else return node
}


const transformBody = (body, scope, pureVars = new Set()) => {
  if(t.isBlockStatement(body)){
    const localPure = new Set(pureVars)
    body.body.forEach(stmt => {
      if(t.isVariableDeclaration(stmt))
        stmt.declarations.forEach(decl => {
          if(t.isIdentifier(decl.id) && decl.init && isPureNumeric(decl.init))
            localPure.add(decl.id.name)
        })
    })
    body.body = body.body.map(stmt => {
      if(t.isReturnStatement(stmt) && stmt.argument)
        stmt.argument = isPureNumeric(stmt.argument)
          ? stmt.argument
          : transformExpression(stmt.argument, true, scope, localPure)
      else if(t.isVariableDeclaration(stmt))
        stmt.declarations.forEach(decl => {
          if(decl.init)
            decl.init = t.isArrowFunctionExpression(decl.init)
              ? transformExpression(decl.init, true, scope, localPure)
              : (isPureNumeric(decl.init)
                  ? decl.init
                  : transformExpression(decl.init, true, scope, localPure))
        })
      else if(t.isExpressionStatement(stmt))
        stmt.expression = isPureNumeric(stmt.expression)
          ? stmt.expression
          : transformExpression(stmt.expression, true, scope, localPure)
      return stmt
    })
    return body
  }
  return isPureNumeric(body)
    ? body
    : transformExpression(body, true, scope, pureVars)
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
							fnArg.body = transformBody(fnArg.body, path.scope)
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
