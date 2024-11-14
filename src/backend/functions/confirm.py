import boto3


def handler(event, context):
    if not boto3.client("sesv2").get_account()["ProductionAccessEnabled"]:
        print("SES is sandboxed.")
        boto3.client("ses").verify_email_identity(
            EmailAddress=event["request"]["userAttributes"]["email"]
        )
    return event
