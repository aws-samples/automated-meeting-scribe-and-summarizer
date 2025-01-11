
import { util } from '@aws-appsync/utils';

export function request(ctx) {
    const input = ctx.args.input;
    const meeting = [
        input.platform,
        input.id,
        input.password,
        input.time
    ].join('#');

    return {
        operation: 'PutItem',
        key: {
            pk: util.dynamodb.toDynamoDB(ctx.identity.claims.email),
            sk: util.dynamodb.toDynamoDB(meeting)
        },
        attributeValues: {
            meeting_expiration: util.dynamodb.toDynamoDB(input.time + 300), // 5 minutes
            meeting_name: util.dynamodb.toDynamoDB(input.name),
            scribe_name: util.dynamodb.toDynamoDB("TBD"),
            scribe_status: util.dynamodb.toDynamoDB("Scheduled")
        }
    };
}

export function response(ctx) {
    const input = ctx.args.input;
    return `${input.name} invite created!`
}
