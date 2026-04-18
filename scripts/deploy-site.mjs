#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import path from 'node:path'

const envIndex = process.argv.indexOf('--env')
const shouldDeployCdk = process.argv.includes('--cdk-deploy')
const envName = envIndex >= 0 ? process.argv[envIndex + 1] : 'prod'

if (envName !== 'preview' && envName !== 'prod') {
  throw new Error(`Invalid --env: ${envName}`)
}

const rootDir = process.cwd()
const stackName =
  envName === 'prod' ? 'RadonToolProdStack' : 'RadonToolPreviewStack'
const outDir = path.join(rootDir, 'dist')

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    env: options.env ?? process.env,
    cwd: options.cwd ?? rootDir,
  })

  if (result.status !== 0) {
    throw new Error(`Command failed (${result.status}): ${command} ${args.join(' ')}`)
  }
}

function capture(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: ['inherit', 'pipe', 'pipe'],
    encoding: 'utf8',
    env: options.env ?? process.env,
    cwd: options.cwd ?? rootDir,
  })

  if (result.status !== 0) {
    process.stderr.write(result.stderr)
    throw new Error(`Command failed (${result.status}): ${command} ${args.join(' ')}`)
  }

  return result.stdout
}

if (shouldDeployCdk) {
  run('npm', [
    '--prefix',
    'infrastructure',
    'run',
    'cdk',
    '--',
    'deploy',
    stackName,
    '--require-approval',
    'never',
  ])
}

run('npm', ['run', 'build'])

const outputsRaw = capture('aws', [
  'cloudformation',
  'describe-stacks',
  '--stack-name',
  stackName,
  '--query',
  'Stacks[0].Outputs',
  '--output',
  'json',
])

const outputs = JSON.parse(outputsRaw)
const outputMap = Object.fromEntries(
  outputs
    .filter((entry) => entry.OutputKey && entry.OutputValue)
    .map((entry) => [entry.OutputKey, entry.OutputValue])
)

const bucketName = outputMap.BucketNameOutput
const distributionId = outputMap.DistributionIdOutput
const siteUrl =
  envName === 'prod'
    ? outputMap.SiteUrlOutput ?? 'https://radon.willworth.es'
    : `https://${outputMap.DistributionDomainNameOutput}`

if (!bucketName || !distributionId) {
  throw new Error(`Missing expected CloudFormation outputs for ${stackName}`)
}

run('aws', ['s3', 'sync', `${outDir}/`, `s3://${bucketName}/`, '--delete'])
run('aws', [
  'cloudfront',
  'create-invalidation',
  '--distribution-id',
  distributionId,
  '--paths',
  '/*',
])

console.log(`Deployed ${envName} site to ${siteUrl}`)
