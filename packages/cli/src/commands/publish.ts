import { Command } from 'commander'
import { lightMagenta } from 'kolorist'
import fetch from 'node-fetch'
import childProcess from 'node:child_process'
import fs from 'node:fs'
import { join, resolve } from 'node:path'
import { cwd } from 'node:process'

type ChromeUploadConfig = {
  extensionId: string
  clientId: string
  clientSecret: string
  refreshToken: string
}

type FirefoxUploadConfig = {
  apiKey: string
  apiSecret: string
}

type EdgeUploadConfig = {
  productId: string
  clientId: string
  clientSecret: string
}

interface SubmissionResponse {
  id: string
}

/**
 * Upload to Chrome Web Store
 * for the time being this function uses
 * chrome-webstore-upload package
 *
 * @param {ChromeUploadConfig} config
 * @param {string} packageName
 * @param {string} packageVersion
 */
function uploadToChrome(config: ChromeUploadConfig, source: string) {
  const zipName = source
    ? source
    : `${process.env.PACKAGE_NAME ?? process.env.npm_package_name}@${
        process.env.PACKAGE_VERSION ?? process.env.npm_package_version
      }
  -chrome.zip`
  const zipPath = resolve(join(cwd(), 'dist', zipName))

  console.log('uploadToChrome() >', { source, zipName, zipPath })

  if (fs.existsSync(zipPath)) {
    const uploadCmd = `npx chrome-webstore-upload upload \
      --source ${zipPath} \
      --extension-id ${config.extensionId} \
      --client-id ${config.clientId} \
      --client-secret ${config.clientSecret} \
      --refresh-token ${config.refreshToken}`

    childProcess.execSync(uploadCmd, { stdio: 'inherit' })
  } else {
    console.error(`zip file not found at path: ${zipPath}`)
    process.exit()
  }
}

/**
 * Upload to AMO Firefox/ Mozilla Add-Ons
 *
 * there's an upstream issue with this api. while the upload
 * will usually succeed, the approval might time out.
 * this func will time out the api after 30000 and error messages should
 * hopefully be useful... check your email for approval confirmation later.
 * or check AMO Dashboard to see if it succeeded 👍
 *
 * @param {FirefoxUploadConfig} config
 */
function uploadToFirefox(config: FirefoxUploadConfig) {
  const sourceDir = resolve(join(cwd(), 'dist', 'firefox'))
  const artifactsDir = resolve(join(cwd(), 'dist'))

  console.log(lightMagenta('publishCommand (firefox) :'), {
    sourceDir,
    artifactsDir,
  })

  const signCmd = `npx web-ext sign \
    --source-dir ${sourceDir} \
    --artifacts-dir ${artifactsDir} \
    --api-key ${config.apiKey} \
    --api-secret ${config.apiSecret} \
    --channel unlisted \
    --use-submission-api`
  // --timeout 30000  \

  try {
    const output = childProcess.execSync(signCmd, { stdio: 'pipe' }).toString()

    if (output.includes('WebExtError: Approval: timeout')) {
      console.log(
        'API has timed out. the extension might still be under review...',
      )
    } else {
      console.log('uploaded successfully.')
    }
  } catch (error) {
    console.error('error publishing to Firefox:', error)
  }
}

/**
 * get access token (jwt) for api calls
 *
 *  -X POST \
 *  -H "Content-Type: application/x-www-form-urlencoded" \
 *  -d "client_id=<CLIENT_ID>" \
 *  -d "scope=https://api.addons.microsoftedge.microsoft.com/.default" \
 *  -d "client_secret=<CLIENT_SECRET>" \
 *  -d "grant_type=client_credentials" \
 *  -v \
 *  https://login.microsoftonline.com/<PRODUCT_ID>/oauth2/v2.0/token
 *
 * @param {EdgeUploadConfig} config
 * @return {*}  {Promise<string>}
 */
async function getEdgeAccessToken(config: EdgeUploadConfig): Promise<string> {
  const tokenUrl = `https://login.microsoftonline.com/${config.productId}/oauth2/v2.0/token`

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: config.clientId,
      scope: 'https://api.addons.microsoftedge.microsoft.com/.default',
      client_secret: config.clientSecret,
      grant_type: 'client_credentials',
    }),
  })

  if (!response.ok) {
    throw new Error(`failed to get Edge access token: ${response.statusText}`)
  }

  const responseBody = (await response.json()) as { access_token: string }
  return responseBody.access_token
}

/**
 * Upload to MS Edge Add-Ons
 * currently can only update extension already created
 * in the MS Partner Center Edge Dashboard
 *
 * @param {EdgeUploadConfig} config
 * @param {string} packageName
 * @param {string} packageVersion
 */
async function uploadToEdge(config: EdgeUploadConfig, source: string) {
  try {
    const zipName = source
      ? source
      : `${process.env.PACKAGE_NAME ?? process.env.npm_package_name}@${
          process.env.PACKAGE_VERSION ?? process.env.npm_package_version
        }-edge.zip`
    const zipPath = resolve(join(cwd(), 'dist', zipName))

    console.log(lightMagenta('uploadToEdge:'), { source, zipName, zipPath })

    const accessToken = await getEdgeAccessToken(config)
    const uploadUrl = `https://api.addons.microsoftedge.microsoft.com/v1/products/${config.productId}/submissions/draft/package`

    const packageStream = fs.createReadStream(zipPath)

    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/zip',
      },
      body: packageStream,
    })
    console.log('getEdgeAccessToken (uploadUrl) :', uploadUrl)

    console.log({ response })

    if (!response.ok) {
      throw new Error(`failed to upload Edge extension: ${response.statusText}`)
    }

    const submissionResponse = (await response.json()) as SubmissionResponse
    const submissionId = submissionResponse.id
    const submissionUrl = `https://partner.microsoft.com/en-us/dashboard/microsoftedge/${config.productId}/submissions/${submissionId}`

    console.log(
      `Edge extension uploaded successfully. submission url: ${submissionUrl}`,
    )
  } catch (error) {
    console.error('error uploading to Edge:', error)
  }
}

export const publishCommand = new Command('publish')
  .command('publish')
  .description(
    `• publish new or update existing extension(s)
├ • C W S: Chrome Web Store
├ • A M O: Mozilla/Firefox Add-ons
└ • M E A: MS Edge Add-ons`,
  )
  .option(
    '-b, --browsers <browsers...>',
    'specify browsers to publish (chrome, firefox, edge)',
  )
  .action(async (options) => {
    // TO diddly DO:
    // actually handle multiple browsers --browsers
    // option... run through below conditional for all browsers
    // found in ./src/manifests/index.ts array --> []
    // ^^^ update this when there's a moar betta way to grab all
    // browsers from project. e.g. esm import that ts and process
    // the func to return the pojo bedframeConfig
    try {
      const selectedBrowsers = options.browsers
      if (
        selectedBrowsers &&
        (selectedBrowsers.includes('chrome') ||
          selectedBrowsers.includes('firefox') ||
          selectedBrowsers.includes('edge'))
      ) {
        console.log(lightMagenta('publishing...'), selectedBrowsers)
      }

      if (!selectedBrowsers || selectedBrowsers.length === 0) {
        console.error(
          'no browsers specified. use -b or --browsers to specify browsers.',
        )
        return
      }

      if (selectedBrowsers.includes('chrome')) {
        const zipName = `${
          process.env.PACKAGE_NAME ?? process.env.npm_package_name
        }@${
          process.env.PACKAGE_VERSION ?? process.env.npm_package_version
        }-chrome.zip`
        const zipPath = resolve(join(cwd(), 'dist', zipName))

        console.log(lightMagenta('publishCommand (chrome) :'), {
          name: process.env.PACKAGE_NAME,
          version: process.env.PACKAGE_VERSION,
          zip: zipPath,
        })

        const chromeConfig: ChromeUploadConfig = {
          extensionId: process.env.EXTENSION_ID || '',
          clientId: process.env.CLIENT_ID || '',
          clientSecret: process.env.CLIENT_SECRET || '',
          refreshToken: process.env.REFRESH_TOKEN || '',
        }
        uploadToChrome(chromeConfig, zipName)
      }

      if (selectedBrowsers.includes('firefox')) {
        const firefoxConfig: FirefoxUploadConfig = {
          apiKey: process.env.WEB_EXT_API_KEY || '',
          apiSecret: process.env.WEB_EXT_API_SECRET || '',
        }
        uploadToFirefox(firefoxConfig)
      }

      if (selectedBrowsers.includes('edge')) {
        const zipName = `${
          process.env.PACKAGE_NAME ?? process.env.npm_package_name
        }@${
          process.env.PACKAGE_VERSION ?? process.env.npm_package_version
        }-edge.zip`
        const zipPath = resolve(join(cwd(), 'dist', zipName))

        console.log(lightMagenta('publishCommand (edge) :'), {
          name: process.env.PACKAGE_NAME,
          version: process.env.PACKAGE_VERSION,
          zip: zipPath,
        })

        const edgeConfig: EdgeUploadConfig = {
          productId: process.env.EDGE_PRODUCT_ID || '',
          clientId: process.env.EDGE_CLIENT_ID || '',
          clientSecret: process.env.EDGE_CLIENT_SECRET || '',
        }
        uploadToEdge(edgeConfig, zipName)
      }
    } catch (error) {
      console.error('failed to publish project:', error)
    }
  })
