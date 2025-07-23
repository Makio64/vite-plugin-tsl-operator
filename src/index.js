import {createRequire} from 'module'
import path from 'path'
const require = createRequire(import.meta.url)

const {parse} = require('@babel/parser')
const traverse = require('@babel/traverse').default
const generate = require('@babel/generator').default

import * as t from '@babel/types'

const opMap = { '+': 'add', '-': 'sub', '*': 'mul', '/': 'div', '%': 'mod' }
const assignOpMap = Object.fromEntries(
  Object.entries(opMap)
    .map(([op, fn]) => [`${op}=`, `${fn}Assign`])
)

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

const transformPattern = (node, scope, pureVars) => {
  if(t.isAssignmentPattern(node))
    return t.assignmentPattern(node.left, transformExpression(node.right, true, scope, pureVars))
  if(t.isObjectPattern(node)) {
    const newProps = node.properties.map(prop => {
      if(t.isObjectProperty(prop)) {
        const newKey = prop.computed ? transformExpression(prop.key, true, scope, pureVars) : prop.key
        const newValue = transformPattern(prop.value, scope, pureVars)
        return t.objectProperty(newKey, newValue, prop.computed, prop.shorthand)
      }
      if(t.isRestElement(prop))
        return t.restElement(transformPattern(prop.argument, scope, pureVars))
      return prop
    })
    return t.objectPattern(newProps)
  }
  if(t.isArrayPattern(node)) {
    const newElements = node.elements.map(el => el ? transformPattern(el, scope, pureVars) : el)
    return t.arrayPattern(newElements)
  }
  return node
}

const transformExpression = (node, isLeftmost = true, scope, pureVars = new Set()) => {
  if(isFloatCall(node)) return node
  // handle (x * y) % z only when x isn't already a % expression
  if (
    t.isBinaryExpression(node) &&
    node.operator === '%' &&
    t.isBinaryExpression(node.left) &&
    node.left.operator === '*' &&
    !(t.isBinaryExpression(node.left.left) && node.left.left.operator === '%')
  ) {
    const leftExpr = transformExpression(node.left.left, true, scope, pureVars)
    const modTarget = transformExpression(node.left.right, true, scope, pureVars)
    const modArg = transformExpression(node.right, false, scope, pureVars)
    const modCall = inheritComments(
      t.callExpression(
        t.memberExpression(modTarget, t.identifier(opMap['%'])),
        [modArg]
      ),
      node.left
    )
    return inheritComments(
      t.callExpression(
        t.memberExpression(leftExpr, t.identifier(opMap['*'])),
        [modCall]
      ),
      node
    )
  }

  if(t.isBinaryExpression(node) && opMap[node.operator]) {
    // Do not transform binary ops if left is Math.xxx
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
  if(t.isLogicalExpression(node)) {
    const left = transformExpression(node.left, true, scope, pureVars)
    const right = transformExpression(node.right, true, scope, pureVars)
    return t.logicalExpression(node.operator, left, right)
  }
  if (t.isAssignmentExpression(node)) {
    const { operator, left: L, right: R } = node
    // compound (+=, -=, *=, /=, %=)
    if (assignOpMap[operator]) {
      const method = assignOpMap[operator]
      const leftExpr = transformExpression(L, false, scope, pureVars)
      const rightExpr = transformExpression(R, true,  scope, pureVars)
      return inheritComments(
        t.callExpression(
          t.memberExpression(leftExpr, t.identifier(method)),
          [ rightExpr ]
        ),
        node
      )
    }
    // simple =
    const leftExpr  = transformExpression(L, false, scope, pureVars)
    const rightExpr = transformExpression(R, true,  scope, pureVars)
    return inheritComments(
      t.assignmentExpression('=', leftExpr, rightExpr),
      node
    )
  }

  if(t.isUnaryExpression(node) && node.operator==='-'){
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
  if(t.isParenthesizedExpression(node)) {
    const inner = transformExpression(node.expression, isLeftmost, scope, pureVars)
    return inheritComments(t.parenthesizedExpression(inner), node)
  }
  if(t.isConditionalExpression(node)){
    const newNode = t.conditionalExpression(
      transformExpression(node.test, false, scope, pureVars),
      transformExpression(node.consequent, true, scope, pureVars),
      transformExpression(node.alternate, true, scope, pureVars)
    )
    return inheritComments(newNode, node)
  }
  if(t.isCallExpression(node)){
    const newCallee = transformExpression(node.callee, false, scope, pureVars)
    const newArgs = node.arguments.map(arg => transformExpression(arg, false, scope, pureVars))
    return inheritComments(t.callExpression(newCallee, newArgs), node)
  }
  if(t.isMemberExpression(node)){
		if(t.isIdentifier(node.object, {name:'Math'}))
			return node
		const newObj = transformExpression(node.object, false, scope, pureVars)
		let newProp;
		if(node.computed){
			if(t.isNumericLiteral(node.property))
				newProp = node.property  // leave numeric literals untouched
			else
				newProp = transformExpression(node.property, true, scope, pureVars)
		} else {
			newProp = node.property
		}
		return inheritComments(t.memberExpression(newObj, newProp, node.computed), node)
	}
  if(t.isArrowFunctionExpression(node)){
    const newParams = node.params.map(param => {
      if(t.isAssignmentPattern(param))
        return t.assignmentPattern(param.left, transformExpression(param.right, true, scope, pureVars))
      if(t.isObjectPattern(param) || t.isArrayPattern(param))
        return transformPattern(param, scope, pureVars)
      return param
    })
    const newBody = transformBody(node.body, scope, pureVars)
    return inheritComments(t.arrowFunctionExpression(newParams, newBody, node.async), node)
  }
  if(t.isObjectExpression(node)){
    const newProps = node.properties.map(prop => {
      if(t.isObjectProperty(prop)) {
        const newKey = prop.computed ? transformExpression(prop.key, true, scope, pureVars) : prop.key
        const newValue = transformExpression(prop.value, true, scope, pureVars)
        return t.objectProperty(newKey, newValue, prop.computed, prop.shorthand)
      }
      return prop
    })
    return t.objectExpression(newProps)
  }
  if(t.isArrayExpression(node)){
    const newElements = node.elements.map(el => el ? transformExpression(el, true, scope, pureVars) : el)
    return t.arrayExpression(newElements)
  }
  if(t.isTemplateLiteral(node)){
    const newExpressions = node.expressions.map(exp => transformExpression(exp, false, scope, pureVars))
    return t.templateLiteral(node.quasis, newExpressions)
  }
  if(t.isAssignmentPattern(node))
    return t.assignmentPattern(node.left, transformExpression(node.right, true, scope, pureVars))
  if(isLeftmost && t.isNumericLiteral(node))
    return inheritComments(t.callExpression(t.identifier('float'), [node]), node)
  if(isLeftmost && t.isIdentifier(node) && node.name !== 'Math'){
    const binding = scope && scope.getBinding(node.name)
    if((binding && t.isVariableDeclarator(binding.path.node) && isPureNumeric(binding.path.node.init))
       || (pureVars && pureVars.has(node.name)))
      return inheritComments(t.callExpression(t.identifier('float'), [node]), node)
    return node
  }
  return node
}

const transformBody = (body, scope, pureVars = new Set()) => {
  if (t.isBlockStatement(body)) {
    const localPure = new Set(pureVars)
    body.body.forEach(stmt => {
      // handle nested if/else
      if (t.isIfStatement(stmt)) {
        // transform condition
        stmt.test = transformExpression(stmt.test, false, scope, localPure)
        // transform consequent block
        if (t.isBlockStatement(stmt.consequent)) {
          stmt.consequent = transformBody(stmt.consequent, scope, localPure)
        }
        // transform else / else-if
        if (stmt.alternate) {
          if (t.isBlockStatement(stmt.alternate)) {
            stmt.alternate = transformBody(stmt.alternate, scope, localPure)
          } else if (t.isIfStatement(stmt.alternate)) {
            // wrap the else-if to recurse
            const dummy = t.blockStatement([stmt.alternate])
            transformBody(dummy, scope, localPure)
            stmt.alternate = dummy.body[0]
          }
        }
      }
      else if (t.isVariableDeclaration(stmt)) {
        stmt.declarations.forEach(decl => {
          if (t.isObjectPattern(decl.id) || t.isArrayPattern(decl.id))
            decl.id = transformPattern(decl.id, scope, localPure)
          if (decl.init)
            decl.init = t.isArrowFunctionExpression(decl.init)
              ? transformExpression(decl.init, true, scope, localPure)
              : (isPureNumeric(decl.init)
                  ? decl.init
                  : transformExpression(decl.init, true, scope, localPure))
        })
      }
      else if (t.isReturnStatement(stmt) && stmt.argument)
        stmt.argument = isPureNumeric(stmt.argument)
          ? stmt.argument
          : transformExpression(stmt.argument, true, scope, localPure)
      else if (t.isExpressionStatement(stmt))
        stmt.expression = isPureNumeric(stmt.expression)
          ? stmt.expression
          : transformExpression(stmt.expression, true, scope, localPure)
      else if (t.isForStatement(stmt)) {
        if (stmt.init) stmt.init = transformExpression(stmt.init, true, scope, localPure)
        if (stmt.test) stmt.test = transformExpression(stmt.test, true, scope, localPure)
        if (stmt.update) stmt.update = transformExpression(stmt.update, true, scope, localPure)
      }
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
      if(!/\.(js|ts)x?$/.test(id) || id.includes('node_modules')) return null
      
      // Early return if no Fn() calls - don't parse/regenerate at all
      if(!code.includes('Fn(')) { return null }
      
      const filename = path.basename(id)
      const ast = parse(code, {sourceType: 'module', plugins: ['jsx']})
      
      let hasTransformations = false
      
      traverse(ast, {
        CallExpression(path) {
					if(t.isIdentifier(path.node.callee, {name: 'Fn'})) {
						const fnArgPath = path.get('arguments.0')
						if(fnArgPath && fnArgPath.isArrowFunctionExpression() && !fnArgPath.node._tslTransformed) {
							const originalBodyNode = t.cloneNode(fnArgPath.node.body, true)
							const originalBodyCode = generate(originalBodyNode, {retainLines: true}).code
							fnArgPath.node.body = transformBody(fnArgPath.node.body, fnArgPath.scope)
							const newBodyCode = generate(fnArgPath.node.body, {retainLines: true}).code
							// Normalize both versions to ignore formatting differences
							const normOrig = originalBodyCode.replace(/\s+/g, ' ').trim()
							const normNew = newBodyCode.replace(/\s+/g, ' ').trim()
							if(logs && normOrig !== normNew){
                hasTransformations = true
								const orig = originalBodyCode.split('\n')
								const nw = newBodyCode.split('\n')
								const diff = []
								for(let i = 0; i < Math.max(orig.length, nw.length); i++){
									const o = orig[i]?.trim() ?? ''
									const n = nw[i]?.trim() ?? ''
									if(o !== n)
										diff.push(`\x1b[31mBefore:\x1b[0m ${prettifyLine(o)}\n\x1b[32mAfter:\x1b[0m ${prettifyLine(n)}`)
								}
								if(diff.length)
									console.log(`\x1b[33m[tsl-operator-plugin]\x1b[0m ${filename}:\n` + diff.join('\n'))
							}
							fnArgPath.node._tslTransformed = true
						}
					}
				}
      })
      
      // Only regenerate if we actually made transformations
      if(!hasTransformations) { return null }
      
      const output = generate(ast, {retainLines: true}, code)
      const generatedCode = output.code.replace(/;(\n|$)/g, '$1').replace(/if\s*\(/g, 'if(')
      return {code: generatedCode, map: output.map}
    }
  }
}
