
# Automated Meeting Scribe and Summarizer

Using this application's website, you can invite an AI-assisted scribe to your upcoming Amazon Chime, Webex, or Zoom meeting(s) to get a follow-up email with the attendee list, chat history, attachments, and transcript, as well as a summary and action items. You don't even need to be present in a meeting for your invited scribe to join. Each scribe is linked to your email for identification. The scribe also redacts sensitive personally identifiable information (PII) by default. This security and privacy-focused application deploys into an AWS account with just a few clicks in the AWS CloudFormation console. All processing, from transcription to summarization, is done within that account.

## Architecture

![Architecture Diagram](architecture.jpg)

### Build Resources 
- The CloudFormation stack creates an AWS CodeBuild project that references the source code in this repository to build a Docker image that is pushed to Amazon Elastic Container Registry (ECR) and a React build directory that is uploaded to Amazon Simple Storage Service (S3). 
    - An AWS Lambda-backed custom resource runs a build of the CodeBuild project.

### Application Resources
- The static website is hosted in S3 and served using Amazon CloudFront. 
- Web authentication is provided by AWS Amplify Authentication, powered by Amazon Cognito.
- AWS Web Application Firewall (WAF) also protects the CloudFront distribution and Amazon API Gateway*.
- API Gateway invokes an AWS Step Functions synchronous express workflow that runs an Amazon Elastic Container Service (ECS) task or schedules it through Amazon EventBridge Scheduler. 
- The ECS application uses Playwright to join the meeting from a Chromium browser then monitor attendees and messages. Amazon Transcribe is used to convert speech to text, generating a transcript. Amazon Comprehend is then used to detect/redact PII before Anthropic Claude on Amazon Bedrock generates summaries from the redacted transcript. The summary and action items, along with the other meeting details, are emailed using Amazon Simple Email Service (SES).

<br>\* This application uses the following AWS-managed WAF rules on each Web ACL: AWSManagedRulesAmazonIpReputationList, AWSManagedRulesCommonRuleSet, and AWSManagedRulesKnownBadInputsRuleSet. If you would like to add additional rules, you can do so in the [WAF console](https://us-east-1.console.aws.amazon.com/wafv2/homev2?region=us-east-1#/).<br />

## Getting Started

### Prerequisites
To interact with Claude 3 Sonnet on Bedrock, you need to [request access to the model in US East (North Virginia)](https://console.aws.amazon.com/bedrock/home?#/modelaccess)*. Make sure to read and accept the end-user license agreements or EULA.

### Deployment
- Per [guidance for workload isolation on AWS](https://aws.amazon.com/solutions/guidance/workload-isolation-on-aws/), it is recommended that you deploy the CloudFormation template in its own AWS account.
- Download [scribe.yaml](scribe.yaml) or clone the entire repository with `git clone https://github.com/aws-samples/automated-meeting-scribe-and-summarizer.git`.
- Open the [CloudFormation console](https://us-east-1.console.aws.amazon.com/cloudformation/home?region=us-east-1#/stacks/create) to create a stack in US East (North Virginia)*.
- For **Template source**, select **Upload a template file**. Then, click **Choose file**. 
- Select **scribe.yaml** then click **Open**. 
- Once the S3 URL populates, click **Next**. 
- Enter a **Stack name** and **Email**.
    - This email address will be used to log in to the website as well as to send and receive meeting details. 
- Click **Next** twice. 
- Click **I acknowledge that AWS CloudFormation might create IAM resources** then **Submit**. 

### Email Verification
- Open the inbox of the email you entered. You can expect to receive two emails:
    - Email Address Verification Request in region US East (N. Virginia)
        - Click the provided URL to authorize use of the email address.
    - Your temporary password
        - The username and temporary password can be used to log in to the website.
- Optionally, you can [request to move out of the SES sandbox](https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html) to email new users without additional verification.

### Accessing the Website
- Return to the CloudFormation console. 
- Once the stack shows *CREATE_COMPLETE* status, click **Outputs**. 
- Click on the CloudFront URL to open the website. 
- Enter your username and password or create a new account.
    - Change your password and/or verify your email as needed.

### Using the Website
- To invite a scribe to your upcoming meeting, enter the **Meeting Name**, **Meeting ID**, and, optionally, the **Meeting Password** and/or **Meeting Time**.
- Click **Invite Now** to invite the scribe to join as soon as possible, or click **Invite Later** to schedule the scribe.
- To delete an invite for an upcoming meeting, select the invite then click **Delete**.
- To log out, click **Logout**.

### Using the Meeting Platform
- At the specified meeting time, your scribe will join the meeting's waiting room.
    - It will wait for up to five minutes in the waiting room.
- Verify the scribe's linked email then admit it into the meeting.
- Once admitted, the scribe will introduce itself in the chat.
- At any point thereafter, you can send the scribe command messages in the chat: 
    - "START" will start saving attendance, new messages and machine-generated captions.
    - "PAUSE" will stop saving meeting details.
    - "END" will remove the scribe from the meeting.
- After the meeting ends, if the start message was sent in the chat, you should receive a follow-up email with the meeting details.

<br>\* The application stack will not deploy outside US East (North Virginia) because, to use an Amazon Certificate Manager (ACM) certificate with CloudFront, the certificate must be requested in that region.<br />

## Clean-up
- Open the [CloudFormation console](https://us-east-1.console.aws.amazon.com/cloudformation/home?region=us-east-1#/stacks).
- Select the stack you created then click **Delete** twice.
- Open the [SES console](https://us-east-1.console.aws.amazon.com/ses/home?region=us-east-1#/identities).
- Select unused identities then click **Delete** followed by **Confirm**.

## Security
See the [CONTRIBUTING](CONTRIBUTING) file for more information.

## License
This repository is licensed under the MIT-0 License. See the [LICENSE](LICENSE) file.

## Contributors
- Kevin Pinkerton
- Lawton Pittenger
- Eashan Kaushik
- Chase Pinkerton
- Romi Asad
