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

// Comparison operators for TSL
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

// Logical operators for TSL
const logicalOpMap = {
  '&&': 'and',
  '||': 'or'
}

// TSL functions that accept boolean/condition arguments
// These indicate a TSL context where comparison/logical operators should be transformed
// TSL functions that accept boolean/condition arguments
// These indicate a TSL context where comparison/logical operators should be transformed
// Map maps function name -> array of argument indices that are conditions
const tslContextMap = {
  'select': [0],      // select(condition, ifTrue, ifFalse)
  'If': [0],          // If(condition, callback)
  'ElseIf': [0],      // .ElseIf(condition, callback)
  'elseif': [0],      // .elseif(lower case variant)
  'discard': [0],     // discard(condition)
  'mix': [2],         // mix(a, b, condition) - when used as ternary
  // step/smoothstep typically take floats, not boolean nodes, so not included
}

// Regex to match directive comments: //@tsl, // @tsl, //@js, // @js
const directiveRegex = /\/\/\s*@(tsl|js)\b/i

/**
 * Parse directive comments from the source code and build a line-to-directive map.
 * @param {string} code - The source code
 * @returns {Map<number, string>} Map of line numbers to directive ('tsl' or 'js')
 */
const parseDirectives = code => {
  const directives = new Map()
  const lines = code.split('\n')
  lines.forEach((line, idx) => {
    const match = line.match(directiveRegex)
    if (match) {
      directives.set(idx + 1, match[1].toLowerCase()) // 1-indexed line numbers
    }
  })
  return directives
}

/**
 * Get the directive for a node based on its location.
 * Checks the node's line and the line above it.
 * @param {Object} node - The AST node
 * @param {Map<number, string>} directives - The directive map
 * @returns {string|null} 'tsl', 'js', or null
 */
const getDirectiveForNode = (node, directives) => {
  if (!node?.loc || !directives) return null
  const line = node.loc.start.line
  // Check same line first, then line above
  return directives.get(line) || directives.get(line - 1) || null
}

/**
 * Check if an expression contains TSL arithmetic operations.
 * This helps determine if a comparison/logical expression is in a TSL context.
 * @param {Object} node - The AST node to check
 * @returns {boolean} True if the expression contains TSL operations
 */
const containsTSLOperation = node => {
  if (!node) return false
  // Arithmetic binary operations are TSL
  if (t.isBinaryExpression(node) && opMap[node.operator]) {
    return !isPureNumeric(node)
  }
  // Assignment operations are TSL
  if (t.isAssignmentExpression(node) && assignOpMap[node.operator]) {
    return true
  }
  // Method calls on TSL nodes (e.g., a.add(b), a.mul(c))
  if (t.isCallExpression(node) && t.isMemberExpression(node.callee)) {
    const methodName = node.callee.property?.name
    const tslMethods = ['add', 'sub', 'mul', 'div', 'mod', 'greaterThan', 'lessThan',
                        'greaterThanEqual', 'lessThanEqual', 'equal', 'notEqual',
                        'and', 'or', 'not', 'toVar', 'toConst']
    if (tslMethods.includes(methodName)) return true
  }
  // float() or other TSL constructor calls
  if (t.isCallExpression(node) && t.isIdentifier(node.callee)) {
    const tslConstructors = ['float', 'int', 'vec2', 'vec3', 'vec4', 'mat3', 'mat4',
                             'color', 'uniform', 'attribute', 'varying', 'texture']
    if (tslConstructors.includes(node.callee.name)) return true
  }
  // Check recursively in binary expressions
  if (t.isBinaryExpression(node)) {
    return containsTSLOperation(node.left) || containsTSLOperation(node.right)
  }
  // Check in logical expressions
  if (t.isLogicalExpression(node)) {
    return containsTSLOperation(node.left) || containsTSLOperation(node.right)
  }
  // Check in unary expressions
  if (t.isUnaryExpression(node)) {
    return containsTSLOperation(node.argument)
  }
  // Check in parenthesized expressions
  if (t.isParenthesizedExpression(node)) {
    return containsTSLOperation(node.expression)
  }
  return false
}

/**
 * Check if a comparison/logical expression should be transformed to TSL.
 * Only transform when the expression is used in a TSL context:
 * - Contains TSL arithmetic operations
 * - Is an argument to a TSL boolean function (select, If, etc.)
 * - Is in a chain with other TSL expressions
 * @param {Object} node - The comparison/logical expression node
 * @returns {boolean} True if the expression should be transformed to TSL
 */
const shouldTransformToTSL = node => {
  // If any operand contains TSL operations, transform the whole expression
  if (t.isBinaryExpression(node) || t.isLogicalExpression(node)) {
    return containsTSLOperation(node.left) || containsTSLOperation(node.right)
  }
  if (t.isUnaryExpression(node)) {
    return containsTSLOperation(node.argument)
  }
  return false
}

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

/**
 * Transform an AST expression node by converting JS operators to TSL method calls.
 * @param {Object} node - The AST node to transform
 * @param {boolean} isLeftmost - Whether this node is the leftmost in an operator chain.
 *   When true, numeric literals are wrapped in float() to start a method chain.
 *   Example: `1 + a` with isLeftmost=true becomes `float(1).add(a)`
 *   Example: `a + 1` with isLeftmost=false on the `1` stays as `a.add(1)`
 * @param {Object} scope - Babel scope object for variable binding lookups
 * @param {Set} pureVars - Set of variable names known to be pure numeric values
 * @param {boolean|string} forceTSL - When true, comparison/logical operators are transformed
 *   even if operands don't contain TSL operations. Can also be 'tsl' or 'js' for directive override.
 * @param {Map} directives - Map of line numbers to directives ('tsl' or 'js')
 * @returns {Object} The transformed AST node
 */
const transformExpression = (node, isLeftmost = true, scope, pureVars = new Set(), forceTSL = false, directives = null) => {
  if(isFloatCall(node)) return node

  // Check for line-specific directive override
  const nodeDirective = getDirectiveForNode(node, directives)
  // Directive 'js' forces preservation, 'tsl' forces transformation
  // Node directive takes precedence over inherited forceTSL
  let effectiveForceTSL = forceTSL
  if (nodeDirective === 'js') effectiveForceTSL = false
  else if (nodeDirective === 'tsl') effectiveForceTSL = true

  /**
   * Special handling for modulo with multiplication: (x * y) % z
   * Due to JS operator precedence, `x * y % z` parses as `(x * y) % z`.
   * We need to transform this to `x.mul(y.mod(z))` to preserve correct TSL semantics.
   * The condition checks that x isn't already a % expression to avoid double-processing.
   */
  if (
    t.isBinaryExpression(node) &&
    node.operator === '%' &&
    t.isBinaryExpression(node.left) &&
    node.left.operator === '*' &&
    !(t.isBinaryExpression(node.left.left) && node.left.left.operator === '%')
  ) {
    // Don't transform pure numeric expressions
    if(isPureNumeric(node)) return node
    const leftExpr = transformExpression(node.left.left, true, scope, pureVars, effectiveForceTSL, directives)
    const modTarget = transformExpression(node.left.right, true, scope, pureVars, effectiveForceTSL, directives)
    const modArg = transformExpression(node.right, false, scope, pureVars, effectiveForceTSL, directives)
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
    // Don't transform pure numeric expressions
    if(isPureNumeric(node)) return node
    // Do not transform binary ops if left is Math.xxx
    if(t.isMemberExpression(node.left) && t.isIdentifier(node.left.object, {name: 'Math'}))
      return node
    const left = transformExpression(node.left, true, scope, pureVars, effectiveForceTSL, directives)
    const right = transformExpression(node.right, false, scope, pureVars, effectiveForceTSL, directives)
    return inheritComments(
      t.callExpression(
        t.memberExpression(left, t.identifier(opMap[node.operator])),
        [right]
      ),
      node
    )
  }
  // Handle comparison operators: >, <, >=, <=, ==, ===, !=, !==
  // Only transform when in TSL context (effectiveForceTSL or contains TSL operations)
  if(t.isBinaryExpression(node) && comparisonOpMap[node.operator]) {
    // Don't transform pure numeric comparisons
    if(isPureNumeric(node.left) && isPureNumeric(node.right)) return node
    // Only transform if forced or operands contain TSL operations
    if(!effectiveForceTSL && !shouldTransformToTSL(node)) {
      // Still recurse into operands to transform any nested TSL operations
      const left = transformExpression(node.left, true, scope, pureVars, effectiveForceTSL, directives)
      const right = transformExpression(node.right, false, scope, pureVars, effectiveForceTSL, directives)
      if(left === node.left && right === node.right) return node
      return inheritComments(t.binaryExpression(node.operator, left, right), node)
    }
    const left = transformExpression(node.left, true, scope, pureVars, effectiveForceTSL, directives)
    const right = transformExpression(node.right, false, scope, pureVars, effectiveForceTSL, directives)
    return inheritComments(
      t.callExpression(
        t.memberExpression(left, t.identifier(comparisonOpMap[node.operator])),
        [right]
      ),
      node
    )
  }
  // Handle logical operators: && -> .and(), || -> .or()
  // Only transform when in TSL context (effectiveForceTSL or contains TSL operations)
  if(t.isLogicalExpression(node) && logicalOpMap[node.operator]) {
    // Only transform if forced or operands contain TSL operations
    if(!effectiveForceTSL && !shouldTransformToTSL(node)) {
      // Still recurse into operands to transform any nested TSL operations
      const left = transformExpression(node.left, true, scope, pureVars, effectiveForceTSL, directives)
      const right = transformExpression(node.right, false, scope, pureVars, effectiveForceTSL, directives)
      if(left === node.left && right === node.right) return node
      return inheritComments(t.logicalExpression(node.operator, left, right), node)
    }
    const left = transformExpression(node.left, true, scope, pureVars, effectiveForceTSL, directives)
    const right = transformExpression(node.right, false, scope, pureVars, effectiveForceTSL, directives)
    return inheritComments(
      t.callExpression(
        t.memberExpression(left, t.identifier(logicalOpMap[node.operator])),
        [right]
      ),
      node
    )
  }
  // Handle nullish coalescing (??) - just transform operands, preserve operator
  if(t.isLogicalExpression(node)) {
    const left = transformExpression(node.left, true, scope, pureVars, effectiveForceTSL, directives)
    const right = transformExpression(node.right, true, scope, pureVars, effectiveForceTSL, directives)
    if(left === node.left && right === node.right) return node
    return t.logicalExpression(node.operator, left, right)
  }
  if (t.isAssignmentExpression(node)) {
    const { operator, left: L, right: R } = node
    // compound (+=, -=, *=, /=, %=)
    if (assignOpMap[operator]) {
      const method = assignOpMap[operator]
      const leftExpr = transformExpression(L, false, scope, pureVars, effectiveForceTSL, directives)
      const rightExpr = transformExpression(R, true,  scope, pureVars, effectiveForceTSL, directives)
      return inheritComments(
        t.callExpression(
          t.memberExpression(leftExpr, t.identifier(method)),
          [ rightExpr ]
        ),
        node
      )
    }
    // simple =
    const leftExpr  = transformExpression(L, false, scope, pureVars, effectiveForceTSL, directives)
    const rightExpr = transformExpression(R, true,  scope, pureVars, effectiveForceTSL, directives)
    if(leftExpr === L && rightExpr === R) return node
    return inheritComments(
      t.assignmentExpression('=', leftExpr, rightExpr),
      node
    )
  }

  if(t.isUnaryExpression(node) && node.operator==='-'){
    if(t.isNumericLiteral(node.argument)) {
      // Only wrap in float() when leftmost (starting an operation chain)
      if(isLeftmost)
        return inheritComments(
          t.callExpression(t.identifier('float'), [t.numericLiteral(-node.argument.value)]),
          node
        )
      return node
    }
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
    const arg = transformExpression(node.argument, true, scope, pureVars, effectiveForceTSL, directives)
    return inheritComments(
      t.callExpression(
        t.memberExpression(arg, t.identifier('mul')),
        [t.unaryExpression('-', t.numericLiteral(1))]
      ),
      node
    )
  }
  // Handle logical NOT: !a -> a.not()
  // Only transform when in TSL context (effectiveForceTSL or contains TSL operations)
  if(t.isUnaryExpression(node) && node.operator === '!') {
    // Only transform if forced or argument contains TSL operations
    if(!effectiveForceTSL && !shouldTransformToTSL(node)) {
      // Still recurse into argument to transform any nested TSL operations
      const arg = transformExpression(node.argument, true, scope, pureVars, effectiveForceTSL, directives)
      if(arg === node.argument) return node
      return inheritComments(t.unaryExpression('!', arg, node.prefix), node)
    }
    const arg = transformExpression(node.argument, true, scope, pureVars, effectiveForceTSL, directives)
    return inheritComments(
      t.callExpression(
        t.memberExpression(arg, t.identifier('not')),
        []
      ),
      node
    )
  }
  if(t.isParenthesizedExpression(node)) {
    const inner = transformExpression(node.expression, isLeftmost, scope, pureVars, effectiveForceTSL, directives)
    if(inner === node.expression) return node
    return inheritComments(t.parenthesizedExpression(inner), node)
  }
  if(t.isConditionalExpression(node)){
    const newTest = transformExpression(node.test, false, scope, pureVars, effectiveForceTSL, directives)
    const newConsequent = transformExpression(node.consequent, false, scope, pureVars, effectiveForceTSL, directives)
    const newAlternate = transformExpression(node.alternate, false, scope, pureVars, effectiveForceTSL, directives)
    if(newTest === node.test && newConsequent === node.consequent && newAlternate === node.alternate) return node
    return inheritComments(t.conditionalExpression(newTest, newConsequent, newAlternate), node)
  }
  if(t.isCallExpression(node)){
    const newCallee = transformExpression(node.callee, false, scope, pureVars, effectiveForceTSL, directives)
    
    // Determine if this is a TSL function that expects boolean args
    let contextIndices = null
    if (t.isIdentifier(node.callee)) {
      contextIndices = tslContextMap[node.callee.name]
    } else if (t.isMemberExpression(node.callee) && t.isIdentifier(node.callee.property)) {
      contextIndices = tslContextMap[node.callee.property.name]
    }

    const newArgs = node.arguments.map((arg, idx) => {
      // Force TSL for specific arguments based on the map (e.g. index 0 for If, index 2 for mix)
      const forceArg = contextIndices && contextIndices.includes(idx)
      return transformExpression(arg, false, scope, pureVars, forceArg || effectiveForceTSL, directives)
    })
    const hasChanges = newCallee !== node.callee || newArgs.some((arg, i) => arg !== node.arguments[i])
    if(!hasChanges) return node
    return inheritComments(t.callExpression(newCallee, newArgs), node)
  }
  if(t.isMemberExpression(node)){
		if(t.isIdentifier(node.object, {name:'Math'}))
			return node
		const newObj = transformExpression(node.object, false, scope, pureVars, effectiveForceTSL, directives)
		let newProp;
		if(node.computed){
			if(t.isNumericLiteral(node.property))
				newProp = node.property  // leave numeric literals untouched
			else
				newProp = transformExpression(node.property, true, scope, pureVars, effectiveForceTSL, directives)
		} else {
			newProp = node.property
		}
		if(newObj === node.object && newProp === node.property) return node
		return inheritComments(t.memberExpression(newObj, newProp, node.computed), node)
	}
  if(t.isArrowFunctionExpression(node)){
    const newParams = node.params.map(param => {
      if(t.isAssignmentPattern(param))
        return t.assignmentPattern(param.left, transformExpression(param.right, true, scope, pureVars, effectiveForceTSL, directives))
      if(t.isObjectPattern(param) || t.isArrayPattern(param))
        return transformPattern(param, scope, pureVars)
      return param
    })
    const newBody = transformBody(node.body, scope, pureVars, directives, effectiveForceTSL)
    return inheritComments(t.arrowFunctionExpression(newParams, newBody, node.async), node)
  }
  if(t.isObjectExpression(node)){
    let hasChanges = false
    const newProps = node.properties.map(prop => {
      if(t.isObjectProperty(prop)) {
        const newKey = prop.computed ? transformExpression(prop.key, false, scope, pureVars, effectiveForceTSL, directives) : prop.key
        const newValue = transformExpression(prop.value, false, scope, pureVars, effectiveForceTSL, directives)
        if(newKey !== prop.key || newValue !== prop.value) hasChanges = true
        if(!hasChanges) return prop
        return t.objectProperty(newKey, newValue, prop.computed, prop.shorthand)
      }
      return prop
    })
    if(!hasChanges) return node
    return t.objectExpression(newProps)
  }
  if(t.isArrayExpression(node)){
    const newElements = node.elements.map(el => el ? transformExpression(el, false, scope, pureVars, effectiveForceTSL, directives) : el)
    const hasChanges = newElements.some((el, i) => el !== node.elements[i])
    if(!hasChanges) return node
    return t.arrayExpression(newElements)
  }
  if(t.isTemplateLiteral(node)){
    const newExpressions = node.expressions.map(exp => transformExpression(exp, false, scope, pureVars, effectiveForceTSL, directives))
    const hasChanges = newExpressions.some((exp, i) => exp !== node.expressions[i])
    if(!hasChanges) return node
    return t.templateLiteral(node.quasis, newExpressions)
  }
  if(t.isAssignmentPattern(node)) {
    const newRight = transformExpression(node.right, true, scope, pureVars, effectiveForceTSL, directives)
    if(newRight === node.right) return node
    return t.assignmentPattern(node.left, newRight)
  }
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

/**
 * Transform a function body (block or expression) by processing all statements.
 * @param {Object} body - The function body AST node (BlockStatement or expression)
 * @param {Object} scope - Babel scope object for variable binding lookups
 * @param {Set} pureVars - Set of variable names known to be pure numeric values.
 *   This is used to track variables declared with pure numeric initializers
 *   (e.g., `const x = 5`) so that `-x` can be properly transformed to `float(x).mul(-1)`.
 * @param {Map} directives - Map of line numbers to directives ('tsl' or 'js')
 * @param {boolean} fnForceTSL - Whether the entire Fn() is forced to TSL mode (via directive on Fn line)
 * @returns {Object} The transformed body AST node
 */
const transformBody = (body, scope, pureVars = new Set(), directives = null, fnForceTSL = false) => {
  if (t.isBlockStatement(body)) {
    const localPure = new Set(pureVars)
    body.body.forEach(stmt => {
      // Check for statement-level directive
      const stmtDirective = getDirectiveForNode(stmt, directives)
      let stmtForceTSL = fnForceTSL
      if (stmtDirective === 'js') stmtForceTSL = false
      else if (stmtDirective === 'tsl') stmtForceTSL = true

      // handle nested if/else
      if (t.isIfStatement(stmt)) {
        // transform condition (preserve JS behavior for if conditions unless forced)
        stmt.test = transformExpression(stmt.test, false, scope, localPure, stmtForceTSL, directives)
        // transform consequent block
        if (t.isBlockStatement(stmt.consequent)) {
          stmt.consequent = transformBody(stmt.consequent, scope, localPure, directives, fnForceTSL)
        }
        // transform else / else-if
        if (stmt.alternate) {
          if (t.isBlockStatement(stmt.alternate)) {
            stmt.alternate = transformBody(stmt.alternate, scope, localPure, directives, fnForceTSL)
          } else if (t.isIfStatement(stmt.alternate)) {
            // wrap the else-if to recurse
            const dummy = t.blockStatement([stmt.alternate])
            transformBody(dummy, scope, localPure, directives, fnForceTSL)
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
              ? transformExpression(decl.init, true, scope, localPure, stmtForceTSL, directives)
              : (isPureNumeric(decl.init)
                  ? decl.init
                  : transformExpression(decl.init, true, scope, localPure, stmtForceTSL, directives))
        })
      }
      else if (t.isReturnStatement(stmt) && stmt.argument)
        // Return statements get forceTSL=true since they return TSL values from Fn()
        stmt.argument = isPureNumeric(stmt.argument)
          ? stmt.argument
          : transformExpression(stmt.argument, true, scope, localPure, true, directives)
      else if (t.isExpressionStatement(stmt))
        stmt.expression = isPureNumeric(stmt.expression)
          ? stmt.expression
          : transformExpression(stmt.expression, true, scope, localPure, stmtForceTSL, directives)
      else if (t.isForStatement(stmt)) {
        if (stmt.init) stmt.init = transformExpression(stmt.init, true, scope, localPure, stmtForceTSL, directives)
        if (stmt.test) stmt.test = transformExpression(stmt.test, true, scope, localPure, stmtForceTSL, directives)
        if (stmt.update) stmt.update = transformExpression(stmt.update, true, scope, localPure, stmtForceTSL, directives)
        if (t.isBlockStatement(stmt.body)) {
          stmt.body = transformBody(stmt.body, scope, localPure, directives, fnForceTSL)
        }
      }
      else if (t.isWhileStatement(stmt)) {
        if (stmt.test) stmt.test = transformExpression(stmt.test, true, scope, localPure, stmtForceTSL, directives)
        if (t.isBlockStatement(stmt.body)) {
          stmt.body = transformBody(stmt.body, scope, localPure, directives, fnForceTSL)
        }
      }
      else if (t.isDoWhileStatement(stmt)) {
        if (stmt.test) stmt.test = transformExpression(stmt.test, true, scope, localPure, stmtForceTSL, directives)
        if (t.isBlockStatement(stmt.body)) {
          stmt.body = transformBody(stmt.body, scope, localPure, directives, fnForceTSL)
        }
      }
    })
    return body
  }
  // Expression body (no block) is implicitly returned, so force TSL transformation
  return isPureNumeric(body)
    ? body
    : transformExpression(body, true, scope, pureVars, true, directives)
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

      // Parse directive comments from source code
      const directives = parseDirectives(code)

      let hasTransformations = false

      traverse(ast, {
        CallExpression(path) {
					if(t.isIdentifier(path.node.callee, {name: 'Fn'})) {
						const fnArgPath = path.get('arguments.0')
						if(fnArgPath && fnArgPath.isArrowFunctionExpression() && !fnArgPath.node._tslTransformed) {
							// Check for Fn-level directive (on same line or above Fn())
							const fnLine = path.node.loc?.start?.line
							let fnForceTSL = false
							if (fnLine && directives.size > 0) {
								const fnDirective = directives.get(fnLine) || directives.get(fnLine - 1)
								if (fnDirective === 'tsl') fnForceTSL = true
								// Note: //@js on Fn line doesn't make sense (would disable all transformation)
								// so we only check for @tsl to force all comparisons/logicals
							}

							const originalBodyNode = t.cloneNode(fnArgPath.node.body, true)
							const originalBodyCode = generate(originalBodyNode, {retainLines: true}).code
							fnArgPath.node.body = transformBody(fnArgPath.node.body, fnArgPath.scope, new Set(), directives, fnForceTSL)
							const newBodyCode = generate(fnArgPath.node.body, {retainLines: true}).code
							// Normalize both versions to ignore formatting differences
							const normOrig = originalBodyCode.replace(/\s+/g, ' ').trim()
							const normNew = newBodyCode.replace(/\s+/g, ' ').trim()
              if(normOrig !== normNew){
                hasTransformations = true
              }
              if(logs && normOrig !== normNew){
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
      return {code: output.code, map: output.map}
    }
  }
}
