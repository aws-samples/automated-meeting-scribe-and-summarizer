
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
        operation: 'DeleteItem',
        key: {
            pk: util.dynamodb.toDynamoDB(ctx.identity.claims.email),
            sk: util.dynamodb.toDynamoDB(meeting)
        }
    };
}

export function response(ctx) {
    return "Invite deleted successfully!"
}
