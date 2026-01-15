import {createRequire} from 'module'
import path from 'path'
const require = createRequire(import.meta.url)

const {parse} = require('@babel/parser')
const traverse = require('@babel/traverse').default
const generate = require('@babel/generator').default

import * as t from '@babel/types'

const opMap = { '+': 'add', '-': 'sub', '*': 'mul', '/': 'div', '%': 'mod' }
const assignOpMap = Object.fromEntries(
  Object.entries(opMap).map(([op, fn]) => [`${op}=`, `${fn}Assign`])
)

const comparisonOpMap = {
  '>': 'greaterThan',
  '<': 'lessThan',
  '>=': 'greaterThanEqual',
  '<=': 'lessThanEqual',
  '==': 'equal',
  '===': 'equal',
  '!=': 'notEqual',
  '!==': 'notEqual'
}

const logicalOpMap = {
  '&&': 'and',
  '||': 'or'
}

const tslContextMap = {
  select: [0],
  If: [0],
  ElseIf: [0],
  elseif: [0],
  discard: [0],
  mix: [2]
}

const directiveRegex = /\/\/\s*@(tsl|js)\b/i

const parseDirectives = code => {
  const directives = new Map()
  const lines = code.split('\n')
  lines.forEach((line, idx) => {
    const match = line.match(directiveRegex)
    if (match) directives.set(idx + 1, match[1].toLowerCase())
  })
  return directives
}

const getDirectiveForNode = (node, directives) => {
  if (!node?.loc || !directives) return null
  const line = node.loc.start.line
  return directives.get(line) || directives.get(line - 1) || null
}

const prettifyLine = line =>
  line.replace(/\(\s*/g, '( ').replace(/\s*\)/g, ' )')

const isPureNumeric = node => {
  if(t.isNumericLiteral(node)) return true
  if(t.isBinaryExpression(node) && opMap[node.operator])
    return isPureNumeric(node.left) && isPureNumeric(node.right)
  if(t.isUnaryExpression(node) && node.operator === '-')
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

const markChanged = state => {
  if (state) state.changed = true
}

const containsTSLOperation = node => {
  if (!node) return false
  if (t.isBinaryExpression(node) && opMap[node.operator]) {
    return !isPureNumeric(node)
  }
  if (t.isAssignmentExpression(node) && assignOpMap[node.operator]) {
    return true
  }
  if (t.isCallExpression(node) && t.isMemberExpression(node.callee)) {
    const methodName = node.callee.property?.name
    const tslMethods = ['add', 'sub', 'mul', 'div', 'mod', 'greaterThan', 'lessThan',
      'greaterThanEqual', 'lessThanEqual', 'equal', 'notEqual',
      'and', 'or', 'not', 'toVar', 'toConst']
    if (tslMethods.includes(methodName)) return true
  }
  if (t.isCallExpression(node) && t.isIdentifier(node.callee)) {
    const tslConstructors = ['float', 'int', 'vec2', 'vec3', 'vec4', 'mat3', 'mat4',
      'color', 'uniform', 'attribute', 'varying', 'texture']
    if (tslConstructors.includes(node.callee.name)) return true
  }
  if (t.isBinaryExpression(node)) {
    return containsTSLOperation(node.left) || containsTSLOperation(node.right)
  }
  if (t.isLogicalExpression(node)) {
    return containsTSLOperation(node.left) || containsTSLOperation(node.right)
  }
  if (t.isUnaryExpression(node)) {
    return containsTSLOperation(node.argument)
  }
  if (t.isParenthesizedExpression(node)) {
    return containsTSLOperation(node.expression)
  }
  return false
}

const shouldTransformToTSL = node => {
  if (t.isBinaryExpression(node) || t.isLogicalExpression(node)) {
    return containsTSLOperation(node.left) || containsTSLOperation(node.right)
  }
  if (t.isUnaryExpression(node)) {
    return containsTSLOperation(node.argument)
  }
  return false
}

const transformPattern = (node, scope, pureVars, state, forceTSL = false, directives = null) => {
  if(t.isAssignmentPattern(node)) {
    const right = transformExpression(node.right, true, scope, pureVars, forceTSL, directives, state)
    if (right === node.right) return node
    markChanged(state)
    return t.assignmentPattern(node.left, right)
  }
  if(t.isObjectPattern(node)) {
    let hasChanges = false
    const newProps = node.properties.map(prop => {
      if(t.isObjectProperty(prop)) {
        const newKey = prop.computed
          ? transformExpression(prop.key, true, scope, pureVars, forceTSL, directives, state)
          : prop.key
        const newValue = transformPattern(prop.value, scope, pureVars, state, forceTSL, directives)
        if (newKey !== prop.key || newValue !== prop.value) hasChanges = true
        if (!hasChanges) return prop
        return t.objectProperty(newKey, newValue, prop.computed, prop.shorthand)
      }
      if(t.isRestElement(prop)) {
        const newArg = transformPattern(prop.argument, scope, pureVars, state, forceTSL, directives)
        if (newArg !== prop.argument) hasChanges = true
        if (!hasChanges) return prop
        return t.restElement(newArg)
      }
      return prop
    })
    if(!hasChanges) return node
    markChanged(state)
    return t.objectPattern(newProps)
  }
  if(t.isArrayPattern(node)) {
    const newElements = node.elements.map(el => el ? transformPattern(el, scope, pureVars, state, forceTSL, directives) : el)
    const hasChanges = newElements.some((el, i) => el !== node.elements[i])
    if(!hasChanges) return node
    markChanged(state)
    return t.arrayPattern(newElements)
  }
  return node
}

const transformExpression = (
  node,
  isLeftmost = true,
  scope,
  pureVars = new Set(),
  forceTSL = false,
  directives = null,
  state = null
) => {
  if(isFloatCall(node)) return node

  const nodeDirective = getDirectiveForNode(node, directives)
  let effectiveForceTSL = forceTSL
  if (nodeDirective === 'js') effectiveForceTSL = false
  else if (nodeDirective === 'tsl') effectiveForceTSL = true

  if (
    t.isBinaryExpression(node) &&
    node.operator === '%' &&
    t.isBinaryExpression(node.left) &&
    node.left.operator === '*' &&
    !(t.isBinaryExpression(node.left.left) && node.left.left.operator === '%')
  ) {
    if(isPureNumeric(node)) return node
    const leftExpr = transformExpression(node.left.left, true, scope, pureVars, effectiveForceTSL, directives, state)
    const modTarget = transformExpression(node.left.right, true, scope, pureVars, effectiveForceTSL, directives, state)
    const modArg = transformExpression(node.right, false, scope, pureVars, effectiveForceTSL, directives, state)
    const modCall = inheritComments(
      t.callExpression(
        t.memberExpression(modTarget, t.identifier(opMap['%'])),
        [modArg]
      ),
      node.left
    )
    markChanged(state)
    return inheritComments(
      t.callExpression(
        t.memberExpression(leftExpr, t.identifier(opMap['*'])),
        [modCall]
      ),
      node
    )
  }

  if(t.isBinaryExpression(node) && opMap[node.operator]) {
    if(isPureNumeric(node)) return node
    if(t.isMemberExpression(node.left) && t.isIdentifier(node.left.object, {name: 'Math'}))
      return node
    const left = transformExpression(node.left, true, scope, pureVars, effectiveForceTSL, directives, state)
    const right = transformExpression(node.right, false, scope, pureVars, effectiveForceTSL, directives, state)
    markChanged(state)
    return inheritComments(
      t.callExpression(
        t.memberExpression(left, t.identifier(opMap[node.operator])),
        [right]
      ),
      node
    )
  }

  if(t.isBinaryExpression(node) && comparisonOpMap[node.operator]) {
    if(isPureNumeric(node.left) && isPureNumeric(node.right)) return node
    if(!effectiveForceTSL && !shouldTransformToTSL(node)) {
      const left = transformExpression(node.left, true, scope, pureVars, effectiveForceTSL, directives, state)
      const right = transformExpression(node.right, false, scope, pureVars, effectiveForceTSL, directives, state)
      if(left === node.left && right === node.right) return node
      return inheritComments(t.binaryExpression(node.operator, left, right), node)
    }
    const left = transformExpression(node.left, true, scope, pureVars, effectiveForceTSL, directives, state)
    const right = transformExpression(node.right, false, scope, pureVars, effectiveForceTSL, directives, state)
    markChanged(state)
    return inheritComments(
      t.callExpression(
        t.memberExpression(left, t.identifier(comparisonOpMap[node.operator])),
        [right]
      ),
      node
    )
  }

  if(t.isLogicalExpression(node) && logicalOpMap[node.operator]) {
    if(!effectiveForceTSL && !shouldTransformToTSL(node)) {
      const left = transformExpression(node.left, true, scope, pureVars, effectiveForceTSL, directives, state)
      const right = transformExpression(node.right, false, scope, pureVars, effectiveForceTSL, directives, state)
      if(left === node.left && right === node.right) return node
      return inheritComments(t.logicalExpression(node.operator, left, right), node)
    }
    const left = transformExpression(node.left, true, scope, pureVars, effectiveForceTSL, directives, state)
    const right = transformExpression(node.right, false, scope, pureVars, effectiveForceTSL, directives, state)
    markChanged(state)
    return inheritComments(
      t.callExpression(
        t.memberExpression(left, t.identifier(logicalOpMap[node.operator])),
        [right]
      ),
      node
    )
  }

  if(t.isLogicalExpression(node)) {
    const left = transformExpression(node.left, true, scope, pureVars, effectiveForceTSL, directives, state)
    const right = transformExpression(node.right, true, scope, pureVars, effectiveForceTSL, directives, state)
    if(left === node.left && right === node.right) return node
    markChanged(state)
    return t.logicalExpression(node.operator, left, right)
  }

  if (t.isAssignmentExpression(node)) {
    const { operator, left: L, right: R } = node
    if (assignOpMap[operator]) {
      const method = assignOpMap[operator]
      const leftExpr = transformExpression(L, false, scope, pureVars, effectiveForceTSL, directives, state)
      const rightExpr = transformExpression(R, true,  scope, pureVars, effectiveForceTSL, directives, state)
      markChanged(state)
      return inheritComments(
        t.callExpression(
          t.memberExpression(leftExpr, t.identifier(method)),
          [ rightExpr ]
        ),
        node
      )
    }
    const leftExpr  = transformExpression(L, false, scope, pureVars, effectiveForceTSL, directives, state)
    const rightExpr = transformExpression(R, true,  scope, pureVars, effectiveForceTSL, directives, state)
    if(leftExpr === L && rightExpr === R) return node
    markChanged(state)
    return inheritComments(
      t.assignmentExpression('=', leftExpr, rightExpr),
      node
    )
  }

  if(t.isUnaryExpression(node) && node.operator === '-'){
    if(t.isNumericLiteral(node.argument)) {
      if(isLeftmost) {
        markChanged(state)
        return inheritComments(
          t.callExpression(t.identifier('float'), [t.numericLiteral(-node.argument.value)]),
          node
        )
      }
      return node
    }
    if(t.isIdentifier(node.argument)){
      const binding = scope && scope.getBinding(node.argument.name)
      const isPure = (binding && t.isVariableDeclarator(binding.path.node) && isPureNumeric(binding.path.node.init))
        || (pureVars && pureVars.has(node.argument.name))
      if(isPure){
        const newArg = t.callExpression(t.identifier('float'), [node.argument])
        markChanged(state)
        return inheritComments(
          t.callExpression(
            t.memberExpression(newArg, t.identifier('mul')),
            [t.unaryExpression('-', t.numericLiteral(1))]
          ),
          node
        )
      }
    }
    const arg = transformExpression(node.argument, true, scope, pureVars, effectiveForceTSL, directives, state)
    markChanged(state)
    return inheritComments(
      t.callExpression(
        t.memberExpression(arg, t.identifier('mul')),
        [t.unaryExpression('-', t.numericLiteral(1))]
      ),
      node
    )
  }

  if(t.isUnaryExpression(node) && node.operator === '!') {
    if(!effectiveForceTSL && !shouldTransformToTSL(node)) {
      const arg = transformExpression(node.argument, true, scope, pureVars, effectiveForceTSL, directives, state)
      if(arg === node.argument) return node
      markChanged(state)
      return inheritComments(t.unaryExpression('!', arg, node.prefix), node)
    }
    const arg = transformExpression(node.argument, true, scope, pureVars, effectiveForceTSL, directives, state)
    markChanged(state)
    return inheritComments(
      t.callExpression(
        t.memberExpression(arg, t.identifier('not')),
        []
      ),
      node
    )
  }

  if(t.isParenthesizedExpression(node)) {
    const inner = transformExpression(node.expression, isLeftmost, scope, pureVars, effectiveForceTSL, directives, state)
    if(inner === node.expression) return node
    markChanged(state)
    return inheritComments(t.parenthesizedExpression(inner), node)
  }

  if(t.isConditionalExpression(node)){
    const newTest = transformExpression(node.test, false, scope, pureVars, effectiveForceTSL, directives, state)
    const newConsequent = transformExpression(node.consequent, false, scope, pureVars, effectiveForceTSL, directives, state)
    const newAlternate = transformExpression(node.alternate, false, scope, pureVars, effectiveForceTSL, directives, state)
    if(newTest === node.test && newConsequent === node.consequent && newAlternate === node.alternate) return node
    markChanged(state)
    return inheritComments(t.conditionalExpression(newTest, newConsequent, newAlternate), node)
  }

  if(t.isCallExpression(node)){
    const newCallee = transformExpression(node.callee, false, scope, pureVars, effectiveForceTSL, directives, state)
    let contextIndices = null
    if (t.isIdentifier(node.callee)) {
      contextIndices = tslContextMap[node.callee.name]
    } else if (t.isMemberExpression(node.callee) && t.isIdentifier(node.callee.property)) {
      contextIndices = tslContextMap[node.callee.property.name]
    }

    const newArgs = node.arguments.map((arg, idx) => {
      const forceArg = contextIndices && contextIndices.includes(idx)
      return transformExpression(arg, false, scope, pureVars, forceArg || effectiveForceTSL, directives, state)
    })
    const hasChanges = newCallee !== node.callee || newArgs.some((arg, i) => arg !== node.arguments[i])
    if(!hasChanges) return node
    markChanged(state)
    return inheritComments(t.callExpression(newCallee, newArgs), node)
  }

  if(t.isMemberExpression(node)){
    if(t.isIdentifier(node.object, {name:'Math'}))
      return node
    const newObj = transformExpression(node.object, false, scope, pureVars, effectiveForceTSL, directives, state)
    let newProp
    if(node.computed){
      if(t.isNumericLiteral(node.property))
        newProp = node.property
      else
        newProp = transformExpression(node.property, true, scope, pureVars, effectiveForceTSL, directives, state)
    } else {
      newProp = node.property
    }
    if(newObj === node.object && newProp === node.property) return node
    markChanged(state)
    return inheritComments(t.memberExpression(newObj, newProp, node.computed), node)
  }

  if(t.isArrowFunctionExpression(node)){
    const newParams = node.params.map(param => {
      if(t.isAssignmentPattern(param))
        return t.assignmentPattern(param.left, transformExpression(param.right, true, scope, pureVars, effectiveForceTSL, directives, state))
      if(t.isObjectPattern(param) || t.isArrayPattern(param))
        return transformPattern(param, scope, pureVars, state, effectiveForceTSL, directives)
      return param
    })
    const newBody = transformBody(node.body, scope, pureVars, directives, effectiveForceTSL, state)
    const paramChanged = newParams.some((p, i) => p !== node.params[i])
    if(!paramChanged && newBody === node.body) return node
    markChanged(state)
    return inheritComments(t.arrowFunctionExpression(newParams, newBody, node.async), node)
  }

  if(t.isObjectExpression(node)){
    let hasChanges = false
    const newProps = node.properties.map(prop => {
      if(t.isObjectProperty(prop)) {
        const newKey = prop.computed
          ? transformExpression(prop.key, false, scope, pureVars, effectiveForceTSL, directives, state)
          : prop.key
        const newValue = transformExpression(prop.value, false, scope, pureVars, effectiveForceTSL, directives, state)
        if(newKey !== prop.key || newValue !== prop.value) hasChanges = true
        if(!hasChanges) return prop
        return t.objectProperty(newKey, newValue, prop.computed, prop.shorthand)
      }
      return prop
    })
    if(!hasChanges) return node
    markChanged(state)
    return t.objectExpression(newProps)
  }

  if(t.isArrayExpression(node)){
    const newElements = node.elements.map(el => el ? transformExpression(el, false, scope, pureVars, effectiveForceTSL, directives, state) : el)
    const hasChanges = newElements.some((el, i) => el !== node.elements[i])
    if(!hasChanges) return node
    markChanged(state)
    return t.arrayExpression(newElements)
  }

  if(t.isTemplateLiteral(node)){
    const newExpressions = node.expressions.map(exp => transformExpression(exp, false, scope, pureVars, effectiveForceTSL, directives, state))
    const hasChanges = newExpressions.some((exp, i) => exp !== node.expressions[i])
    if(!hasChanges) return node
    markChanged(state)
    return t.templateLiteral(node.quasis, newExpressions)
  }

  if(t.isAssignmentPattern(node)) {
    const newRight = transformExpression(node.right, true, scope, pureVars, effectiveForceTSL, directives, state)
    if(newRight === node.right) return node
    markChanged(state)
    return t.assignmentPattern(node.left, newRight)
  }

  if(isLeftmost && t.isNumericLiteral(node)) {
    markChanged(state)
    return inheritComments(t.callExpression(t.identifier('float'), [node]), node)
  }
  if(isLeftmost && t.isIdentifier(node) && node.name !== 'Math'){
    const binding = scope && scope.getBinding(node.name)
    if((binding && t.isVariableDeclarator(binding.path.node) && isPureNumeric(binding.path.node.init))
       || (pureVars && pureVars.has(node.name))) {
      markChanged(state)
      return inheritComments(t.callExpression(t.identifier('float'), [node]), node)
    }
    return node
  }
  return node
}

const transformBody = (body, scope, pureVars = new Set(), directives = null, fnForceTSL = false, state = null) => {
  if (t.isBlockStatement(body)) {
    const localPure = new Set(pureVars)
    body.body.forEach(stmt => {
      const stmtDirective = getDirectiveForNode(stmt, directives)
      let stmtForceTSL = fnForceTSL
      if (stmtDirective === 'js') stmtForceTSL = false
      else if (stmtDirective === 'tsl') stmtForceTSL = true

      if (t.isIfStatement(stmt)) {
        stmt.test = transformExpression(stmt.test, false, scope, localPure, stmtForceTSL, directives, state)
        if (t.isBlockStatement(stmt.consequent)) {
          stmt.consequent = transformBody(stmt.consequent, scope, localPure, directives, fnForceTSL, state)
        }
        if (stmt.alternate) {
          if (t.isBlockStatement(stmt.alternate)) {
            stmt.alternate = transformBody(stmt.alternate, scope, localPure, directives, fnForceTSL, state)
          } else if (t.isIfStatement(stmt.alternate)) {
            const dummy = t.blockStatement([stmt.alternate])
            transformBody(dummy, scope, localPure, directives, fnForceTSL, state)
            stmt.alternate = dummy.body[0]
          }
        }
      }
      else if (t.isVariableDeclaration(stmt)) {
        stmt.declarations.forEach(decl => {
          if (t.isObjectPattern(decl.id) || t.isArrayPattern(decl.id))
            decl.id = transformPattern(decl.id, scope, localPure, state, stmtForceTSL, directives)
          if (decl.init)
            decl.init = t.isArrowFunctionExpression(decl.init)
              ? transformExpression(decl.init, true, scope, localPure, stmtForceTSL, directives, state)
              : (isPureNumeric(decl.init)
                  ? decl.init
                  : transformExpression(decl.init, true, scope, localPure, stmtForceTSL, directives, state))
        })
      }
      else if (t.isReturnStatement(stmt) && stmt.argument)
        stmt.argument = isPureNumeric(stmt.argument)
          ? stmt.argument
          : transformExpression(stmt.argument, true, scope, localPure, true, directives, state)
      else if (t.isExpressionStatement(stmt))
        stmt.expression = isPureNumeric(stmt.expression)
          ? stmt.expression
          : transformExpression(stmt.expression, true, scope, localPure, stmtForceTSL, directives, state)
      else if (t.isForStatement(stmt)) {
        if (stmt.init) stmt.init = transformExpression(stmt.init, true, scope, localPure, stmtForceTSL, directives, state)
        if (stmt.test) stmt.test = transformExpression(stmt.test, true, scope, localPure, stmtForceTSL, directives, state)
        if (stmt.update) stmt.update = transformExpression(stmt.update, true, scope, localPure, stmtForceTSL, directives, state)
        if (t.isBlockStatement(stmt.body)) {
          stmt.body = transformBody(stmt.body, scope, localPure, directives, fnForceTSL, state)
        }
      }
      else if (t.isWhileStatement(stmt)) {
        if (stmt.test) stmt.test = transformExpression(stmt.test, true, scope, localPure, stmtForceTSL, directives, state)
        if (t.isBlockStatement(stmt.body)) {
          stmt.body = transformBody(stmt.body, scope, localPure, directives, fnForceTSL, state)
        }
      }
      else if (t.isDoWhileStatement(stmt)) {
        if (stmt.test) stmt.test = transformExpression(stmt.test, true, scope, localPure, stmtForceTSL, directives, state)
        if (t.isBlockStatement(stmt.body)) {
          stmt.body = transformBody(stmt.body, scope, localPure, directives, fnForceTSL, state)
        }
      }
      else if (t.isSwitchStatement(stmt)) {
        if (stmt.discriminant) {
          stmt.discriminant = transformExpression(stmt.discriminant, true, scope, localPure, stmtForceTSL, directives, state)
        }
        if (stmt.cases) {
          stmt.cases.forEach(switchCase => {
            if (switchCase.test) {
              switchCase.test = transformExpression(switchCase.test, true, scope, localPure, stmtForceTSL, directives, state)
            }
            if (switchCase.consequent && switchCase.consequent.length > 0) {
              const dummy = t.blockStatement(switchCase.consequent)
              transformBody(dummy, scope, localPure, directives, fnForceTSL, state)
              switchCase.consequent = dummy.body
            }
          })
        }
      }
    })
    return body
  }
  return isPureNumeric(body)
    ? body
    : transformExpression(body, true, scope, pureVars, true, directives, state)
}

function shouldLog(logs, filename) {
  if (logs === true) return true
  if (logs === false || logs == null) return false
  if (typeof logs === 'string') return filename === logs
  if (Array.isArray(logs)) return logs.includes(filename)
  if (logs instanceof RegExp) return logs.test(filename)
  return false
}

const defaultParserPlugins = [
  'jsx',
  'typescript',
  'classProperties',
  'decorators-legacy',
  'importMeta',
  'topLevelAwait'
]

export default function TSLOperatorPlugin({logs = true} = {}) {
  return {
    name: 'tsl-operator-plugin',
    transform(code, id) {
      if(!/\.(js|ts)x?$/.test(id) || id.includes('node_modules')) return null
      if(!code.includes('Fn(')) return null

      const filename = path.basename(id)
      const ast = parse(code, {sourceType: 'module', plugins: defaultParserPlugins})
      const directives = parseDirectives(code)

      let hasTransformations = false

      traverse(ast, {
        CallExpression(path) {
          if(!t.isIdentifier(path.node.callee, {name: 'Fn'})) return
          const fnArgPath = path.get('arguments.0')
          if(!fnArgPath || !fnArgPath.isArrowFunctionExpression() || fnArgPath.node._tslTransformed) return

          const fnLine = path.node.loc?.start?.line
          let fnForceTSL = false
          if (fnLine && directives.size > 0) {
            const fnDirective = directives.get(fnLine) || directives.get(fnLine - 1)
            if (fnDirective === 'tsl') fnForceTSL = true
          }

          const logThisFile = shouldLog(logs, filename)
          const state = {changed: false}
          let originalBodyCode = null

          if (logThisFile) {
            const originalBodyNode = t.cloneNode(fnArgPath.node.body, true)
            originalBodyCode = generate(originalBodyNode, {retainLines: true}).code
          }

          fnArgPath.node.body = transformBody(fnArgPath.node.body, fnArgPath.scope, new Set(), directives, fnForceTSL, state)
          if(state.changed) hasTransformations = true

          if(logThisFile && state.changed) {
            const newBodyCode = generate(fnArgPath.node.body, {retainLines: true}).code
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
      })

      if(!hasTransformations) return null

      const output = generate(ast, {retainLines: true}, code)
      return {code: output.code, map: output.map}
    }
  }
}
