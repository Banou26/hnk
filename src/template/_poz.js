import { HTMLTag } from './html/index.js'
import { placeholderRegex } from './utils.js'

const voidTags = ['area', 'base', 'br', 'col', 'command', 'embed', 'hr', 'img', 'input', 'keygen', 'link', 'menuitem', 'meta', 'param', 'source', 'track', 'wbr']

const regex = /^(\s*)(?:(\|)|(?:([.#\w-]*)(?:\(([\s\S]*?)\))?))(?: (.*))?/
const gRegex = new RegExp(regex, 'gm')

const identifierRegex = /(?:(\.)|(#))([a-z0-9-]*)/
const gIdentifierRegex = new RegExp(identifierRegex, 'g')
const classRegex = /class="(.*)"/

const makeHTML = ({tag, attributes, childs, textContent, id, classList}) => {
  const classStr = classList.join(' ')
  let attrStr = attributes ? ' ' + attributes : ''
  if (attrStr.match(classRegex)) attrStr = attrStr.replace(classRegex, (match, classes) => `class="${classes} ${classStr}"`)
  else if (classStr) attrStr += ` class="${classStr}"`
  if (tag) return `<${tag}${id ? ` id="${id}"` : ''}${attrStr}>${textContent || ''}${childs.map(line => makeHTML(line)).join('')}${voidTags.includes(tag) ? '' : `</${tag}>`}`
  else return '\n' + textContent
}

const pushLine = ({childs: currentChilds}, line) => {
  if (currentChilds.length && currentChilds[currentChilds.length - 1].indentation < line.indentation) pushLine(currentChilds[currentChilds.length - 1], line)
  else currentChilds.push(line)
}
const hierarchise = arr => {
  const hierarchisedArr = []
  for (let line of arr) {
    if (hierarchisedArr.length && hierarchisedArr[hierarchisedArr.length - 1].indentation < line.indentation && hierarchisedArr[hierarchisedArr.length - 1].childs) pushLine(hierarchisedArr[hierarchisedArr.length - 1], line)
    else hierarchisedArr.push(line)
  }
  return hierarchisedArr
}

const pozToHTML = str =>
  hierarchise(
    str
      .match(gRegex)
      .map(str => str.match(regex))
      .filter(match => match[0].trim().length)
      .map(match => {
        if (match[3] && !match[3].replace(placeholderRegex, '').trim().length) {
          return { indentation: match[1].split('\n').pop().length, textContent: match[3], classList: [] }
        }
        const tag = match[3] ? match[3].match(/^([a-z0-9-]*)/)[1] : undefined
        const identifiers = match[3] ? match[3].slice(tag.length).match(gIdentifierRegex) || [] : []
        const id = identifiers.find(identifier => identifier.match(identifierRegex)[2])
        const classList = identifiers.filter(identifier => identifier.match(identifierRegex)[1]).map(str => str.slice(1))
        return {
          indentation: match[1].split('\n').pop().length,
          tag: match[2]
            ? undefined
            : tag || 'div',
          attributes: match[4],
          id,
          classList,
          textContent: match[5],
          childs: []
        }
      })
  )
    .map(line => makeHTML(line))
    .join('')

export const poz = HTMLTag(pozToHTML)
