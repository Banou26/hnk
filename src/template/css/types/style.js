import { toPlaceholderString, toPlaceholdersNumber } from '../../utils.js'
import { containerQueryRegex, globalContainerQueryRegex, containerQuery as toContainerQuery, containerQueryAttribute, globalContainerQueryAttributeRegex } from '../utils.js'

const globalRemovedIds = []
const globalIds = []

const makeUniqueId = (
  n = globalRemovedIds.length
    ? globalRemovedIds.shift()
    : (globalIds[globalIds.length - 1] === undefined ? -1 : 0) + 1
) => {
  globalIds.splice(n, 0, n)
  return {
    id: n,
    match: undefined,
    strId: undefined,
    strAttrId: undefined,
    originalSelector: undefined,
    selector: undefined,
    nodeSelector: undefined,
    nodes: new Map(),
    unregister: _ => {
      globalRemovedIds.push(n)
      globalIds.splice(globalIds.indexOf(n), 1)
    }
  }
}

const watchedElements = new Map()

let measuringElement = document.createElement('div')
measuringElement.style.display = 'none'

var resizeObserver = new ResizeObserver(entries => {
  for (let entry of entries) {
    const { target } = entry
    const containerQueries = watchedElements.get(entry.target)
    const cr = entry.contentRect
    target.parentNode.insertBefore(measuringElement, target)
    for (const containerQuery of containerQueries) {
      measuringElement.style.height = containerQuery.match[3]
      const containerQueryPxValue = parseInt(window.getComputedStyle(measuringElement).height)
      const property =
        containerQuery.match[2].endsWith('height')
          ? 'height'
          : containerQuery.match[2].endsWith('width')
            ? 'width'
            : undefined
      if (
        (containerQuery.match[2].startsWith('min') && cr[property] > containerQueryPxValue) ||
        (containerQuery.match[2].startsWith('max') && cr[property] < containerQueryPxValue)
      ) {
        target.setAttribute(containerQuery.strId, '')
      } else {
        target.removeAttribute(containerQuery.strId)
      }
    }
    measuringElement.remove()
    measuringElement.style.height = ''
  }
})

const watchElement = (elem, containerQuery) => {
  const _containerQueries = watchedElements.get(elem)
  const containerQueries = _containerQueries || []
  containerQueries.push(containerQuery)
  if (!_containerQueries) watchedElements.set(elem, containerQueries)
  resizeObserver.observe(elem)
  return _ => {
    containerQueries.splice(containerQueries.indexOf(containerQuery), 1)
    if (!containerQueries.length) watchedElements.delete(elem)
    resizeObserver.unobserve(elem)
    for (const [node] of containerQuery.nodes) node.removeAttribute(containerQuery.strId)
  }
}

export default ({
  placeholderMetadata,
  placeholderMetadata: {
    values: [_selector],
    rule: _rule
  },
  rules: [ rule ],
  placeholderIds = toPlaceholdersNumber(_selector)
}) => {
  const { ownerDocument } = rule.parentStyleSheet.ownerNode
  const getResult = toPlaceholderString(placeholderMetadata.values[0])
  let _containerQueries
  const matchContainerQueriesNodes = _ => {
    for (const containerQuery of _containerQueries) {
      const matchedNodes = Array.from(ownerDocument.querySelectorAll(containerQuery.nodeSelector))
      const containerQueryNodes = Array.from(containerQuery.nodes.keys())
      containerQueryNodes
        .filter(node =>
          !matchedNodes.includes(node)) // Removed nodes
        .forEach(node => {
          containerQuery.nodes.get(node)() // Unregister watcher
          containerQuery.nodes.delete(node)
        })
      matchedNodes
        .filter(node => !containerQueryNodes.includes(node)) // Added nodes
        .forEach(node => containerQuery.nodes.set(node, watchElement(node, containerQuery) /* Register watcher */))
    }
  }
  const mutationObserver = new MutationObserver(matchContainerQueriesNodes)
  let firstInit = false
  let observingMutations = false
  let _values
  return [({ values, forceUpdate }) => { // Update
    if (
      (!placeholderIds.length/* static container query */ &&
        placeholderIds
          .map((id, i) =>
            values[i])
          .some((val, i) =>
            _values?.[i] !== val) // used values changed
      ) &&
      firstInit) return
    const result = getResult(values)
    if (containerQueryRegex.test(result)) {
      if (!observingMutations) mutationObserver.observe(ownerDocument, { subtree: true, childList: true, attributes: true })
      if (_containerQueries) {
        for (const containerQuery of _containerQueries) {
          containerQuery.unregister()
        }
        _containerQueries = undefined
      }
      const containerQueries =
        result
          // TODO: replace this ',' split by a regex to make it work with attributes selector containing a ','
          .split(',')
          .filter(str => containerQueryRegex.test(str))
          .map((str, i) => {
            let containerQueries = []
            let match
            while ((match = globalContainerQueryRegex.exec(str))) {
              const uniqueId = makeUniqueId()
              uniqueId.match = match
              uniqueId.strId = toContainerQuery(uniqueId.id)
              uniqueId.strAttrId = containerQueryAttribute(uniqueId.id)
              containerQueries.push(uniqueId)
            }
            const selector =
              containerQueries
                .reduce((str, { strAttrId, match }) =>
                  str.replace(match[0], strAttrId)
                  , result)
            for (const containerQuery of containerQueries) {
              containerQuery.originalSelector = str
              containerQuery.selector = selector
              containerQuery.nodeSelector = selector.slice(0, selector.indexOf(containerQuery.strAttrId)).replace(globalContainerQueryAttributeRegex, '')
            }
            return containerQueries
          })
          .flat(Infinity)
      const selector =
        containerQueries
          .reduce((str, { originalSelector, selector }) =>
            str.replace(originalSelector, selector)
            , result)
      rule.selectorText = selector
      _containerQueries = containerQueries
      matchContainerQueriesNodes()
    } else {
      if (observingMutations) mutationObserver.disconnect()
      if (_containerQueries) {
        for (const containerQuery of _containerQueries) {
          containerQuery.unregister()
        }
        _containerQueries = undefined
      }
      rule.selectorText = result
    }
    _values = values
    firstInit = true
  }, _ => { // Unregister
    if (observingMutations) mutationObserver.disconnect()
  }]
}
