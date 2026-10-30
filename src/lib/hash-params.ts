import {ViewMode} from '../lib/view-mode'

export interface HashParams {
  profileURL?: string
  title?: string
  localProfilePath?: string
  viewMode?: ViewMode
  derivedEvent?: DerivedEvent
}

// A derived event for callgrind files: one more profile whose cost is a
// weighted sum of the file's events, shown first. From the hash parameter
// `derived=<name>:<event>=<weight>,<event>=<weight>,...`, e.g.
// `derived=CEst:Ir=1,I1mr=10,D1mr=10,D1mw=10,ILmr=100,DLmr=100,DLmw=100,Bcm=10,Bim=10`.
export interface DerivedEvent {
  name: string
  weights: {[event: string]: number}
}

export function parseDerivedEvent(value: string): DerivedEvent | null {
  const colon = value.indexOf(':')
  if (colon <= 0) return null
  const name = value.slice(0, colon)
  const weights: {[event: string]: number} = {}
  let any = false
  for (const term of value.slice(colon + 1).split(',')) {
    const [event, w] = term.split('=')
    const weight = parseFloat(w)
    if (!event || !isFinite(weight)) continue
    weights[event] = weight
    any = true
  }
  return any ? {name, weights} : null
}

function getViewMode(value: string): ViewMode | null {
  switch (value) {
    case 'time-ordered':
      return ViewMode.CHRONO_FLAME_CHART
    case 'left-heavy':
      return ViewMode.LEFT_HEAVY_FLAME_GRAPH
    case 'sandwich':
      return ViewMode.SANDWICH_VIEW
    default:
      return null
  }
}

export function getHashParams(hashContents = window.location.hash): HashParams {
  try {
    if (!hashContents.startsWith('#')) {
      return {}
    }
    const components = hashContents.substr(1).split('&')
    const result: HashParams = {}
    for (const component of components) {
      let [key, value] = component.split('=')
      value = decodeURIComponent(value)
      if (key === 'profileURL') {
        result.profileURL = value
      } else if (key === 'title') {
        result.title = value
      } else if (key === 'localProfilePath') {
        result.localProfilePath = value
      } else if (key === 'derived') {
        const derived = parseDerivedEvent(value)
        if (derived) {
          result.derivedEvent = derived
        } else {
          console.error(`Ignoring invalid derived event specifier: ${value}`)
        }
      } else if (key === 'view') {
        const mode = getViewMode(value)
        if (mode !== null) {
          result.viewMode = mode
        } else {
          console.error(`Ignoring invalid view specifier: ${value}`)
        }
      }
    }
    return result
  } catch (e) {
    console.error(`Error when loading hash fragment.`)
    console.error(e)
    return {}
  }
}
