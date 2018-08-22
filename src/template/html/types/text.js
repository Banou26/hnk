import { OzHTMLTemplateSymbol } from '../elements/template.js'
import { replaceNodes } from '../utils.js'

const replace = (arrayFragment, ...vals) =>
  arrayFragment.splice(0, arrayFragment.length, ...vals)

const makeText = ({ template, placeholderMetadata, arrayFragment }) => {
  let _value, _placeholders, _fragments, _template, _arrayFragment
  return ({values, value = values[placeholderMetadata.ids[0]], forceUpdate}) => {
    const type = typeof value
    if (value && type === 'object') {
      if (value && value[OzHTMLTemplateSymbol]) {
        const template = value
        replace(arrayFragment, template.childNodes)
        _template = template
      } else if (Array.isArray(value)) {
        const values = value
        const [ placeholders, fragments ] = values.reduce(tuple =>
          void tuple[0].push(makeText({
            template,
            placeholderMetadata,
            arrayFragment: tuple[1][tuple[1].push([]) - 1] })) || tuple
          , [[], []])
        placeholders.forEach((placeholder, i) => placeholder({value: value[i]}))
        replace(arrayFragment, fragments)
        _placeholders = placeholders
        _fragments = fragments
      } else if (value instanceof Node) {
        replace(arrayFragment, value)
      }
    } else if (type === 'function') {
      if (value.$promise) {
        if (value.$resolved) {
          makeText({
            template,
            placeholderMetadata,
            arrayFragment
          })({ value: value.$resolvedValue })
        } else {
          replace(arrayFragment, new Text())
          value.then(resolvedValue =>
            _value === value
              ? template.update(...template.values.map((_, i) =>
                i === placeholderMetadata.ids[0]
                  ? resolvedValue
                  : _))
              : undefined)
        }
      } else {
        makeText({
          template,
          placeholderMetadata,
          arrayFragment
        })({ value: value(arrayFragment) })
      }
    } else {
      replace(arrayFragment, new Text(type === 'symbol' ? value.toString() : value))
    }
    _value = value
    _arrayFragment = arrayFragment.flat(Infinity)
  }
}

export default makeText