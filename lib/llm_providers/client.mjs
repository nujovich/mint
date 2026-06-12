import { getProvider } from './registry.mjs'

export function getClient(config) {
  return getProvider(config.name).buildClient(config)
}
