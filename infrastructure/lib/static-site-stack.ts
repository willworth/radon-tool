import {
  CfnOutput,
  Duration,
  PhysicalName,
  RemovalPolicy,
  Stack,
  type StackProps,
} from 'aws-cdk-lib'
import * as acm from 'aws-cdk-lib/aws-certificatemanager'
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront'
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins'
import * as route53 from 'aws-cdk-lib/aws-route53'
import * as route53Targets from 'aws-cdk-lib/aws-route53-targets'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment'
import { Construct } from 'constructs'

export interface StaticSiteStackProps extends StackProps {
  siteId: string
  environmentName?: string
  assetPath?: string
  deploySiteAssets?: boolean
  customDomain?: {
    domainName: string
    hostedZoneId?: string
    hostedZoneName?: string
    certificateArn?: string
  }
}

export class StaticSiteStack extends Stack {
  constructor(scope: Construct, id: string, props: StaticSiteStackProps) {
    super(scope, id, props)

    const customDomain = props.customDomain
    let hostedZone: route53.IHostedZone | undefined
    let certificate: acm.ICertificate | undefined

    if (customDomain) {
      if (customDomain.hostedZoneId && customDomain.hostedZoneName) {
        hostedZone = route53.HostedZone.fromHostedZoneAttributes(
          this,
          'HostedZone',
          {
            hostedZoneId: customDomain.hostedZoneId,
            zoneName: customDomain.hostedZoneName,
          }
        )
      }

      if (customDomain.certificateArn) {
        certificate = acm.Certificate.fromCertificateArn(
          this,
          'ExistingCertificate',
          customDomain.certificateArn
        )
      } else if (hostedZone) {
        certificate = new acm.DnsValidatedCertificate(this, 'SiteCertificate', {
          domainName: customDomain.domainName,
          hostedZone,
          region: 'us-east-1',
        })
      } else {
        throw new Error(
          'customDomain requires either certificateArn or hosted zone details'
        )
      }
    }

    const siteBucket = new s3.Bucket(this, 'SiteBucket', {
      bucketName: PhysicalName.GENERATE_IF_NEEDED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
      removalPolicy: RemovalPolicy.RETAIN,
      autoDeleteObjects: false,
    })

    const responseHeadersPolicy = new cloudfront.ResponseHeadersPolicy(
      this,
      'SecurityHeadersPolicy',
      {
        securityHeadersBehavior: {
          contentSecurityPolicy: {
            contentSecurityPolicy:
              "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; script-src 'self'; img-src 'self' data:;",
            override: true,
          },
          strictTransportSecurity: {
            accessControlMaxAge: Duration.days(365),
            includeSubdomains: true,
            preload: true,
            override: true,
          },
          contentTypeOptions: { override: true },
          frameOptions: {
            frameOption: cloudfront.HeadersFrameOption.DENY,
            override: true,
          },
          referrerPolicy: {
            referrerPolicy:
              cloudfront.HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN,
            override: true,
          },
          xssProtection: {
            modeBlock: true,
            protection: true,
            override: true,
          },
        },
      }
    )

    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultRootObject: 'index.html',
      domainNames: customDomain ? [customDomain.domainName] : undefined,
      certificate,
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(siteBucket),
        viewerProtocolPolicy:
          cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        compress: true,
        responseHeadersPolicy,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: Duration.minutes(5),
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: Duration.minutes(5),
        },
      ],
    })

    if (customDomain && hostedZone) {
      new route53.ARecord(this, 'AliasARecord', {
        zone: hostedZone,
        recordName: customDomain.domainName,
        target: route53.RecordTarget.fromAlias(
          new route53Targets.CloudFrontTarget(distribution)
        ),
      })

      new route53.AaaaRecord(this, 'AliasAaaaRecord', {
        zone: hostedZone,
        recordName: customDomain.domainName,
        target: route53.RecordTarget.fromAlias(
          new route53Targets.CloudFrontTarget(distribution)
        ),
      })
    }

    if (props.deploySiteAssets && props.assetPath) {
      new s3deploy.BucketDeployment(this, 'DeploySiteAssets', {
        sources: [s3deploy.Source.asset(props.assetPath)],
        destinationBucket: siteBucket,
        distribution,
        distributionPaths: ['/*'],
      })
    }

    new CfnOutput(this, 'BucketNameOutput', {
      value: siteBucket.bucketName,
      description: 'S3 bucket storing static site assets',
    })

    new CfnOutput(this, 'DistributionIdOutput', {
      value: distribution.distributionId,
      description: 'CloudFront distribution identifier',
    })

    new CfnOutput(this, 'DistributionDomainNameOutput', {
      value: distribution.distributionDomainName,
      description: 'CloudFront domain name',
    })

    new CfnOutput(this, 'SiteUrlOutput', {
      value: customDomain
        ? `https://${customDomain.domainName}`
        : `https://${distribution.distributionDomainName}`,
      description: 'Primary site URL',
    })

    if (certificate) {
      new CfnOutput(this, 'CertificateArnOutput', {
        value: certificate.certificateArn,
        description: 'ACM certificate backing HTTPS (us-east-1)',
      })
    }
  }
}
