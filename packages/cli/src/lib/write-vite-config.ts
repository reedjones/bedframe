import { Browser } from '@bedframe/core'
import fs from 'fs-extra'
import path from 'node:path'
import prompts from 'prompts'

export function viteConfig(response: prompts.Answers<string>): string {
  const { browser: browsers, development } = response
  const styledComponents =
    development.template.config.style === 'Styled Components'

  const getManifestArray = browsers.map((browser: Browser) => {
    return `manifest.${browser.toLowerCase()}`
  })

  return `import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import { ManifestV3Export, crx } from '@crxjs/vite-plugin'
import react from '@vitejs/plugin-react'
${styledComponents ? `import macrosPlugin from 'vite-plugin-babel-macros'` : ''}
import { getManifest } from '@bedframe/core'
import * as manifest from './src/manifest'

export default ({ mode }) => {
  return defineConfig({
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
      },
    },
    plugins: [
      react(),
      crx({
        ${`manifest: getManifest(mode, [
          ${getManifestArray}
        ]) as ManifestV3Export,\n`}
      }),
      ${styledComponents ? 'macrosPlugin()' : ''},
    ],
    build: {
      outDir: \`dist/\${mode}\`,
    },
  })
}

`
}

export function writeViteConfig(response: prompts.Answers<string>): void {
  console.log('viteConfig(response):::', viteConfig(response))
  const { name } = response
  const rootDir = path.resolve(name.path)
  const viteConfigPath = path.resolve(path.join(rootDir, `vite.config.ts`))
  fs.ensureFile(viteConfigPath)
    .then(() =>
      fs
        .outputFile(viteConfigPath, viteConfig(response) + '\n')
        .catch((error) => console.error(error))
    )
    .catch((error) => console.error(error))
}
