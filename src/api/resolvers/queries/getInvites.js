
import { util } from '@aws-appsync/utils';

export function request(ctx) {
    return {
        operation: 'Query',
        query: {
            expression: '#pk = :email',
            expressionNames: {
                '#pk': 'pk'
            },
            expressionValues: {
                ':email': util.dynamodb.toDynamoDB(ctx.identity.claims.email)
            }
        },
        filter: {
            expression: '#exp >= :minTime',
            expressionNames: {
                '#exp': 'meeting_expiration'
            },
            expressionValues: {
                ':minTime': util.dynamodb.toDynamoDB(util.time.nowEpochSeconds())
            }
        }
    };
}

export function response(ctx) {
    return ctx.result.items.map(item => {
        const [platform, id, password, time] = item.sk.split('#');
        return {
            name: item.meeting_name,
            platform,
            id,
            password,
            time,
            status: item.scribe_status,
            scribe: item.scribe_name
        };
    });
}
