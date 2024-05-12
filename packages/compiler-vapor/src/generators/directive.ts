import { createSimpleExpression, isSimpleIdentifier } from '@vue/compiler-dom'
import { camelize } from '@vue/shared'
import { genExpression } from './expression'
import type { CodegenContext } from '../generate'
import {
  type CodeFragment,
  type CodeFragmentDelimiters,
  DELIMITERS_ARRAY,
  NEWLINE,
  genCall,
  genMulti,
} from './utils'
import {
  IRNodeTypes,
  type OperationNode,
  type WithDirectiveIRNode,
} from '../ir'

export function genDirectivesForElement(id: number, context: CodegenContext) {
  const dirs = filterDirectives(id, context.block.operation)
  return dirs.length ? genWithDirective(dirs, context) : []
}

export function genWithDirective(
  opers: WithDirectiveIRNode[],
  context: CodegenContext,
): CodeFragment[] {
  const { vaporHelper } = context

  const element = `n${opers[0].element}`
  const directiveItems = opers.map(genDirective)
  const directives = genMulti(DELIMITERS_ARRAY, ...directiveItems)

  return [
    NEWLINE,
    ...genCall(vaporHelper('withDirectives'), element, directives),
  ]

  function genDirective({ dir, builtin }: WithDirectiveIRNode): CodeFragment[] {
    const directive = genDirective()
    const value = dir.exp && ['() => ', ...genExpression(dir.exp, context)]
    const argument = dir.arg && genExpression(dir.arg, context)
    const modifiers = !!dir.modifiers.length && [
      '{ ',
      genDirectiveModifiers(dir.modifiers),
      ' }',
    ]

    return genMulti(
      DELIMITERS_ARRAY.concat('void 0') as CodeFragmentDelimiters,
      directive,
      value,
      argument,
      modifiers,
    )

    function genDirective() {
      const {
        vaporHelper,
        options: { bindingMetadata },
      } = context
      if (dir.name === 'show') {
        return [vaporHelper('vShow')]
      } else if (builtin) {
        return [vaporHelper(builtin)]
      } else {
        const directiveReference = camelize(`v-${dir.name}`)
        // TODO resolve directive
        if (bindingMetadata[directiveReference]) {
          const directiveExpression = createSimpleExpression(directiveReference)
          directiveExpression.ast = null
          return genExpression(directiveExpression, context)
        } else {
          return `${vaporHelper('resolveDirective')}("${directiveReference}")`
        }
      }
    }
  }
}

export function genDirectiveModifiers(modifiers: string[]) {
  return modifiers
    .map(
      value =>
        `${isSimpleIdentifier(value) ? value : JSON.stringify(value)}: true`,
    )
    .join(', ')
}

function filterDirectives(
  id: number,
  operations: OperationNode[],
): WithDirectiveIRNode[] {
  return operations.filter(
    (oper): oper is WithDirectiveIRNode =>
      oper.type === IRNodeTypes.WITH_DIRECTIVE && oper.element === id,
  )
}
