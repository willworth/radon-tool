#!/usr/bin/env node

import * as path from 'node:path'
import * as cdk from 'aws-cdk-lib'
import { StaticSiteStack } from '../lib/static-site-stack'

const app = new cdk.App()

const account = process.env.CDK_DEFAULT_ACCOUNT ?? '037168667233'
const primaryRegion = 'eu-central-1'
const hostedZoneId = 'Z049600119LCOB5F6E3TE'
const hostedZoneName = 'willworth.es'

new StaticSiteStack(app, 'RadonToolPreviewStack', {
  env: { account, region: primaryRegion },
  crossRegionReferences: true,
  siteId: 'radon-tool-preview',
  environmentName: 'preview',
  assetPath: path.resolve(process.cwd(), '..', 'dist'),
  deploySiteAssets: false,
})

new StaticSiteStack(app, 'RadonToolProdStack', {
  env: { account, region: primaryRegion },
  crossRegionReferences: true,
  siteId: 'radon-tool',
  environmentName: 'prod',
  assetPath: path.resolve(process.cwd(), '..', 'dist'),
  deploySiteAssets: false,
  customDomain: {
    domainName: 'radon.willworth.es',
    hostedZoneId,
    hostedZoneName,
  },
})
