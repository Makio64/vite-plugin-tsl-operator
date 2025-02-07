import { createRequire } from 'module'
import path from 'path'
const require = createRequire(import.meta.url)

const { parse } = require('@babel/parser')
const traverse = require('@babel/traverse').default
const generate = require('@babel/generator').default
import * as t from '@babel/types'

const opMap = { '+': 'add', '-': 'sub', '*': 'mul', '/': 'div' }
const precedence = { '*': 14, '/': 14, '+': 13, '-': 13 }

// Returns true if the expression is made up solely of numeric literals
// (possibly with unary + or - and parentheses).
const isPureNumericExpression = node => {
	if (t.isNumericLiteral(node)) return true
	if (t.isUnaryExpression(node) && ['-', '+'].includes(node.operator)) {
		return isPureNumericExpression(node.argument)
	}
	if (t.isBinaryExpression(node)) {
		return isPureNumericExpression(node.left) && isPureNumericExpression(node.right)
	}
	if (node.type === 'ParenthesizedExpression') {
		return isPureNumericExpression(node.expression)
	}
	return false
}

const flattenBinary = (node, parentPrec = 0, ops = [], operands = []) => {
	if (t.isBinaryExpression(node) && opMap[node.operator]) {
		const nodePrec = precedence[node.operator]
		if (parentPrec > 0 && nodePrec > parentPrec) {
			operands.push(t.parenthesizedExpression(node))
			return { ops, operands }
		}
		flattenBinary(node.left, nodePrec, ops, operands)
		ops.push(node.operator)
		flattenBinary(node.right, nodePrec, ops, operands)
	} else if (node.type === 'ParenthesizedExpression') {
		operands.push(node)
	} else {
		operands.push(node)
	}
	return { ops, operands }
}

const isNumericLiteral = node =>
	t.isNumericLiteral(node) ||
	(node.type === 'Literal' && typeof node.value === 'number')

const getLeftMostOperand = node => {
	while (t.isBinaryExpression(node) && opMap[node.operator])
		node = node.left
	return node
}

const transformBin = node => {
	// If the entire expression is purely numeric, leave it untransformed.
	if (isPureNumericExpression(node)) return node

	const { ops, operands } = flattenBinary(node, 0)
	let base = operands[0]
	if (base.type === 'ParenthesizedExpression') {
		if (t.isBinaryExpression(base.expression) && opMap[base.expression.operator]) {
			const leftMost = getLeftMostOperand(base.expression)
			if (t.isMemberExpression(leftMost) && t.isIdentifier(leftMost.object, { name: 'Math' }))
				base = base.expression
			else
				base = transformBin(base.expression)
		} else {
			base = base.expression
		}
	}

	// Wrap the base in float() if it's a numeric literal (or unary over one)
	// even though base is pure numeric, the whole expression isn't.
	if (
		isNumericLiteral(base) ||
		(t.isUnaryExpression(base) && ['-', '+'].includes(base.operator) && isNumericLiteral(base.argument))
	) {
		base = t.callExpression(t.identifier('float'), [base])
	}

	return operands.slice(1).reduce((acc, operand, i) => {
		if (operand.type === 'ParenthesizedExpression') {
			if (t.isBinaryExpression(operand.expression) && opMap[operand.expression.operator]) {
				const leftMost = getLeftMostOperand(operand.expression)
				if (t.isMemberExpression(leftMost) && t.isIdentifier(leftMost.object, { name: 'Math' }))
					operand = operand.expression
				else
					operand = transformBin(operand.expression)
			} else {
				operand = operand.expression
			}
		}
		return t.callExpression(
			t.memberExpression(acc, t.identifier(opMap[ops[i]])),
			[operand]
		)
	}, base)
}

const shouldTransformBase = (node, scope) => {
	if (isNumericLiteral(node)) return true
	if (t.isUnaryExpression(node) && ['-', '+'].includes(node.operator))
		return shouldTransformBase(node.argument, scope)
	if (t.isIdentifier(node)) {
		const binding = scope.getBinding(node.name)
		if (binding && binding.path.isVariableDeclarator()) {
			const init = binding.path.node.init
			if (
				init &&
				(isNumericLiteral(init) ||
					(t.isUnaryExpression(init) && ['-', '+'].includes(init.operator) && isNumericLiteral(init.argument)))
			)
				return false
		}
		return true
	}
	if (t.isMemberExpression(node) && t.isIdentifier(node.object, { name: 'Math' }))
		return false
	return true
}

// Helper to improve spacing in the logged "After" line.
// This adds a single space after "(" and before ")".
const prettifyLine = line => line.replace(/\(\s*/g, '( ').replace(/\s*\)/g, ' )')

export default function TSLOperatorPlugin({ logs = true } = {}) {
	return {
		name: 'tsl-operator-plugin',
		transform(code, id) {
			if (!/\.(js|ts)x?$/.test(id)) return null

			const filename = path.basename(id)
			const ast = parse(code, {
				sourceType: 'module',
				plugins: ['jsx']
			})

			// Record changed binary expression locations
			const changedLines = new Set()

			traverse(ast, {
				CallExpression(path) {
					if (t.isIdentifier(path.node.callee, { name: 'Fn' })) {
						const fnArg = path.node.arguments[0]
						if (t.isArrowFunctionExpression(fnArg))
							path.get('arguments.0').traverse({
								BinaryExpression(binPath) {
									if (binPath.parentPath.isBinaryExpression()) return
									if (opMap[binPath.node.operator]) {
										const { operands } = flattenBinary(binPath.node, 0)
										if (operands.length && !shouldTransformBase(operands[0], binPath.scope))
											return
										if (binPath.node.loc) {
											changedLines.add(binPath.node.loc.start.line)
										}
										const newNode = transformBin(binPath.node)
										binPath.replaceWith(newNode)
									}
								}
							})
					}
				}
			})

			// Use retainLines to try and keep line numbers.
			const output = generate(ast, { retainLines: true }, code)
			const originalLines = code.split('\n')
			const newLines = output.code.split('\n')

			if(logs){
				// Only log for the lines that were transformed.
				changedLines.forEach(lineNumber => {
					const origLine = originalLines[lineNumber - 1] || ''
					const newLine = newLines[lineNumber - 1] || ''
					// Remove only leading spaces for logging purposes.
					const origTrim = origLine.replace(/^[\t ]+/, '')
					const newTrim = prettifyLine(newLine.replace(/^[\t ]+/, ''))
					if (origTrim !== newTrim) {
						console.log(
							`\x1b[33m[tsl-operator-plugin]\x1b[0m ${filename} (line ${lineNumber}):\n` +
							`\x1b[31mBefore:\x1b[0m ${origTrim}\n` +
							`\x1b[32mAfter: \x1b[0m ${newTrim}\n`
						)
					}
				})
			}

			return { code: output.code, map: output.map }
		}
	}
}
