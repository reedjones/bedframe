import { Framework, Language, PackageManager, Repository, Style } from './types'
import { AnyCase } from './utils'

export interface TemplateConfig {
  framework: Lowercase<Framework> | Capitalize<Framework>
  language: Lowercase<Language> | Capitalize<Language>
  packageManager?: AnyCase<PackageManager>
  style: Style | boolean
  lintFormat: Record<string, any> | boolean
  tests: Record<string, any> | boolean
  git: Record<string, any> | boolean
  gitHooks: Record<string, any> | boolean
  commitLint: Record<string, any> | boolean
  changesets: Record<string, any> | boolean
}

/**
 * createTemplate()
 * @param template config object
 */
export interface BedframeTemplate {
  name?: string
  version?: string
  description?: string
  config: TemplateConfig
}

export const createTemplate = (template: BedframeTemplate): BedframeTemplate =>
  template
